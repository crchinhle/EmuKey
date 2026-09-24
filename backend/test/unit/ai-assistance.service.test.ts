import { AiAssistanceService } from '../../src/modules/assistance-support/ai-assistance.service.js';

describe('AiAssistanceService', () => {
  it('refuses when no provider-scoped source is available', async () => {
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn() },
      { searchSources: vi.fn().mockResolvedValue([]), appendAiMessage: vi.fn() },
    );

    await expect(service.answer({ conversationId: '00000000-0000-4000-8000-000000000701', customerUserId: 'u1', question: 'How?' }))
      .resolves.toMatchObject({ grounded: false, citedSourceIds: [] });
  });

  it('preserves a caller request id for transport retries', async () => {
    const append = vi.fn();
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockResolvedValue({ answer: 'safe', citedSourceIds: ['source-1'], grounded: true }) },
      { searchSources: vi.fn().mockResolvedValue([{ content: 'source', id: 'source-1' }]), appendAiMessage: append },
    );

    await service.answer({ conversationId: '00000000-0000-4000-8000-000000000701', customerUserId: 'u1', question: 'How?', clientMessageId: '00000000-0000-4000-8000-000000000702' });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ clientMessageId: '00000000-0000-4000-8000-000000000702' }));
  });

  it('refuses an AI gateway citation that was not retrieved', async () => {
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockResolvedValue({ answer: 'unsafe', citedSourceIds: ['other'], grounded: true }) },
      { searchSources: vi.fn().mockResolvedValue([{ content: 'source', id: 'source-1' }]), appendAiMessage: vi.fn() },
    );

    await expect(service.answer({ conversationId: '00000000-0000-4000-8000-000000000701', customerUserId: 'u1', question: 'How?' }))
      .resolves.toMatchObject({ grounded: false, citedSourceIds: [] });
  });
});
