import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('W05-W08 Buyer commerce', () => {
  it('renders Buyer home from the metric and license arrays', () => {
    render(<App initialEntries={['/buyer']} />);

    expect(
      screen.getByRole('heading', { name: 'Xin chào, Minh An' }),
    ).toBeTruthy();
    expect(screen.getByText('18 / 25')).toBeTruthy();
    expect(screen.getAllByText('CloudStudio AI').length).toBeGreaterThan(0);
  });

  it('requires accepted terms before creating the mock contract', () => {
    render(<App initialEntries={['/buyer/checkout']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tạo hợp đồng' }));

    expect(screen.getByRole('alert').textContent).toContain('điều khoản');
  });

  it('moves from signing to the matching mock payment screen', async () => {
    render(<App initialEntries={['/buyer/contracts/ORD-2026-0218/sign']} />);

    fireEvent.change(screen.getByLabelText('Mã xác nhận OTP'), {
      target: { value: '123456' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: /đọc toàn bộ hợp đồng/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ký hợp đồng' }));

    expect(
      await screen.findByRole('heading', { name: 'Thanh toán đơn hàng' }),
    ).toBeTruthy();
    expect(screen.getByText(/mô phỏng/i)).toBeTruthy();
  });
});
