import { Alert, Button, QRCode, Spin } from 'antd';
import { useParams } from 'react-router-dom';

import {
  useOrder,
  useOrderMutations,
} from '../../application/orders/orderQueries';
import {
  FactList,
  PageHeader,
  ProgressList,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function PaymentStatusScreen() {
  const { id = '' } = useParams();
  const order = useOrder(id);
  const checkout = useOrderMutations().checkout;
  if (order.isPending) return <Spin />;
  if (order.error || !order.data)
    return <Alert type="error" message="Không thể tải đơn hàng." />;
  const current = order.data;
  const payment = checkout.data;

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Thanh toán đơn hàng"
        description="Thông tin thanh toán do backend tạo; giao diện không tự xác nhận thanh toán."
        action={<Button>Trợ giúp</Button>}
      />
      <div className="payment-grid">
        <section className="workspace-card payment-card">
          <header>
            <h2>Chuyển khoản qua SePay</h2>
            <StatusChip tone="warning">{current.orderStatus}</StatusChip>
          </header>
          {!payment ? (
            <Button
              type="primary"
              loading={checkout.isPending}
              onClick={() => checkout.mutate(current.id)}
            >
              Tạo yêu cầu thanh toán
            </Button>
          ) : (
            <>
              <QRCode
                type="svg"
                value={payment.checkoutUrl}
              />
              <FactList
                facts={[
                  { label: 'Mã thanh toán', value: payment.checkoutReference },
                  { label: 'Số tiền', value: formatMoney(payment.amountVnd) },
                  {
                    label: 'Hết hạn',
                    value: new Date(payment.expiresAt).toLocaleString('vi-VN'),
                  },
                ]}
              />
              <Alert
                showIcon
                type="info"
                message="Trạng thái sẽ được cập nhật sau khi backend xác minh IPN hợp lệ."
              />
            </>
          )}
          {checkout.error ? (
            <Alert type="error" message="Không thể tạo yêu cầu thanh toán." />
          ) : null}
        </section>
        <aside className="checkout-stack">
          <section className="workspace-card section-card">
            <h2>Tiến trình đơn hàng</h2>
            <ProgressList
              items={[
                {
                  label: 'Chấp nhận điều khoản',
                  status: 'Hoàn tất',
                  tone: 'success',
                },
                { label: 'Tạo đơn hàng', status: 'Hoàn tất', tone: 'success' },
                {
                  label: 'Thanh toán',
                  status:
                    current.orderStatus === 'PAYMENT_ACCEPTED'
                      ? 'Đã xác nhận'
                      : 'Đang chờ',
                  tone: 'warning',
                },
                {
                  label: 'Xác nhận quyền on-chain',
                  status:
                    current.orderStatus === 'PAYMENT_ACCEPTED'
                      ? 'Đang xử lý'
                      : 'Chưa bắt đầu',
                  tone: 'info',
                },
              ]}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
