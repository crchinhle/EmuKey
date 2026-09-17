import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('Provider workspace', () => {
  it('renders the updated Figma provider dashboard hierarchy', () => {
    render(<App initialEntries={['/provider']} />);

    expect(
      screen.getByRole('heading', { name: 'Tổng quan Provider' }),
    ).toBeTruthy();
    expect(screen.getByText('LicenseHub')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hồ sơ' })).toBeTruthy();
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

  it('filters provider payment history loaded from the backend', async () => {
    render(<App initialEntries={['/provider/operations']} />);

    fireEvent.change(screen.getByLabelText('Tìm dữ liệu vận hành'), {
      target: { value: '0218' },
    });

    expect(await screen.findByText(/ORD-2026-0218/)).toBeTruthy();
    expect(screen.getByText('MATCHED')).toBeTruthy();
  });

  it('exposes license lifecycle controls in the Provider workspace', async () => {
    render(<App initialEntries={['/provider/licenses']} />);

    expect(await screen.findByRole('heading', { name: 'License' })).toBeTruthy();
    expect(await screen.findByText(/EMU-/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText(/Command PENDING/)).toBeTruthy();
    await waitFor(() => expect(
      vi.mocked(fetch).mock.calls.some(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        return url.endsWith('/commands/00000000-0000-4000-8000-000000000902');
      }),
    ).toBe(true));
    expect(await screen.findByText(/Command CONFIRMED/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('ACTIVE')).toBeTruthy());
  });
});
