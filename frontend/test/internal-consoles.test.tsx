import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('W17-W18 Internal consoles', () => {
  it('switches support context and sends a local reply', () => {
    render(<App initialEntries={['/support']} />);

    fireEvent.click(screen.getByRole('button', { name: /Người mua #B204/i }));
    expect(screen.getAllByText('Người mua #B204').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Nhận xử lý' }));
    expect(
      screen.getByRole('button', { name: 'Đang xử lý bởi bạn' }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Phản hồi hỗ trợ'), {
      target: { value: 'Đã nhận thông tin demo.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }));
    expect(screen.getByText('Đã nhận thông tin demo.')).toBeTruthy();
  });

  it('shows audit detail for system operators', () => {
    render(<App initialEntries={['/system/console']} />);

    fireEvent.click(screen.getByRole('button', { name: /BLOCKCHAIN_RETRY/i }));
    expect(screen.getAllByText('job #9840').length).toBeGreaterThan(0);
  });
});
