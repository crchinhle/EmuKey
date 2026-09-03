import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('W09-W11 Buyer hub', () => {
  it('opens the selected order detail', async () => {
    render(<App initialEntries={['/buyer/orders']} />);

    fireEvent.click(screen.getByRole('button', { name: /ORD-2026-0218/i }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('SecureDesk Pro').length).toBeGreaterThan(0);
  });

  it('keeps the demo license key hidden until requested', () => {
    render(<App initialEntries={['/buyer/licenses']} />);

    expect(screen.queryByText('DEMO-ONLY-9K2M')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện key demo' }));
    expect(screen.getByText('DEMO-ONLY-9K2M')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép key demo' }));
    expect(screen.getByText('Đã sao chép key demo')).toBeTruthy();
  });

  it('appends a local support message', () => {
    render(<App initialEntries={['/buyer/support']} />);

    fireEvent.change(screen.getByLabelText('Tin nhắn hỗ trợ'), {
      target: { value: 'Tôi cần kiểm tra thiết bị mới.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(screen.getByText('Tôi cần kiểm tra thiết bị mới.')).toBeTruthy();
  });

  it('inserts an explicitly labelled AI suggestion into the draft', () => {
    render(<App initialEntries={['/buyer/support']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chèn gợi ý AI' }));

    expect(screen.getByLabelText('Tin nhắn hỗ trợ')).toHaveProperty(
      'value',
      expect.stringContaining('Gợi ý demo'),
    );
  });
});
