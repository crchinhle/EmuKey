import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { filterOrders } from '../src/application/workspace/workspaceSelectors';
import { orders } from '../src/infrastructure/workspace/mockWorkspace';
import {
  buyerShell,
  RoleShell,
} from '../src/presentation/components/RoleShell';

afterEach(cleanup);

describe('workspace foundation', () => {
  it('filters orders without mutating the mock array', () => {
    const before = [...orders];

    expect(
      filterOrders(orders, '0218', 'all').map((order) => order.id),
    ).toEqual(['ORD-2026-0218']);
    expect(orders).toEqual(before);
  });

  it('renders the active Customer navigation inside the shared role shell', () => {
    render(
      <MemoryRouter initialEntries={['/buyer/orders']}>
        <Routes>
          <Route element={<RoleShell config={buyerShell} />} path="/buyer">
            <Route element={<h1>Đơn hàng</h1>} path="orders" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Emukey').className).toContain('brand-wordmark');
    expect(screen.getByRole('link', { name: 'Đơn hàng' }).className).toContain(
      'active',
    );
  });
});
