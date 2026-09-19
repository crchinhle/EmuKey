import { ForbiddenException } from '@nestjs/common';
import type { AuthPrincipal } from '../identity-access/identity.types.js';

export class KnowledgeService {
  constructor(private readonly repository: {
     create(actor: AuthPrincipal, input: { chunks?: string[]; file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }; logicalDocumentKey: string; productId: string; sourceType: string; title: string; version?: number }): Promise<unknown>;
    list(actor: AuthPrincipal): Promise<unknown[]>;
    publish(actor: AuthPrincipal, id: string): Promise<unknown>;
    search(actor: AuthPrincipal, question: string): Promise<Array<{ content: string; id: string }>>;
  }) {}

  create(actor: AuthPrincipal, input: Parameters<KnowledgeService['repository']['create']>[1]) {
    this.requireProvider(actor);
    return this.repository.create(actor, input);
  }
  list(actor: AuthPrincipal) { this.requireProvider(actor); return this.repository.list(actor); }
  publish(actor: AuthPrincipal, id: string) { this.requireProvider(actor); return this.repository.publish(actor, id); }
  search(actor: AuthPrincipal, question: string) {
    if (!['CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) throw new ForbiddenException();
    return this.repository.search(actor, question);
  }
  private requireProvider(actor: AuthPrincipal) { if (actor.role !== 'PROVIDER_ADMIN' && actor.role !== 'SYSTEM_ADMIN') throw new ForbiddenException(); }
}
