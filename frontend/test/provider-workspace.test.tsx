import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('Provider workspace', () => {
  it('renders the updated Figma provider dashboard hierarchy', () => {
    render(<App initialEntries={['/provider']} />);

    expect(
      screen.getByRole('heading', { name: 'Tổng quan Provider' }),
    ).toBeTruthy();
    expect(screen.getByText('LicenseHub')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cài đặt' })).toBeTruthy();
    expect(
      screen.getByRole('alert', { name: 'Còn 2 bước để sẵn sàng publish' }),
    ).toBeTruthy();
    expect(screen.getByText('128,4 triệu ₫')).toBeTruthy();
    expect(screen.getByText('ORD-0221')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Hàng đợi cần xử lý' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Blockchain status' }),
    ).toBeTruthy();
  });

  it('adds an allowed knowledge file to the local list', () => {
    render(<App initialEntries={['/provider/knowledge']} />);

    const file = new File(['demo'], 'huong-dan-demo.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText('Chọn tài liệu kiến thức'), {
      target: { files: [file] },
    });
    expect(screen.getByText('huong-dan-demo.pdf')).toBeTruthy();
  });

  it('filters provider operations from the typed arrays', () => {
    render(<App initialEntries={['/provider/operations']} />);

    fireEvent.change(screen.getByLabelText('Tìm dữ liệu vận hành'), {
      target: { value: 'P024' },
    });

    expect(screen.getByText(/ORD-0224/)).toBeTruthy();
    expect(screen.queryByText(/ORD-0225/)).toBeNull();
  });
});
