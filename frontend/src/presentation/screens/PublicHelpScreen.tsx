import { Button } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

import { SiteHeader } from '../components/SiteHeader';

export function PublicHelpScreen() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="public-help-content">
        <section aria-labelledby="public-help-title" className="public-help-card">
          <h1 id="public-help-title">Hỗ trợ khách hàng</h1>
          <p>Đăng nhập để gửi yêu cầu và theo dõi phản hồi.</p>
          <Button type="primary" onClick={() => void navigate('/auth')}>
            Đăng nhập để được hỗ trợ
          </Button>
          <Link className="public-help-close" to="/products">Đóng</Link>
        </section>
      </main>
    </div>
  );
}
