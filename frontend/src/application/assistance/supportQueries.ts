import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '../auth/authContext';
import type { ConversationDto, MessageDto } from './assistanceQueries';

export function useSupportQueue() {
  return useQuery({ queryKey: ['assistance', 'support-queue'], queryFn: () => requestJson<ConversationDto[]>('/conversations/queue') });
}

export function useClaimConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => requestJson<ConversationDto>(`/conversations/${conversationId}/claim`, { method: 'POST' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['assistance'] }); },
  });
}

export function useSupportConversationMessages(conversationId: string | undefined) {
  return useQuery({
    enabled: Boolean(conversationId),
    queryKey: ['assistance', 'messages', conversationId],
    queryFn: () => requestJson<MessageDto[]>(`/conversations/${conversationId}/messages`),
  });
}

export function useAppendSupportMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, clientMessageId, content }: { conversationId: string; clientMessageId: string; content: string }) =>
      requestJson<MessageDto>(`/conversations/${conversationId}/messages`, {
        body: JSON.stringify({ clientMessageId, content }),
        method: 'POST',
      }),
    onSuccess: (_message, input) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', input.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
    },
  });
}
