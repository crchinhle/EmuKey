import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useLicenses } from '../../application/licenses/licenseQueries';
import { useOrders } from '../../application/orders/orderQueries';
import {
  MetricCard,
  PageHeader,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function BuyerHomeScreen() {
  const navigate = useNavigate();
  const licenseQuery = useLicenses();
  const ordersQuery = useOrders();
  const licenses = licenseQuery.data ?? [];
  const orders = ordersQuery.data ?? [];

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Tổng quan tài khoản người mua"
        description="Tổng quan đơn hàng, license và hỗ trợ gần đây."
        action={<Button>Thông báo</Button>}
      />
      <section
        className="metric-grid metric-grid--three"
        aria-label="Chỉ số tài khoản"
      >
        <MetricCard metric={{ label: 'License', value: String(licenses.length), helper: 'Dữ liệu tài khoản thật', tone: 'success' }} />
        <MetricCard metric={{ label: 'Đơn hàng', value: String(orders.length), helper: 'Dữ liệu tài khoản thật', tone: 'commerce' }} />
        <MetricCard metric={{ label: 'Trạng thái', value: licenseQuery.isError || ordersQuery.isError ? 'Lỗi' : 'Sẵn sàng', helper: 'Không hiển thị số liệu giả', tone: licenseQuery.isError || ordersQuery.isError ? 'error' : 'info' }} />
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
                    <strong>{license.productName}</strong>
                    <small>{license.maxActiveDevices} thiết bị tối đa</small>
                  </span>
                  <StatusChip
                    tone={license.status === 'ACTIVE' ? 'success' : 'warning'}
                  >
                    {license.status}
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
                  <strong>{order.orderNumber}</strong>
                  <span>{order.productNameSnapshot}</span>
                  <span>{formatMoney(order.priceVndSnapshot)}</span>
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
                void navigate('/buyer/orders/ORD-2026-0218/payment')
              }
            >
              {orders.find((order) => order.orderStatus === 'WAITING_PAYMENT') ? 'Tiếp tục thanh toán đơn đang chờ' : 'Không có thanh toán cần xử lý'}<small>Dữ liệu từ API đơn hàng</small>
            </button>
            <button className="text-action">
              Quản lý thiết bị<small>Mở trung tâm License</small>
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
