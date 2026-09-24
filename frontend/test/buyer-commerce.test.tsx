import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('Customer commerce', () => {
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
    expect(screen.getByText(/Đơn hàng và License sẽ được gắn với tài khoản Emukey/)).toBeTruthy();
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

  it('continues from accepted payment to trusted license without retrieving a key automatically', async () => {
    render(
      <App
        initialEntries={[
          '/buyer/orders/00000000-0000-4000-8000-000000000502/payment',
        ]}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Bản quyền đã sẵn sàng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhận mã kích hoạt' })).toBeTruthy();
    expect(screen.queryByText('0x' + '12'.repeat(32))).toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.filter(([input, init]) =>
        (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/activation-key/retrieve') &&
        init?.method === 'POST',
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Nhận mã kích hoạt' }));
    expect(await screen.findByLabelText('Mã kích hoạt')).toBeTruthy();
  });

  it('creates a renewal order only after the current activation key is provided', async () => {
    render(
      <App
        initialEntries={[
          '/buyer/licenses/00000000-0000-4000-8000-000000000401/renew',
        ]}
      />,
    );

    fireEvent.change(await screen.findByLabelText('Activation key hiện tại'), {
      target: { value: 'current-activation-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đơn gia hạn' }));

    expect(
      await screen.findByRole('heading', { name: 'Điều khoản gia hạn' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gia hạn License' })).toBeTruthy();
  });
});
