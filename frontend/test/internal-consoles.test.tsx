import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('W17-W18 Internal consoles', () => {
  it('switches support context and sends a local reply', () => {
    render(<App initialEntries={['/support']} />);

    fireEvent.click(screen.getByRole('button', { name: /An Phú/i }));
    expect(screen.getByText('Công ty An Phú')).toBeTruthy();
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

  it('shows audit detail without provider promotion controls', () => {
    render(<App initialEntries={['/system/console']} />);

    fireEvent.click(screen.getByRole('button', { name: /BLOCKCHAIN_RETRY/i }));
    expect(screen.getAllByText('job #9840').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /khuyến mãi/i })).toBeNull();
  });
});
