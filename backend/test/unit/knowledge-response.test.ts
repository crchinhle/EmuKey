import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { KnowledgeRepository } from '../../src/modules/assistance-support/infrastructure/knowledge.repository.js';

describe('knowledge public response', () => {
  it('creates a new version and returns a ready DTO', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT id FROM products')) return Promise.resolve({ rows: [{ id: 'product' }] });
      if (sql.includes('MAX(version)')) return Promise.resolve({ rows: [{ next_version: 2 }] });
      if (sql.startsWith('INSERT INTO knowledge_documents')) return Promise.resolve({ rows: [{ id: 'new-doc' }] });
      return Promise.resolve({ rows: [] });
    });
    const release = vi.fn();
    const repository = new KnowledgeRepository({ connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool);
    expect(await repository.create({ sub: 'provider', role: 'PROVIDER_ADMIN', sessionVersion: 1 }, { productId: 'product', logicalDocumentKey: 'guide', title: 'Guide', sourceType: 'FAQ', chunks: ['Instructions'] })).toEqual({ id: 'new-doc', title: 'Guide', logicalDocumentKey: 'guide', version: 2, status: 'READY', isCurrent: false });
    expect(release).toHaveBeenCalledOnce();
  });
  it('maps database fields to the API contract without storage internals', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'document', title: 'Guide', logical_document_key: 'guide', version: 1, status: 'READY', is_current: true, storage_key: 'private' }] });
    const repository = new KnowledgeRepository({ query } as unknown as Pool);
    expect(await repository.list({ sub: 'provider', role: 'PROVIDER_ADMIN', sessionVersion: 1 })).toEqual([
      { id: 'document', title: 'Guide', logicalDocumentKey: 'guide', version: 1, status: 'READY', isCurrent: true },
    ]);
  });
});
