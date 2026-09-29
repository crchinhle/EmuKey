import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/presentation/app/App';
import { orderStatusLabel } from '../src/application/orders/orderQueries';

afterEach(cleanup);

describe('Customer commerce', () => {
  it('reuses the order idempotency key when retrying a lost response', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const keys: (string | null)[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/orders') && init?.method === 'POST') {
        keys.push(new Headers(init.headers).get('Idempotency-Key'));
        if (keys.length === 1) throw new TypeError('Response lost');
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer/checkout']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Thử tạo lại đơn hàng' }));
      await screen.findByRole('heading', { name: 'Điều khoản cấp phép' });
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBeTruthy();
      expect(keys[1]).toBe(keys[0]);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
  it('labels cancelled and expired orders separately from terms acceptance', () => {
    expect(orderStatusLabel({ orderStatus: 'CANCELLED' })).toBe('Đã hủy');
    expect(orderStatusLabel({ orderStatus: 'EXPIRED' })).toBe('Đã hết hạn');
    expect(orderStatusLabel({ orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE' })).toBe('Chờ đồng ý điều khoản');
  });
  it('renders the authenticated Customer home from real API arrays', async () => {
    render(<App initialEntries={['/buyer']} />);

    expect(
      screen.getByRole('heading', { name: 'Bản quyền và đơn hàng của bạn' }),
    ).toBeTruthy();
    expect(await screen.findByText('Đơn hàng gần đây')).toBeTruthy();
    expect(screen.getByText('Thiết bị đang dùng')).toBeTruthy();
    expect(screen.getByText('Sắp hết hạn trong 30 ngày')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lối tắt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xem sản phẩm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bản quyền của tôi' })).toBeTruthy();
  });

  it('creates the server snapshot before asking for Terms acceptance', async () => {
    render(<App initialEntries={['/buyer/checkout']} />);

    expect(
      await screen.findByRole('heading', { name: 'Điều khoản cấp phép' }),
    ).toBeTruthy();
    expect(screen.getByText(/Đơn hàng và bản quyền sẽ được lưu trong tài khoản EmuKey/)).toBeTruthy();
    expect(screen.getByText(/platform Service Terms/i)).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /đồng ý với điều khoản cấp phép/i }),
    ).toBeTruthy();
  });

  it('creates an order after explicit Terms acceptance and opens payment', async () => {
    render(<App initialEntries={['/buyer/checkout']} />);

    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: /đồng ý với điều khoản cấp phép/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Đồng ý và tiếp tục thanh toán' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Thanh toán đơn hàng' }),
    ).toBeTruthy();
  });

  it('renders the signed SePay checkout as a POST form', async () => {
    render(
      <App
        initialEntries={[
          '/buyer/orders/11111111-1111-4111-8111-111111111111/payment',
        ]}
      />,
    );

    const form = await screen.findByTestId('sepay-checkout-form');
    expect(form.getAttribute('action')).toBe(
      'https://pay-sandbox.sepay.vn/v1/checkout/init',
    );
    expect(form.getAttribute('method')).toBe('post');
    expect(
      screen.getByRole('button', { name: 'Thanh toán trên SePay Sandbox' }),
    ).toBeTruthy();
    expect(
      form.querySelector<HTMLInputElement>('input[name="signature"]')?.value,
    ).toBe('sandbox-signature');
  });

  it.each(['cancel', 'error'])('offers an explicit retry after SePay %s without auto checkout', async (status) => {
    vi.mocked(fetch).mockClear();
    render(<App initialEntries={['/buyer/orders/11111111-1111-4111-8111-111111111111/payment?sepay=' + status]} />);
    expect(await screen.findByRole('button', { name: 'Thanh toán lại' })).toBeTruthy();
    expect(screen.queryByText('Đang xác nhận thanh toán')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/checkout'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    expect(await screen.findByTestId('sepay-checkout-form')).toBeTruthy();
  });

  it('continues from accepted payment to trusted license without retrieving a key automatically', async () => {
    render(
      <App
        initialEntries={[
          '/buyer/orders/00000000-0000-4000-8000-000000000502/payment',
        ]}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Bản quyền đã sẵn sàng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhận mã bản quyền' })).toBeTruthy();
    expect(screen.queryByText('0x' + '12'.repeat(32))).toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.filter(([input, init]) =>
        (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/activation-key/retrieve') &&
        init?.method === 'POST',
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Nhận mã bản quyền' }));
    expect(await screen.findByLabelText('Mã bản quyền')).toBeTruthy();
  });

  it('creates a renewal order without asking for or sending the license secret', async () => {
    vi.mocked(fetch).mockClear();
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const response = await original(input, init);
      if ((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/orders/00000000-0000-4000-8000-000000000501') && !init?.method) {
        return Response.json({ ...await response.json() as Record<string, unknown>, orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE' });
      }
      return response;
    });
    try {
    render(
      <App
        initialEntries={[
          '/buyer/licenses/00000000-0000-4000-8000-000000000401/renew',
        ]}
      />,
    );

    const create = await screen.findByRole('button', { name: 'Tạo đơn gia hạn' });
    expect(screen.getByText('2.500.000 ₫')).toBeTruthy();
    fireEvent.click(create);

    expect(
      await screen.findByRole('heading', { name: 'Điều khoản gia hạn' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gia hạn bản quyền' })).toBeTruthy();
    const request = vi.mocked(fetch).mock.calls.find(([input, init]) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/orders') && init?.method === 'POST');
    expect(request).toBeTruthy();
    expect(new Headers(request?.[1]?.headers).has('X-License-Key')).toBe(false);
    expect(screen.queryByLabelText('Mã bản quyền hiện tại')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it.each(['WAITING_PAYMENT', 'PAYMENT_ACCEPTED'])('resumes an existing renewal in %s without creating another order', async (orderStatus) => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let creates = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.endsWith('/orders') && init?.method === 'POST') creates++;
      const response = await original(input, init);
      const pendingOrder = { id: '00000000-0000-4000-8000-000000000501', orderType: 'RENEWAL', orderStatus, priceVndSnapshot: 2_082_500, planNameSnapshot: 'Business', durationMonthsSnapshot: 12 };
      if (url.includes('/renewal-preview/')) return Response.json({ ...await response.json(), pendingOrder });
      if (url.endsWith('/orders/' + pendingOrder.id) && !init?.method) return Response.json({ ...await response.json(), ...pendingOrder });
      return response;
    });
    try {
      render(<App initialEntries={['/buyer/licenses/00000000-0000-4000-8000-000000000401/renew']} />);
      expect(await screen.findByRole('button', { name: orderStatus === 'WAITING_PAYMENT' ? 'Tiếp tục thanh toán' : 'Theo dõi gia hạn' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Tạo đơn gia hạn' })).toBeNull();
      expect(screen.getByText('2.082.500 ₫')).toBeTruthy();
      expect(creates).toBe(0);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('disables creating a renewal for an unavailable offer', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const response = await original(input, init);
      return (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/renewal-preview/') ? Response.json({ ...await response.json(), canRenew: false }) : response;
    });
    try {
      render(<App initialEntries={['/buyer/licenses/00000000-0000-4000-8000-000000000401/renew']} />);
      expect((await screen.findByRole<HTMLButtonElement>('button', { name: 'Tạo đơn gia hạn' })).disabled).toBe(true);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
});
