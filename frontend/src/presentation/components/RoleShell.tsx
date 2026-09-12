import { Link, Outlet, useLocation } from 'react-router-dom';

import type { RoleShellConfig } from '../../domain/workspace';
import { useOptionalAuth } from '../../application/auth/authContext';
import brandMarkShield from '../assets/brand-mark-shield.svg';

export const buyerShell: RoleShellConfig = {
  role: 'CUSTOMER',
  account: 'buyer@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/buyer', end: true },
    { label: 'Đơn hàng', to: '/buyer/orders' },
    { label: 'License', to: '/buyer/licenses' },
    { label: 'Hỗ trợ', to: '/buyer/support' },
  ],
};

export const providerShell: RoleShellConfig = {
  role: 'PROVIDER_ADMIN',
  account: 'admin@securedesk.vn',
  items: [
    { label: 'Tổng quan', to: '/provider', end: true },
    { label: 'Cài đặt', to: '/auth' },
    { label: 'Danh mục', to: '/provider/catalog' },
    { label: 'AI Knowledge', to: '/provider/knowledge' },
    { label: 'Vận hành', to: '/provider/operations' },
  ],
};

export const supportShell: RoleShellConfig = {
  role: 'SUPPORT_STAFF',
  account: 'support@demo.emukey.vn',
  items: [
    { label: 'Hàng đợi', to: '/support', end: true },
    { label: 'Đang xử lý', to: '/support?view=active' },
    { label: 'Đã giải quyết', to: '/support?view=resolved' },
    { label: 'Kho kiến thức', to: '/provider/knowledge' },
  ],
};

export const systemShell: RoleShellConfig = {
  role: 'SYSTEM_ADMIN',
  account: 'sysadmin@demo.emukey.vn',
  items: [
    { label: 'Tổng quan', to: '/system/console', end: true },
    { label: 'Tài khoản', to: '/system/console?view=accounts' },
    { label: 'Jobs', to: '/system/console?view=jobs' },
    { label: 'Audit Log', to: '/system/console?view=audit' },
  ],
};

const roleLabels: Record<RoleShellConfig['role'], string> = {
  CUSTOMER: 'NGƯỜI MUA',
  PROVIDER_ADMIN: 'PROVIDER',
  SUPPORT_STAFF: 'SUPPORT',
  SYSTEM_ADMIN: 'SYSTEM',
};

export function RoleShell({ config }: { readonly config: RoleShellConfig }) {
  const location = useLocation();
  const auth = useOptionalAuth();
  const current = `${location.pathname}${location.search}`;
  return (
    <div className="role-shell">
      <aside className="role-sidebar">
        <Link aria-label="LicenseHub - Trang sản phẩm" className="role-brand" to="/products">
          <img alt="" height="30" src={brandMarkShield} width="30" />
          <span>LicenseHub</span>
        </Link>
        <span className="role-label">{roleLabels[config.role]}</span>
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
        <small>{auth?.user?.email ?? config.account}</small>
      </aside>
      <main className="role-main"><Outlet /></main>
    </div>
  );
}
