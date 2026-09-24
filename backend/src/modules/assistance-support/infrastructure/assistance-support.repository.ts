import { Pool, type PoolClient } from 'pg';

import type { ConversationActor } from '../assistance-support.types.js';
import type {
  ConversationContextType,
  ConversationRecord,
  ConversationStatus,
  MessageRecord,
  MessageSenderType,
} from '../assistance-support.types.js';
import { NotificationRepository } from '../../operations/infrastructure/notification.repository.js';

function mapConversation(row: Record<string, unknown>): ConversationRecord {
  return {
    assignedSupportUserId: typeof row.assigned_support_user_id === 'string' ? row.assigned_support_user_id : null,
    contextId: typeof row.context_id === 'string' ? row.context_id : null,
    contextType: String(row.context_type) as ConversationContextType,
    customerUserId: String(row.customer_user_id),
    id: String(row.id),
    status: String(row.status) as ConversationStatus,
    title: typeof row.title === 'string' ? row.title : null,
    ...(row.updated_at instanceof Date ? { updatedAt: row.updated_at } : {}),
  };
}

function mapMessage(row: Record<string, unknown>): MessageRecord {
  return {
    clientMessageId: String(row.client_message_id),
    content: String(row.content),
    conversationId: String(row.conversation_id),
    ...(row.created_at instanceof Date ? { createdAt: row.created_at } : {}),
    id: String(row.id),
    senderType: String(row.sender_type) as MessageSenderType,
    serverSequence: Number(row.server_sequence),
    ...(typeof row.grounded === 'boolean' ? { grounded: row.grounded } : {}),
    ...(Array.isArray(row.sources)
      ? { sources: row.sources.filter((source): source is string => typeof source === 'string') }
      : {}),
  };
}

export class AssistanceSupportRepository {
  constructor(
    private readonly pool: Pool,
    private readonly notifications = new NotificationRepository(pool),
  ) {}

  async createConversation(customerUserId: string, input: { contextId?: string; contextType?: ConversationContextType; title?: string }) {
    const contextType = input.contextType ?? 'GENERAL';
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO conversations (customer_user_id, context_type, context_id, title)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [customerUserId, contextType, input.contextId ?? null, input.title ?? null],
    );
    return mapConversation(result.rows[0]!);
  }

  async listForActor(actor: ConversationActor) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM conversations
       WHERE ($1 = 'CUSTOMER' AND customer_user_id = $2)
           OR ($1 = 'SUPPORT_STAFF' AND assigned_support_user_id = $2)
           OR $1 = 'SYSTEM_ADMIN'
       ORDER BY updated_at DESC`,
      [actor.role, actor.sub],
    );
    return result.rows.map(mapConversation);
  }

  async listSupportQueue(actor: ConversationActor) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM conversations
       WHERE status = 'WAITING_SUPPORT'
          OR (status = 'SUPPORT_ACTIVE' AND ($1 = 'SYSTEM_ADMIN' OR assigned_support_user_id = $2))
       ORDER BY created_at ASC`,
      [actor.role, actor.sub],
    );
    return result.rows.map(mapConversation);
  }

  async findConversationForActor(actor: ConversationActor, conversationId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM conversations
       WHERE id = $1 AND (
         ($2 = 'CUSTOMER' AND customer_user_id = $3) OR
         ($2 = 'SUPPORT_STAFF' AND assigned_support_user_id = $3) OR
         $2 = 'SYSTEM_ADMIN'
       )`,
      [conversationId, actor.role, actor.sub],
    );
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async listMessages(actor: ConversationActor, conversationId: string) {
    const conversation = await this.findConversationForActor(actor, conversationId);
    if (!conversation) return null;
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY server_sequence`,
      [conversationId],
    );
    return result.rows.map(mapMessage);
  }

  async requestSupport(customerUserId: string, conversationId: string) {
    return this.transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations
         SET status = 'WAITING_SUPPORT', version = version + 1, updated_at = now()
         WHERE id = $1 AND customer_user_id = $2 AND status = 'AI_ACTIVE'
         RETURNING *`,
        [conversationId, customerUserId],
      );
      if (!result.rows[0]) throw new Error('CONVERSATION_STATE_INVALID');
      const supportUsers = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE role = 'SUPPORT_STAFF' AND status = 'ACTIVE'`,
      );
      for (const supportUser of supportUsers.rows) {
        await this.notifications.enqueueInTransaction(client, {
          channel: 'IN_APP',
          content: 'Có một hội thoại mới đang chờ hỗ trợ.',
          data: { conversationId },
          eventKey: `conversation:${conversationId}:waiting-support`,
          title: 'Hội thoại cần hỗ trợ',
          type: 'SUPPORT_REQUESTED',
          userId: supportUser.id,
        });
      }
      return mapConversation(result.rows[0]);
    });
  }

  async claimConversation(supportUserId: string, conversationId: string) {
    return this.transaction(async (client) => {
      const locked = await client.query<Record<string, unknown>>(
        'SELECT * FROM conversations WHERE id = $1 FOR UPDATE',
        [conversationId],
      );
      const current = locked.rows[0] ? mapConversation(locked.rows[0]) : null;
      if (!current) throw new Error('CONVERSATION_NOT_FOUND');
      if (current.status === 'CLOSED' || (current.assignedSupportUserId && current.assignedSupportUserId !== supportUserId)) {
        throw new Error('CONVERSATION_ALREADY_CLAIMED');
      }
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations
         SET assigned_support_user_id = $2, claimed_at = COALESCE(claimed_at, now()),
             status = 'SUPPORT_ACTIVE', version = version + 1, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [conversationId, supportUserId],
      );
      const conversation = mapConversation(result.rows[0]!);
      await this.notifications.enqueueInTransaction(client, {
        channel: 'IN_APP',
        content: 'Hội thoại của bạn đã được nhân viên hỗ trợ tiếp nhận.',
        data: { conversationId },
        eventKey: `conversation:${conversationId}:claimed:${supportUserId}`,
        title: 'Đã tiếp nhận yêu cầu hỗ trợ',
        type: 'SUPPORT_ASSIGNED',
        userId: conversation.customerUserId,
      });
      return conversation;
    });
  }

  async closeConversation(actor: ConversationActor, conversationId: string) {
    return this.transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations SET status = 'CLOSED', closed_at = now(), version = version + 1, updated_at = now()
         WHERE id = $1 AND status <> 'CLOSED' AND (
           ($2 = 'CUSTOMER' AND customer_user_id = $3) OR
           ($2 = 'SUPPORT_STAFF' AND assigned_support_user_id = $3) OR
           $2 = 'SYSTEM_ADMIN'
         ) RETURNING *`,
        [conversationId, actor.role, actor.sub],
      );
      if (!result.rows[0]) throw new Error('CONVERSATION_CLOSE_NOT_ALLOWED');
      return mapConversation(result.rows[0]);
    });
  }

  async appendMessage(input: {
    actorUserId: string;
    clientMessageId: string;
    content: string;
    conversationId: string;
    senderType: Extract<MessageSenderType, 'CUSTOMER' | 'SUPPORT'>;
  }) {
    return this.transaction(async (client) => {
      const locked = await client.query<Record<string, unknown>>(
        'SELECT * FROM conversations WHERE id = $1 FOR UPDATE',
        [input.conversationId],
      );
      const conversation = locked.rows[0] ? mapConversation(locked.rows[0]) : null;
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
      if (conversation.status === 'CLOSED') throw new Error('CONVERSATION_CLOSED');
      if (input.senderType === 'CUSTOMER' && conversation.customerUserId !== input.actorUserId) throw new Error('CONVERSATION_ACCESS_DENIED');
      if (input.senderType === 'SUPPORT' && conversation.assignedSupportUserId !== input.actorUserId) throw new Error('CONVERSATION_ACCESS_DENIED');

      const existing = await client.query<Record<string, unknown>>(
        `SELECT * FROM messages WHERE conversation_id = $1 AND client_message_id = $2`,
        [input.conversationId, input.clientMessageId],
      );
      if (existing.rows[0]) return mapMessage(existing.rows[0]);

      const sequence = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(server_sequence), 0) + 1 AS next_sequence
         FROM messages WHERE conversation_id = $1`,
        [input.conversationId],
      );
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO messages (conversation_id, sender_user_id, sender_type, client_message_id, server_sequence, content)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [input.conversationId, input.actorUserId, input.senderType, input.clientMessageId, Number(sequence.rows[0]!.next_sequence), input.content],
      );
      await client.query(
        `UPDATE conversations SET last_message_at = now(), updated_at = now(),
          status = CASE WHEN $2 = 'CUSTOMER' AND status = 'AI_ACTIVE' THEN 'WAITING_SUPPORT' ELSE status END,
          version = version + 1 WHERE id = $1`,
        [input.conversationId, input.senderType],
      );
      return mapMessage(inserted.rows[0]!);
    });
  }

  async appendAiMessage(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean }) {
    return this.transaction(async (client) => {
      await client.query('SELECT id FROM conversations WHERE id = $1 FOR UPDATE', [input.conversationId]);
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO messages (conversation_id, sender_type, client_message_id, server_sequence, content, grounded, sources)
         SELECT $1, 'AI', $2, COALESCE(MAX(server_sequence), 0) + 1, $3, $4, $5::jsonb
         FROM messages WHERE conversation_id = $1
         ON CONFLICT (conversation_id, client_message_id) DO UPDATE SET content = messages.content
         RETURNING *`,
        [input.conversationId, input.clientMessageId, input.content, input.grounded, JSON.stringify(input.citedSourceIds)],
      );
      return mapMessage(result.rows[0]!);
    });
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
