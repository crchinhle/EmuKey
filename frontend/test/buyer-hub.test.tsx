import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('Customer hub', () => {
  it('opens the selected order detail', async () => {
    render(<App initialEntries={['/buyer/orders']} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /ORD-2026-0218/i }),
    );
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByText('SecureDesk Pro')).toBeTruthy();
  });

  it('retrieves the activation key from the backend only after an explicit request', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    const key = '0x' + '12'.repeat(32);
    expect(screen.queryByText(key)).toBeNull();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Nhận activation key' }),
    );
    expect(await screen.findByText(key)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Sao chép activation key' }),
    );
    expect(screen.getByText('Đã sao chép activation key')).toBeTruthy();
  });

  it('updates the authenticated Customer profile through the real profile endpoint', async () => {
    render(<App initialEntries={['/buyer/profile']} />);

    fireEvent.change(await screen.findByLabelText('Tên hiển thị'), {
      target: { value: 'Khách hàng Emukey' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Đã cập nhật hồ sơ.')).toBeTruthy();
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
