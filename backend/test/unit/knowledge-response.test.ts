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
  it('returns document chunks scoped to the provider', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'document', title: 'Guide', logical_document_key: 'guide', version: 1, status: 'READY', is_current: true }] })
      .mockResolvedValueOnce({ rows: [{ content: 'one' }, { content: 'two' }] });
    const repository = new KnowledgeRepository({ query } as unknown as Pool);
    await expect(repository.detail({ sub: 'provider', role: 'PROVIDER_ADMIN', sessionVersion: 1 }, 'document')).resolves.toMatchObject({ chunks: ['one', 'two'], isCurrent: true });
  });

  it('rejects publishing when the current version changed', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ version: 3 }] });
    const client = { query, release: vi.fn() };
    const repository = new KnowledgeRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool);
    await expect(repository.publish({ sub: 'provider', role: 'PROVIDER_ADMIN', sessionVersion: 1 }, 'document', 2)).rejects.toThrow('KNOWLEDGE_VERSION_CONFLICT');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });

});
