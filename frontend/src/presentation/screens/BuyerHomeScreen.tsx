import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

import {
  buyerMetrics,
  licenses,
  orders,
} from '../../infrastructure/workspace/mockWorkspace';
import {
  MetricCard,
  PageHeader,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function BuyerHomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Xin chào, Minh An"
        description="Tổng quan hợp đồng, license và hỗ trợ gần đây."
        action={<Button>Thông báo</Button>}
      />
      <section
        className="metric-grid metric-grid--three"
        aria-label="Chỉ số tài khoản"
      >
        {buyerMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <div className="workspace-two-column">
        <div>
          <section className="workspace-card section-card">
            <header className="section-heading">
              <h2>License đang sử dụng</h2>
              <Button
                type="link"
                onClick={() => void navigate('/buyer/licenses')}
              >
                Xem tất cả
              </Button>
            </header>
            <div className="stack-list">
              {licenses.slice(0, 2).map((license) => (
                <button
                  className="selectable-row"
                  key={license.id}
                  onClick={() => void navigate('/buyer/licenses')}
                >
                  <span>
                    <strong>{license.product}</strong>
                    <small>
                      {license.used}/{license.total} thiết bị
                    </small>
                  </span>
                  <StatusChip
                    tone={license.status === 'expiring' ? 'warning' : 'success'}
                  >
                    {license.statusLabel}
                  </StatusChip>
                </button>
              ))}
            </div>
          </section>
          <section className="workspace-card section-card">
            <h2>Đơn hàng gần đây</h2>
            <div className="stack-list">
              {orders.slice(0, 2).map((order) => (
                <button
                  className="data-row"
                  key={order.id}
                  onClick={() => void navigate('/buyer/orders')}
                >
                  <strong>{order.id}</strong>
                  <span>{order.product}</span>
                  <span>{formatMoney(order.total)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="workspace-aside">
          <section className="workspace-card section-card">
            <h2>Cần bạn xử lý</h2>
            <button
              className="text-action"
              onClick={() =>
                void navigate('/buyer/contracts/ORD-2026-0218/sign')
              }
            >
              Ký hợp đồng SecureDesk Pro<small>Mở chi tiết để tiếp tục</small>
            </button>
            <button
              className="text-action"
              onClick={() =>
                void navigate('/buyer/orders/ORD-2026-0218/payment')
              }
            >
              Thanh toán đơn ORD-2026-0218<small>Mở chi tiết để tiếp tục</small>
            </button>
            <button className="text-action">
              Xác nhận thiết bị mới<small>Mô phỏng hành động</small>
            </button>
          </section>
          <section className="workspace-card section-card support-callout">
            <StatusChip tone="realtime">Online</StatusChip>
            <h2>Bạn cần hỗ trợ?</h2>
            <p>Chat realtime hoặc hỏi trợ lý AI.</p>
            <Button
              type="primary"
              onClick={() => void navigate('/buyer/support')}
            >
              Mở hỗ trợ
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
