import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AssistanceSupportRepository } from '../../../src/modules/assistance-support/infrastructure/assistance-support.repository.js';

const runIntegration = process.env.RUN_PHASE7_INTEGRATION === 'true';

describe.skipIf(!runIntegration)('Phase 7 assistance PostgreSQL integration', () => {
  let client: Pool;
  let repository: AssistanceSupportRepository;
  const customerId = '00000000-0000-4000-8000-000000000004';
  const supportId = '00000000-0000-4000-8000-000000000003';

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('pgvector/pgvector:pg15').withDatabase('emukey_phase7').withUsername('emukey').withPassword('phase7-password').start();
    client = new Pool({ connectionString: container.getConnectionUri() });
    await client.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
    await client.query(`INSERT INTO users (id,email,password_hash,display_name,role,status,customer_type,email_verified_at) VALUES
      ($1,'phase7-customer@example.test','hash','Phase 7 Customer','CUSTOMER','ACTIVE','INDIVIDUAL',now()),
      ($2,'phase7-support@example.test','hash','Phase 7 Support','SUPPORT_STAFF','ACTIVE',NULL,NULL)`, [customerId, supportId]);
    repository = new AssistanceSupportRepository(client);
  }, 120_000);

  afterAll(async () => { await client?.end(); });

  it('creates, appends idempotently, claims concurrently, and closes a conversation', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Phase 7 real flow' });
    const first = await repository.appendMessage({ actorUserId: customerId, clientMessageId: '00000000-0000-4000-8000-000000000701', content: 'Xin hỗ trợ', conversationId: conversation.id, senderType: 'CUSTOMER' });
    const duplicate = await repository.appendMessage({ actorUserId: customerId, clientMessageId: first.clientMessageId, content: 'Xin hỗ trợ', conversationId: conversation.id, senderType: 'CUSTOMER' });
    expect(duplicate.id).toBe(first.id);
    const claims = await Promise.allSettled([repository.claimConversation(supportId, conversation.id), repository.claimConversation('00000000-0000-4000-8000-000000000002', conversation.id)]);
    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    expect((await repository.closeConversation({ role: 'SUPPORT_STAFF', sub: supportId }, conversation.id)).status).toBe('CLOSED');
  });
});
