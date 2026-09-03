import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('EmuKey public web screens', () => {
  it('renders W01 with the text brand and navigates to the catalog', async () => {
    render(<App initialEntries={['/auth']} />);

    expect(screen.getAllByText('EmuKey').length).toBeGreaterThan(0);
    expect(screen.queryByText('LicenseHub')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Bản quyền phần mềm cho doanh nghiệp hiện đại',
      }),
    ).toBeTruthy();
  });

  it('renders W02 from the product mock array and filters by search text', () => {
    render(<App initialEntries={['/products']} />);

    expect(screen.getByText('SecureDesk Pro')).toBeTruthy();
    expect(screen.getByText('CloudStudio AI')).toBeTruthy();
    expect(screen.getByText('DataGuard SDK')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Tìm sản phẩm'), {
      target: { value: 'cloud' },
    });

    expect(screen.getByText('CloudStudio AI')).toBeTruthy();
    expect(screen.queryByText('DataGuard SDK')).toBeNull();
  });

  it('opens customer registration and returns with the arrow control', async () => {
    render(<App initialEntries={['/auth']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(
      await screen.findByRole('heading', { name: 'Tạo tài khoản' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('combobox', { name: 'Loại khách hàng' }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Quay lại đăng nhập' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Chào mừng trở lại' }),
    ).toBeTruthy();
  });

  it('rejects a registration when password confirmation does not match', async () => {
    render(<App initialEntries={['/auth?mode=register']} />);

    fireEvent.change(screen.getByLabelText('Họ và tên'), {
      target: { value: 'Nguyễn Minh Anh' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'minhanh@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'MatKhauDemo12' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'KhongTrungKhop12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByText('Mật khẩu xác nhận không khớp.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Kiểm tra email để xác minh tài khoản'),
    ).toBeNull();
  });

  it('creates a pending customer registration from valid form values', async () => {
    render(<App initialEntries={['/auth?mode=register']} />);

    fireEvent.change(screen.getByLabelText('Họ và tên'), {
      target: { value: 'Nguyễn Minh Anh' },
    });
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Loại khách hàng' }),
    );
    fireEvent.click(await screen.findByText('Học sinh'));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'minhanh@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'MatKhauDemo12' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'MatKhauDemo12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByRole('status', {
        name: 'Kiểm tra email để xác minh tài khoản',
      }),
    ).toBeTruthy();
  });

  it('shows the generic forgot-password response without exposing account existence', async () => {
    render(<App initialEntries={['/auth']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    expect(
      await screen.findByRole('heading', { name: 'Quên mật khẩu' }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'unknown@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi hướng dẫn' }));

    expect(
      await screen.findByRole('alert', {
        name: 'Yêu cầu đặt lại mật khẩu đã được tiếp nhận',
      }),
    ).toBeTruthy();
    expect(screen.queryByText('unknown@example.com')).toBeNull();
  });

  it('opens W03 and renders feature and device options from mock arrays', () => {
    render(<App initialEntries={['/products/securedesk']} />);

    expect(
      screen.getByRole('heading', { name: 'SecureDesk Pro' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Khóa license theo fingerprint thiết bị'),
    ).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Số thiết bị' })).toBeTruthy();
    expect(screen.getByText('25 thiết bị')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeTruthy();
  });
});
