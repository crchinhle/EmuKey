import { ConflictException, ForbiddenException } from '@nestjs/common';

import { AssistanceSupportService } from '../../src/modules/assistance-support/assistance-support.service.js';

const customer = { role: 'CUSTOMER' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000004' };
const support = { role: 'SUPPORT_STAFF' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000005' };
const conversation = {
  assignedSupportUserId: null,
  contextId: null,
  contextType: 'GENERAL',
  customerUserId: customer.sub,
  id: '00000000-0000-4000-8000-000000000701',
  status: 'AI_ACTIVE',
  title: 'Activation help',
};

function fixture() {
  const repository = {
    appendMessage: vi.fn().mockResolvedValue({
      clientMessageId: '00000000-0000-4000-8000-000000000702',
      content: 'Hello',
      conversationId: conversation.id,
      senderType: 'CUSTOMER',
      serverSequence: 1,
    }),
    claimConversation: vi.fn().mockResolvedValue({ ...conversation, assignedSupportUserId: support.sub, status: 'SUPPORT_ACTIVE' }),
    closeConversation: vi.fn().mockResolvedValue({ ...conversation, status: 'CLOSED' }),
    createConversation: vi.fn().mockResolvedValue(conversation),
    findConversationForActor: vi.fn().mockResolvedValue(conversation),
    listForActor: vi.fn().mockResolvedValue([conversation]),
    requestSupport: vi.fn().mockResolvedValue({ ...conversation, status: 'WAITING_SUPPORT' }),
  };
  return { repository, service: new AssistanceSupportService(repository as never) };
}

describe('AssistanceSupportService', () => {
  it('allows an owned customer to create and append an idempotent message', async () => {
    const { repository, service } = fixture();

    await expect(service.createConversation(customer, { title: 'Activation help' })).resolves.toEqual(conversation);
    await expect(service.appendMessage(customer, conversation.id, {
      clientMessageId: '00000000-0000-4000-8000-000000000702',
      content: 'Hello',
    })).resolves.toMatchObject({ serverSequence: 1 });
    expect(repository.appendMessage).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: customer.sub,
      conversationId: conversation.id,
      senderType: 'CUSTOMER',
    }));
  });

  it('rejects a support actor from appending before claiming the conversation', async () => {
    const { repository, service } = fixture();
    repository.findConversationForActor.mockResolvedValueOnce({ ...conversation, assignedSupportUserId: null });

    await expect(service.appendMessage(support, conversation.id, {
      clientMessageId: '00000000-0000-4000-8000-000000000703',
      content: 'Reply',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.appendMessage).not.toHaveBeenCalled();
  });

  it('maps a second support claim to a conflict', async () => {
    const { repository, service } = fixture();
    repository.claimConversation.mockRejectedValueOnce(new Error('CONVERSATION_ALREADY_CLAIMED'));

    await expect(service.claim(support, conversation.id)).rejects.toBeInstanceOf(ConflictException);
  });
});
