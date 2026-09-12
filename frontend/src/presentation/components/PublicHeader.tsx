import { Button } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Brand } from './Brand';

export function PublicHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Điều hướng chính" className="public-nav">
        <Link
          className={location.pathname.startsWith('/products') ? 'active' : ''}
          to="/products"
        >
          Sản phẩm
        </Link>
        <Link
          className={location.pathname === '/verify' ? 'active' : ''}
          to="/verify"
        >
          Xác thực
        </Link>
      </nav>
      <div className="header-actions">
        <Button
          type="text"
          onClick={() => {
            void navigate('/auth');
          }}
        >
          Đăng nhập quản trị
        </Button>
        <Button
          onClick={() => {
            void navigate('/products/securedesk');
          }}
        >
          Dùng thử
        </Button>
      </div>
    </header>
  );
}
