import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { PDFParse } from 'pdf-parse';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { PrivateStoragePort } from '../../../platform/storage/private-storage.port.js';

export class KnowledgeRepository {
  constructor(private readonly pool: Pool, private readonly storage?: PrivateStoragePort, private readonly limits = { maxFileBytes: 10_485_760, maxChunks: 500, maxChunkBytes: 12_000, allowedMimeTypes: ['application/pdf', 'text/plain'] }) {}
  async create(actor: AuthPrincipal, input: { chunks?: string[]; file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }; logicalDocumentKey: string; productId: string; sourceType: string; title: string; version?: number }) {
    const client = await this.pool.connect();
    let storageKey: string | null = null;
    try {
      await client.query('BEGIN');
       const version = input.version ?? 1;
       if (input.file && (!this.storage || input.file.size > this.limits.maxFileBytes || !this.limits.allowedMimeTypes.includes(input.file.mimetype) || !validFile(input.file) || (input.sourceType === 'PDF' && input.file.mimetype !== 'application/pdf') || (input.sourceType === 'TXT' && input.file.mimetype !== 'text/plain'))) throw new Error('KNOWLEDGE_FILE_NOT_ALLOWED');
        const chunks = input.chunks ?? (input.file ? await extractChunks(input.file) : []);
       if (chunks.length === 0 || chunks.length > this.limits.maxChunks || chunks.some((chunk) => Buffer.byteLength(chunk, 'utf8') > this.limits.maxChunkBytes)) throw new Error('KNOWLEDGE_CHUNK_LIMIT');
       storageKey = input.file ? `knowledge/${actor.sub}/${input.logicalDocumentKey}/${version}-${createHash('sha256').update(input.file.buffer).digest('hex')}` : null;
       if (input.file && storageKey) await this.storage!.put(storageKey, input.file.buffer, input.file.mimetype);
       const document = await client.query<{ id: string }>(`INSERT INTO knowledge_documents (provider_user_id, product_id, logical_document_key, version, source_type, title, storage_key, storage_mime_type, storage_size_bytes, checksum, status) SELECT $1, id, $2, $3, $4, $5, $6, $7, $8, decode($9, 'hex'), 'PROCESSING' FROM products WHERE id = $10 AND provider_user_id = $1 RETURNING id`, [actor.sub, input.logicalDocumentKey, version, input.sourceType, input.title, storageKey, input.file?.mimetype ?? null, input.file?.size ?? null, input.file ? createHash('sha256').update(input.file.buffer).digest('hex') : null, input.productId]);
       if (!document.rows[0]) throw new Error('KNOWLEDGE_PRODUCT_NOT_FOUND');
       for (const [index, content] of chunks.entries()) await client.query(`INSERT INTO knowledge_chunks (document_id, chunk_index, content, token_count) VALUES ($1, $2, $3, $4)`, [document.rows[0].id, index, content, content.split(/\s+/u).length]);
       await client.query(`UPDATE knowledge_documents SET status = 'READY', updated_at = now() WHERE id = $1`, [document.rows[0].id]);
      await client.query('COMMIT');
      return document.rows[0];
    } catch (error) { await client.query('ROLLBACK'); if (storageKey) await this.storage?.delete(storageKey).catch(() => undefined); throw error; } finally { client.release(); }
  }
  async list(actor: AuthPrincipal): Promise<Record<string, unknown>[]> { const result = await this.pool.query<Record<string, unknown>>(`SELECT * FROM knowledge_documents WHERE provider_user_id = $1 ORDER BY logical_document_key, version DESC`, [actor.sub]); return result.rows; }
  async publish(actor: AuthPrincipal, id: string) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); await client.query(`UPDATE knowledge_documents SET is_current = FALSE, updated_at = now() WHERE provider_user_id = $1 AND logical_document_key = (SELECT logical_document_key FROM knowledge_documents WHERE id = $2 AND provider_user_id = $1)`, [actor.sub, id]); const result = await client.query<Record<string, unknown>>(`UPDATE knowledge_documents SET is_current = TRUE, updated_at = now() WHERE id = $1 AND provider_user_id = $2 AND status = 'READY' RETURNING *`, [id, actor.sub]); if (!result.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND'); await client.query('COMMIT'); return result.rows[0]; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async search(actor: AuthPrincipal, question: string): Promise<Array<{ id: string; content: string }>> {
    const result = await this.pool.query<{ id: string; content: string }>(
      `SELECT kc.id::text AS id, kc.content
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.status = 'READY' AND kd.is_current
         AND (
           $2 = 'SYSTEM_ADMIN' OR
           ($2 = 'PROVIDER_ADMIN' AND kd.provider_user_id = $1) OR
           ($2 = 'CUSTOMER' AND kd.product_id IN (
             SELECT product_id FROM licenses WHERE customer_user_id = $1
           ))
         )
       ORDER BY CASE WHEN lower(kc.content) LIKE '%' || lower($3) || '%' THEN 0 ELSE 1 END LIMIT 5`,
      [actor.sub, actor.role, question],
    );
    return result.rows;
  }

  async searchForConversation(input: { conversationId: string; customerUserId: string; question: string }): Promise<Array<{ id: string; content: string }>> {
    const result = await this.pool.query<{ id: string; content: string }>(
      `SELECT kc.id::text AS id, kc.content
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       JOIN conversations c ON c.id = $1 AND c.customer_user_id = $2
       WHERE kd.status = 'READY' AND kd.is_current
         AND kd.product_id IN (
           SELECT product_id FROM licenses WHERE customer_user_id = $2
         )
         AND (c.context_type = 'GENERAL' OR
              (c.context_type = 'PRODUCT' AND c.context_id = kd.product_id) OR
              (c.context_type = 'LICENSE' AND EXISTS (
                SELECT 1 FROM licenses l WHERE l.id = c.context_id AND l.customer_user_id = $2 AND l.product_id = kd.product_id
              )))
       ORDER BY CASE WHEN lower(kc.content) LIKE '%' || lower($3) || '%' THEN 0 ELSE 1 END,
                kc.created_at DESC LIMIT 5`,
      [input.conversationId, input.customerUserId, input.question],
    );
    return result.rows;
  }
}

function chunkText(content: string): string[] {
  const normalized = content.replaceAll('\u0000', '').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += 10_000) chunks.push(normalized.slice(index, index + 10_000));
  return chunks;
}

function validFile(file: { originalname: string; mimetype: string; buffer: Buffer }): boolean {
  const extension = file.originalname.toLowerCase().split('.').pop();
  if (file.mimetype === 'application/pdf') return extension === 'pdf' && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  return extension === 'txt' && !file.buffer.includes(0);
}

async function extractChunks(file: { mimetype: string; buffer: Buffer }): Promise<string[]> {
  if (file.mimetype === 'text/plain') return chunkText(file.buffer.toString('utf8'));
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return chunkText(result.text);
  } finally {
    await parser.destroy();
  }
}
