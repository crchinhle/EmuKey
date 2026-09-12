import { Button } from 'antd';
import { Link } from 'react-router-dom';

import {
  providerMetrics,
  providerOrders,
  providerRevenue,
} from '../../infrastructure/workspace/mockWorkspace';
import infoOutline from '../assets/info-outline.svg';
import {
  MetricCard,
  PageHeader,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function ProviderDashboardScreen() {
  const maximum = Math.max(...providerRevenue.map((point) => point.value));
  const recentOrders = providerOrders.slice(0, 2);

  return (
    <div className="provider-dashboard-screen">
      <PageHeader
        title="Tổng quan Provider"
        description="Theo dõi Order, Payment, License và chain health của Provider."
        action={<Button>Thông báo</Button>}
      />

      <section
        aria-label="Còn 2 bước để sẵn sàng publish"
        className="provider-readiness-alert"
        role="alert"
      >
        <img alt="" height="24" src={infoOutline} width="24" />
        <div>
          <strong>Còn 2 bước để sẵn sàng publish</strong>
          <p>
            Hoàn tất Blockchain identity và publish Product/Plan trước khi bán.
          </p>
        </div>
      </section>

      <section
        aria-label="Chỉ số Provider"
        className="metric-grid metric-grid--four provider-kpis"
      >
        {providerMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="provider-dashboard-grid">
        <div className="provider-dashboard-column provider-dashboard-column--main">
          <section className="workspace-card provider-revenue-card">
            <div className="provider-section-heading">
              <h2>Doanh thu 6 tháng (triệu ₫)</h2>
              <span>Theo tháng</span>
            </div>
            <div aria-label="Biểu đồ doanh thu" className="bar-chart">
              {providerRevenue.map((point) => (
                <div className="bar-chart__item" key={point.month}>
                  <div
                    className={
                      point.value === maximum
                        ? 'bar-chart__bar bar-chart__bar--current'
                        : 'bar-chart__bar'
                    }
                    style={{ height: `${(point.value / maximum) * 100}%` }}
                  >
                    <strong>{point.value}</strong>
                  </div>
                  <small>{point.month}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-card provider-recent-orders">
            <h2>Đơn hàng gần đây</h2>
            <div
              aria-label="Đơn hàng gần đây"
              className="provider-order-table"
              role="table"
            >
              {recentOrders.map((order) => (
                <div className="provider-order-row" key={order.id} role="row">
                  <span className="provider-order-code" role="cell">
                    {order.id}
                  </span>
                  <span role="cell">{order.buyerReference}</span>
                  <span role="cell">
                    {order.plan} · {order.devices} thiết bị
                  </span>
                  <span className="provider-order-total" role="cell">
                    {formatMoney(order.total)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="provider-dashboard-column provider-dashboard-column--side">
          <section className="workspace-card provider-queue-card">
            <h2>Hàng đợi cần xử lý</h2>
            <div className="provider-queue-list">
              <div>
                <StatusChip tone="module">Mới</StatusChip>
                <span>3 tài liệu đang xử lý</span>
              </div>
              <div>
                <StatusChip tone="info">Mới</StatusChip>
                <span>2 payment cần review</span>
              </div>
              <div>
                <StatusChip tone="info">Mới</StatusChip>
                <span>2 chain command cần kiểm tra</span>
              </div>
            </div>
            <Link
              className="primary-link provider-card-action"
              to="/provider/operations"
            >
              Mở vận hành
            </Link>
          </section>

          <section className="workspace-card provider-chain-card">
            <StatusChip tone="commerce">Chain</StatusChip>
            <h2>Blockchain status</h2>
            <strong>Relayer ổn định · 0 dead-letter</strong>
            <p>Indexer đồng bộ · finality bình thường</p>
            <Link
              className="secondary-link provider-card-action"
              to="/provider/operations"
            >
              Xem Blockchain
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
