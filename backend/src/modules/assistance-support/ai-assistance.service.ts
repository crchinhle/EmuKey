import { createHash } from 'node:crypto';

import type { AiGatewayPort, GroundingSource } from './application/ports/ai-gateway.port.js';

export interface KnowledgeSearchPort {
  searchSources(input: { conversationId: string; customerUserId: string; question: string }): Promise<GroundingSource[]>;
  appendAiMessage(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean }): Promise<unknown>;
}

export class AiAssistanceService {
  constructor(
    private readonly gateway: AiGatewayPort,
    private readonly knowledge: KnowledgeSearchPort,
  ) {}

  async answer(input: { conversationId: string; customerUserId: string; question: string; clientMessageId?: string }) {
    const sources = await this.knowledge.searchSources(input);
    const clientMessageId = input.clientMessageId ?? stableEventUuid(`${input.conversationId}:${input.question}`);
    if (sources.length === 0) {
      const refusal = {
        answer: 'Không đủ nguồn chính thức để trả lời câu hỏi này.',
        citedSourceIds: [],
        grounded: false,
      } as const;
      await this.knowledge.appendAiMessage({
        clientMessageId,
        conversationId: input.conversationId,
        content: refusal.answer,
        citedSourceIds: [],
        grounded: false,
      });
      return refusal;
    }
    let result;
    try {
      result = await this.gateway.answerGrounded({ question: input.question, sources });
    } catch {
      return this.persistRefusal(clientMessageId, input.conversationId);
    }
    const sourceIds = new Set(sources.map((source) => source.id));
    if (!result.grounded) {
      const refusal = {
        answer: 'Không đủ nguồn chính thức để trả lời câu hỏi này.',
        citedSourceIds: [],
        grounded: false,
      } as const;
      await this.knowledge.appendAiMessage({
        clientMessageId,
        conversationId: input.conversationId,
        content: refusal.answer,
        citedSourceIds: [],
        grounded: false,
      });
      return refusal;
    }
    if (result.citedSourceIds.some((id) => !sourceIds.has(id))) {
      return this.persistRefusal(clientMessageId, input.conversationId);
    }
    await this.knowledge.appendAiMessage({
      clientMessageId,
      conversationId: input.conversationId,
      content: result.answer,
      citedSourceIds: result.citedSourceIds,
      grounded: result.grounded,
    });
    return result;
  }

  private async persistRefusal(clientMessageId: string, conversationId: string) {
    const answer = 'Không đủ nguồn chính thức để trả lời câu hỏi này.';
    await this.knowledge.appendAiMessage({ clientMessageId, conversationId, content: answer, citedSourceIds: [], grounded: false });
    return { answer, citedSourceIds: [], grounded: false } as const;
  }
}

function stableEventUuid(value: string): string {
  const bytes = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  bytes[12] = '5';
  bytes[16] = ((Number.parseInt(bytes[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${bytes.slice(0, 8).join('')}-${bytes.slice(8, 12).join('')}-${bytes.slice(12, 16).join('')}-${bytes.slice(16, 20).join('')}-${bytes.slice(20).join('')}`;
}
