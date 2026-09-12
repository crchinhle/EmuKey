import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('Customer commerce', () => {
  it('renders the authenticated Customer home from the metric and license arrays', () => {
    render(<App initialEntries={['/buyer']} />);

    expect(
      screen.getByRole('heading', { name: 'Tổng quan tài khoản người mua' }),
    ).toBeTruthy();
    expect(screen.getByText('18 / 25')).toBeTruthy();
    expect(screen.getAllByText('CloudStudio AI').length).toBeGreaterThan(0);
  });

  it('creates the server snapshot before asking for Terms acceptance', async () => {
    render(<App initialEntries={['/buyer/checkout']} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo đơn hàng' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Điều khoản cấp phép' }),
    ).toBeTruthy();
    expect(screen.getByText(/Đơn hàng và License sẽ được gắn với tài khoản EmuKey/)).toBeTruthy();
    expect(screen.getByText(/deterministic Terms snapshot/i)).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /đồng ý với điều khoản cấp phép/i }),
    ).toBeTruthy();
  });

  it('creates an order after explicit Terms acceptance and opens payment', async () => {
    render(<App initialEntries={['/buyer/checkout']} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo đơn hàng' }),
    );
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
});
