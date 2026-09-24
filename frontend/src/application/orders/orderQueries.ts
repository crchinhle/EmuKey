import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '../auth/authContext';
import type {
  CheckoutSessionDto,
  CreateOrderDto,
  OrderDto,
  OrderTermsDto,
  PaymentHistoryDto,
} from '../../infrastructure/api/generated';

export type OrderSummary = OrderDto;
export type OrderDetail = OrderDto;
export type PaymentAttempt = CheckoutSessionDto;

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => requestJson<OrderSummary[]>('/orders'),
  });
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: ['payments', 'history'],
    queryFn: () => requestJson<PaymentHistoryDto[]>('/payments/history'),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => requestJson<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    // Keep the return page in sync until the payment callback projects the
    // accepted state. Downstream chain state is polled by useOrderLicense.
    refetchInterval: (query) =>
      query.state.data?.orderStatus === 'WAITING_PAYMENT' ? 2_000 : false,
  });
}

export function useOrderTerms(id: string) {
  return useQuery({
    queryKey: ['orders', id, 'terms'],
    queryFn: () =>
      requestJson<OrderTermsDto>(`/orders/${encodeURIComponent(id)}/service-terms`),
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOrderMutations() {
  const queryClient = useQueryClient();
  const refresh = (order?: OrderSummary) => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    if (order)
      void queryClient.invalidateQueries({ queryKey: ['orders', order.id] });
  };
  return {
    create: useMutation({
      mutationFn: async (input: CreateOrderDto & { licenseKey?: string }) => {
        const { licenseKey, ...body } = input;
        const order = await requestJson<OrderDetail>('/orders', {
          method: 'POST',
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
            ...(licenseKey ? { 'X-License-Key': licenseKey } : {}),
          },
          body: JSON.stringify(body),
        });
        return order;
      },
      onSuccess: refresh,
    }),
    acceptServiceTerms: useMutation({
      mutationFn: (order: OrderDetail) =>
        requestJson<OrderDetail>(
          `/orders/${encodeURIComponent(order.id)}/accept-service-terms`,
          {
            method: 'POST',
            body: JSON.stringify({
              accepted: true,
            }),
          },
        ),
      onSuccess: refresh,
    }),
    checkout: useMutation({
      mutationFn: (id: string) =>
        requestJson<PaymentAttempt>(
          `/orders/${encodeURIComponent(id)}/checkout`,
          {
            method: 'POST',
          },
        ),
    }),
    cancel: useMutation({
      mutationFn: (id: string) =>
        requestJson<OrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`, {
          method: 'POST',
        }),
      onSuccess: refresh,
    }),
  };
}

export function orderStatusLabel(
  order: Pick<OrderSummary, 'orderStatus'>,
): string {
  if (order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE')
    return 'Chờ đồng ý Service Terms';
  if (order.orderStatus === 'WAITING_PAYMENT') return 'Chờ thanh toán';
  if (order.orderStatus === 'PAYMENT_ACCEPTED') return 'Đã nhận thanh toán';
  if (order.orderStatus === 'CANCELLED') return 'Đã hủy';
  return 'Đã hết hạn';
}

export function orderStatusTone(
  order: Pick<OrderSummary, 'orderStatus'>,
): 'success' | 'warning' | 'error' | 'neutral' {
  if (order.orderStatus === 'PAYMENT_ACCEPTED') return 'success';
  if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'EXPIRED')
    return 'error';
  if (order.orderStatus === 'WAITING_PAYMENT') return 'warning';
  return 'neutral';
}
