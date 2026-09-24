import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestJson } from '../auth/authContext';

export interface NotificationRecord {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly isRead: boolean;
  readonly createdAt?: string;
  readonly type?: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => requestJson<NotificationRecord[]>('/notifications'),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestJson<NotificationRecord>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
