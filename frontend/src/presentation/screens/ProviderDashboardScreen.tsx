import { Alert, Empty, Spin } from 'antd';
import { Link } from 'react-router-dom';

import { useAdminPlans, useAdminProducts } from '../../application/catalog/catalogQueries';
import { usePaymentHistory } from '../../application/orders/orderQueries';
import { useProviderLicenses } from '../../application/licenses/licenseQueries';
import { NotificationCenter } from '../components/NotificationCenter';
import { PageHeader } from '../components/WorkspacePrimitives';

export function ProviderDashboardScreen() {
  const products = useAdminProducts();
  const plans = useAdminPlans();
  const payments = usePaymentHistory();
  const licenses = useProviderLicenses();
  const loading = products.isLoading || plans.isLoading || payments.isLoading || licenses.isLoading;
  const error = products.error ?? plans.error ?? payments.error ?? licenses.error;
  return (
    <div className="provider-dashboard-screen">
      <PageHeader
        title="Trang chủ Provider"
        action={<NotificationCenter />}
      />
      {loading ? <Spin aria-label="Đang tải tổng quan Provider" /> : null}
      {error ? <Alert showIcon type="error" message="Không thể tải tổng quan Provider." /> : null}
      <section className="metric-grid metric-grid--four">
        <article className="metric-card"><span className="status-chip status-chip--neutral">Sản phẩm</span><strong>{products.data?.length ?? 0}</strong><small>Danh mục doanh nghiệp</small></article>
        <article className="metric-card"><span className="status-chip status-chip--neutral">Gói bản quyền</span><strong>{plans.data?.length ?? 0}</strong><small>Draft và published</small></article>
        <article className="metric-card"><span className="status-chip status-chip--commerce">Thanh toán</span><strong>{payments.data?.length ?? 0}</strong><small>Lịch sử đã tải</small></article>
        <article className="metric-card"><span className="status-chip status-chip--success">License</span><strong>{licenses.data?.length ?? 0}</strong><small>Projection của Provider</small></article>
      </section>
      <section className="workspace-card section-card">
        <h2>Việc cần theo dõi</h2>
        {!loading && !error && !products.data?.length && !plans.data?.length ? <Empty description="Chưa có sản phẩm hoặc gói trong danh mục." /> : <p className="muted-copy">Số liệu trên lấy từ các API danh mục, thanh toán và license hiện có; các widget phân tích dự báo và aggregate chưa có canonical Phase 1-7 API nên đã được ẩn.</p>}
        <Link className="primary-link" to="/provider/catalog">Mở Catalog Provider</Link>
      </section>
    </div>
  );
}
