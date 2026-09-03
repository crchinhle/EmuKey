import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('W12-W16 Provider workspace', () => {
  it('renders the provider dashboard from mock metrics', () => {
    render(<App initialEntries={['/provider']} />);

    expect(
      screen.getByRole('heading', { name: 'Tổng quan nhà cung cấp' }),
    ).toBeTruthy();
    expect(screen.getByText('128,4 triệu ₫')).toBeTruthy();
    expect(screen.getByText('ORD-0225')).toBeTruthy();
  });

  it('creates a local promotion draft from the reusable modal', async () => {
    render(<App initialEntries={['/provider/catalog']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tạo khuyến mãi' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tên chương trình'), {
      target: { value: 'Ưu đãi demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    expect(
      await screen.findByText('Đã lưu bản nháp “Ưu đãi demo”'),
    ).toBeTruthy();
  });

  it('adds a selected knowledge file to the local list', () => {
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
      target: { value: 'Lam Sơn' },
    });

    expect(screen.getByText(/ORD-0224/)).toBeTruthy();
    expect(screen.queryByText(/ORD-0225/)).toBeNull();
  });
});
