import { Alert, Button, QRCode } from 'antd';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import {
  orders,
  primaryOrder,
} from '../../infrastructure/workspace/mockWorkspace';
import { OrderSummary } from '../components/OrderSummary';
import {
  FactList,
  PageHeader,
  ProgressList,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function PaymentStatusScreen() {
  const { id = primaryOrder.id } = useParams();
  const location = useLocation();
  const order = orders.find((item) => item.id === id) ?? primaryOrder;
  const [paid, setPaid] = useState(false);
  const signedDemo = Boolean(
    (location.state as { signedDemo?: boolean } | null)?.signedDemo,
  );

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Thanh toán đơn hàng"
        description="Theo dõi trạng thái SePay và tiến trình cấp license sau thanh toán."
        action={<Button>Trợ giúp</Button>}
      />
      {signedDemo ? (
        <Alert
          showIcon
          message="Mô phỏng ký hợp đồng thành công. Chưa có giao dịch hoặc chữ ký thật."
          type="success"
        />
      ) : null}
      {paid ? (
        <Alert
          showIcon
          message="Mô phỏng đã nhận yêu cầu kiểm tra thanh toán; chưa cấp license."
          type="info"
        />
      ) : null}
      <div className="payment-grid">
        <section className="workspace-card payment-card">
          <header>
            <h2>Chuyển khoản qua SePay</h2>
            <StatusChip tone={paid ? 'info' : 'warning'}>
              {paid ? 'Đang đối soát' : 'Chờ thanh toán'}
            </StatusChip>
          </header>
          <QRCode type="svg" value={`EMUKEY-DEMO-${order.id}`} />
          <small>
            Quét bằng ứng dụng ngân hàng · dữ liệu QR chỉ để minh họa
          </small>
          <FactList
            facts={[
              { label: 'Ngân hàng', value: 'MB Bank · DEMO' },
              { label: 'Số tài khoản', value: '0000000000' },
              { label: 'Nội dung', value: `DEMO ${order.id}` },
              { label: 'Số tiền', value: formatMoney(order.total) },
            ]}
          />
          <div className="workspace-actions">
            <Button>Sao chép</Button>
            <Button type="primary" onClick={() => setPaid(true)}>
              Tôi đã thanh toán
            </Button>
          </div>
        </section>
        <aside className="checkout-stack">
          <OrderSummary order={order} />
          <section className="workspace-card section-card">
            <h2>Tiến trình đơn hàng</h2>
            <ProgressList
              items={[
                { label: 'Tạo hợp đồng', status: 'Hoàn tất', tone: 'success' },
                { label: 'Ký hợp đồng', status: 'Hoàn tất', tone: 'success' },
                {
                  label: 'Thanh toán',
                  status: paid ? 'Đối soát' : 'Đang chờ',
                  tone: 'warning',
                },
                { label: 'Cấp license', status: 'Chưa bắt đầu', tone: 'info' },
              ]}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
