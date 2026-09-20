import { Alert, Button, Input, Spin } from 'antd';
import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import {
  useOrderLicense,
  useRetrieveActivationKey,
} from '../../application/licenses/licenseQueries';
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
  const [searchParams] = useSearchParams();
  const order = useOrder(id);
  const checkout = useOrderMutations().checkout;
  const retrieveKey = useRetrieveActivationKey();
  const providerReturned = ['success', 'error', 'cancel'].includes(searchParams.get('sepay') ?? '') || searchParams.get('returned') === 'sepay';
  const license = useOrderLicense(id, order.data?.orderStatus === 'PAYMENT_ACCEPTED');
  const checkoutStarted = useRef(false);
  const checkoutSubmitted = useRef(false);
  useEffect(() => {
    if (!providerReturned && order.data?.orderStatus !== 'PAYMENT_ACCEPTED' && !checkout.data && !checkoutStarted.current) {
      checkoutStarted.current = true;
      checkout.mutate(id);
    }
  }, [checkout, id, order.data?.orderStatus, providerReturned]);
  useEffect(() => {
    if (!providerReturned && checkout.data && !checkoutSubmitted.current) {
      checkoutSubmitted.current = true;
      (document.getElementById('sepay-checkout-form') as HTMLFormElement | null)?.requestSubmit();
    }
  }, [checkout.data, providerReturned]);
  const licenseReady = license.data?.status === 'ACTIVE' && license.data.activationKeyTrustStatus === 'TRUSTED';
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
          {providerReturned &&
          searchParams.get('sepay') === 'success' &&
          current.orderStatus !== 'PAYMENT_ACCEPTED' ? (
            <Alert
              showIcon
              type="info"
              message="SePay đã chuyển bạn về Emukey. Chúng tôi đang xác nhận giao dịch, quá trình này có thể mất vài giây."
            />
          ) : null}
          {current.orderStatus === 'PAYMENT_ACCEPTED' && !licenseReady ? (
            <Alert showIcon type="info" message="Đang kích hoạt bản quyền trên blockchain..." />
          ) : null}
          {licenseReady ? (
            <Alert
              showIcon
              type="success"
              message="Bản quyền đã sẵn sàng"
              description="Bản quyền đã đạt finality. Bạn có thể nhận mã kích hoạt một lần."
            />
          ) : null}
          {searchParams.get('sepay') === 'error' ? (
            <Alert
              showIcon
              type="error"
              message="SePay báo giao dịch không thành công. Bạn có thể tạo lại yêu cầu thanh toán."
            />
          ) : null}
          {searchParams.get('sepay') === 'cancel' ? (
            <Alert
              showIcon
              type="warning"
              message="Bạn đã hủy thanh toán trên SePay. Đơn hàng vẫn được giữ đến thời hạn thanh toán."
            />
          ) : null}
          {current.orderStatus === 'PAYMENT_ACCEPTED' ? (
            <Alert
              showIcon
              type="success"
              message="Thanh toán đã được backend xác nhận từ IPN hợp lệ."
            />
          ) : providerReturned ? (
            <Alert showIcon type="info" message="Đang xác nhận thanh toán" />
          ) : !payment ? (
            <Alert showIcon type="info" message="Đang chuyển bạn đến cổng thanh toán SePay..." />
          ) : (
            <>
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
              <form
                action={payment.checkoutUrl}
                id="sepay-checkout-form"
                data-testid="sepay-checkout-form"
                method="post"
              >
                {Object.entries(payment.checkoutFields).map(([name, value]) => (
                  <input key={name} name={name} type="hidden" value={value} />
                ))}
                <Button htmlType="submit" type="primary">
                  {payment.checkoutUrl.includes('sandbox')
                    ? 'Thanh toán trên SePay Sandbox'
                    : 'Thanh toán trên SePay'}
                </Button>
              </form>
              <Alert
                showIcon
                type="info"
                message="Trạng thái sẽ được cập nhật sau khi backend xác minh IPN hợp lệ."
              />
            </>
          )}
          {licenseReady ? (
            <div className="workspace-actions">
              <Button
                type="primary"
                loading={retrieveKey.isPending}
                disabled={retrieveKey.isSuccess}
                onClick={() => retrieveKey.mutate({ id: license.data!.id })}
              >
                Nhận mã kích hoạt
              </Button>
              {retrieveKey.data?.activationKey ? (
                <div className="workspace-card">
                  <h3>Mã kích hoạt của bạn</h3>
                  <Input.Password aria-label="Mã kích hoạt" readOnly value={retrieveKey.data.activationKey} />
                  <Button onClick={() => void navigator.clipboard?.writeText(retrieveKey.data.activationKey)}>Sao chép</Button>
                  <p>Mã chỉ được cấp một lần. Hãy lưu lại trước khi rời trang.</p>
                </div>
              ) : null}
              {retrieveKey.error ? <Alert type="warning" message="Mã kích hoạt đã được nhận trước đó hoặc hiện không còn khả dụng." /> : null}
            </div>
          ) : null}
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
