import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('Customer commerce', () => {
  it('renders the authenticated Customer home from real API arrays', async () => {
    render(<App initialEntries={['/buyer']} />);

    expect(
      screen.getByRole('heading', { name: 'Tổng quan tài khoản người mua' }),
    ).toBeTruthy();
    expect((await screen.findAllByText('SecureDesk Pro')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dữ liệu tài khoản thật')).toHaveLength(2);
    expect(screen.queryByText('CloudStudio AI')).toBeNull();
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
    expect(screen.getByText(/chỉ thay đổi sau khi thanh toán và blockchain đạt finality/i)).toBeTruthy();
  });
});
