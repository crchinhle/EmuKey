import { Link, Outlet, useLocation } from 'react-router-dom';

import type { RoleShellConfig } from '../../domain/workspace';
import { Brand } from './Brand';

export const buyerShell: RoleShellConfig = {
  role: 'BUYER',
  account: 'buyer@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/buyer', end: true },
    { label: 'Đơn hàng', to: '/buyer/orders' },
    { label: 'License', to: '/buyer/licenses' },
    { label: 'Hỗ trợ', to: '/buyer/support' },
    { label: 'Tài khoản', to: '/auth' },
  ],
};

export const providerShell: RoleShellConfig = {
  role: 'PROVIDER',
  account: 'provider@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/provider', end: true },
    { label: 'Cài đặt', to: '/provider/settings' },
    { label: 'Danh mục', to: '/provider/catalog' },
    { label: 'AI Knowledge', to: '/provider/knowledge' },
    { label: 'Vận hành', to: '/provider/operations' },
  ],
};

export const supportShell: RoleShellConfig = {
  role: 'SUPPORT',
  account: 'support@demo.emukey.vn',
  items: [
    { label: 'Hàng đợi', to: '/support', end: true },
    { label: 'Đang xử lý', to: '/support?view=active' },
    { label: 'Đã giải quyết', to: '/support?view=resolved' },
    { label: 'Kho kiến thức', to: '/provider/knowledge' },
  ],
};

export const systemShell: RoleShellConfig = {
  role: 'SYSTEM',
  account: 'sysadmin@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/system/console', end: true },
    { label: 'Tài khoản', to: '/system/console?view=accounts' },
    { label: 'Jobs', to: '/system/console?view=jobs' },
    { label: 'Audit Log', to: '/system/console?view=audit' },
  ],
};

interface RoleShellProps {
  readonly config: RoleShellConfig;
}

export function RoleShell({ config }: RoleShellProps) {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;

  return (
    <div className="role-shell">
      <aside className="role-sidebar">
        <Brand inverted />
        <span className="role-label">{config.role}</span>
        <nav aria-label={`Điều hướng ${config.role}`} className="role-nav">
          {config.items.map((item) => (
            <Link
              className={current === item.to ? 'active' : ''}
              key={`${item.to}-${item.label}`}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <small>{config.account}</small>
      </aside>
      <main className="role-main">
        <Outlet />
      </main>
    </div>
  );
}
