import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('W04 public verification', () => {
  it('shows the public verification allowlist without customer PII', () => {
    render(<App initialEntries={['/verify']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));

    expect(screen.getByText('Hợp đồng hợp lệ')).toBeTruthy();
    expect(screen.getByText('SecureDesk Pro')).toBeTruthy();
    expect(screen.getByText('EmuKey Software')).toBeTruthy();
    expect(screen.queryByText('Công ty TNHH Minh An')).toBeNull();
  });

  it('shows an explicit not-found state for an unknown code', () => {
    render(<App initialEntries={['/verify']} />);

    fireEvent.change(screen.getByLabelText('Mã xác thực'), {
      target: { value: 'UNKNOWN' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));

    expect(screen.getByRole('alert').textContent).toContain('Không tìm thấy');
  });
});
