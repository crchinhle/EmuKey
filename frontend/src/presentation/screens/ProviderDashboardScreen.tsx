import { Button } from 'antd';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/WorkspacePrimitives';

export function ProviderDashboardScreen() {
  return (
    <div className="provider-dashboard-screen">
      <PageHeader
        title="Tổng quan Provider"
        description="Theo dõi Order, Payment, License và chain health của Provider."
        action={<Button>Thông báo</Button>}
      />

      <section className="workspace-card section-card">
        <h2>Dashboard Provider</h2>
        <p className="muted-copy">Các widget phân tích dự báo và aggregate chưa có canonical Phase 1-7 API nên đã được ẩn.</p>
        <Link className="primary-link" to="/provider/catalog">Mở Catalog Provider</Link>
      </section>
    </div>
  );
}
