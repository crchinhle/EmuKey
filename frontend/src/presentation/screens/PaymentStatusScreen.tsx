import { Alert, Button, Input, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
import { NotificationCenter } from '../components/NotificationCenter';

export function PaymentStatusScreen() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const order = useOrder(id);
  const checkout = useOrderMutations().checkout;
  const retrieveKey = useRetrieveActivationKey();
  const [activationKey, setActivationKey] = useState<string | null>(null);
  const [retrieveError, setRetrieveError] = useState<unknown>(null);
  const providerReturned = ['success', 'error', 'cancel'].includes(searchParams.get('sepay') ?? '') || searchParams.get('returned') === 'sepay';
  const license = useOrderLicense(
    id,
    order.data?.orderStatus === 'PAYMENT_ACCEPTED',
    order.data?.licenseId,
  );
  const checkoutStarted = useRef(false);
  const checkoutSubmitted = useRef(false);
  const [copyStatus, setCopyStatus] = useState('');
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
  const licenseNeedsReview = license.data?.activationKeyTrustStatus === 'UNTRUSTED_REORG' ||
    ['SUSPENDED', 'EXPIRED', 'REVOKED'].includes(license.data?.status ?? '');
  if (order.isPending) return <Spin />;
  if (order.error || !order.data)
    return <Alert type="error" message="Không thể tải đơn hàng." />;
  const current = order.data;
  const payment = checkout.data;
  const paymentStatus = current.orderStatus === 'PAYMENT_ACCEPTED'
    ? license.data
      ? 'LICENSE_ISSUING'
      : 'PAYMENT_ACCEPTED'
    : providerReturned
      ? 'PAYMENT_CONFIRMING'
      : 'WAITING_PAYMENT';
  const screenState = activationKey
    ? 'KEY_RETRIEVED'
    : licenseReady
      ? 'LICENSE_READY'
      : licenseNeedsReview
        ? 'REVIEW'
        : paymentStatus;
  const keyUnavailable = retrieveError !== null;
  const activationUnavailable = keyUnavailable &&
    typeof retrieveError === 'object' &&
    retrieveError !== null &&
    'status' in retrieveError &&
    retrieveError.status === 404;
  const keyAvailable = license.data?.activationKeyAvailable !== false;
  const retrieveErrorMessage = activationUnavailable
    ? 'Mã kích hoạt đã được nhận trước đó. Nếu bạn đã mất mã, hãy sử dụng quy trình khôi phục khóa.'
    : keyUnavailable
      ? 'Không thể nhận mã kích hoạt lúc này. Vui lòng thử lại khi bản quyền vẫn đang sẵn sàng.'
    : null;
  const licenseQueryErrorMessage = license.error
    ? 'Thanh toán đã xác nhận. Bản quyền đang được xử lý; trạng thái blockchain chưa thể tải ngay lúc này.'
    : null;

  const copyActivationKey = async () => {
    const key = activationKey;
    if (!key || !navigator.clipboard) return;
    await navigator.clipboard.writeText(key);
    setCopyStatus('Đã sao chép');
  };

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Thanh toán đơn hàng"
        action={<NotificationCenter />}
      />
      <div className="payment-grid">
        <section className="workspace-card payment-card">
          <header>
            <h2>{screenState === 'LICENSE_READY' || screenState === 'KEY_RETRIEVED'
              ? 'Bản quyền đã sẵn sàng'
              : screenState === 'PAYMENT_ACCEPTED'
                ? 'Thanh toán đã được xác nhận'
                : 'Chuyển khoản qua SePay'}</h2>
            <StatusChip tone={screenState === 'REVIEW' ? 'warning' : screenState === 'LICENSE_READY' || screenState === 'KEY_RETRIEVED' ? 'success' : 'info'}>
              {screenState === 'WAITING_PAYMENT' ? 'Đang chờ thanh toán' :
                screenState === 'PAYMENT_CONFIRMING' ? 'Đang xác nhận thanh toán' :
                  screenState === 'PAYMENT_ACCEPTED' ? 'Thanh toán đã được xác nhận' :
                    screenState === 'LICENSE_ISSUING' ? 'Đang kích hoạt bản quyền' :
                      screenState === 'LICENSE_READY' ? 'Bản quyền đã sẵn sàng' :
                        screenState === 'KEY_RETRIEVED' ? 'Mã kích hoạt đã được cấp' : 'Cần kiểm tra'}
            </StatusChip>
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
          {current.orderStatus === 'PAYMENT_ACCEPTED' && !licenseReady && !licenseNeedsReview ? (
            <Alert
              showIcon
              type="info"
              message="Thanh toán đã được xác nhận."
              description="EmuKey đang kích hoạt bản quyền của bạn trên blockchain. Bạn không cần thanh toán lại hoặc tự làm mới trang."
            />
          ) : null}
          {licenseQueryErrorMessage ? <Alert showIcon type="info" message={licenseQueryErrorMessage} /> : null}
          {licenseReady ? (
            <Alert
              showIcon
              type="success"
              message="Bản quyền đã sẵn sàng"
              description="Bản quyền đã đạt finality. Bạn có thể nhận mã kích hoạt một lần."
            />
          ) : null}
          {searchParams.get('sepay') === 'error' && current.orderStatus !== 'PAYMENT_ACCEPTED' ? (
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
          {licenseNeedsReview && current.orderStatus === 'PAYMENT_ACCEPTED' ? (
            <Alert
              showIcon
              type="warning"
              message="Thanh toán đã xác nhận. Bản quyền đang cần được kiểm tra thêm."
              description="Quyền sử dụng và mã kích hoạt vẫn bị khóa cho đến khi trạng thái blockchain được xác nhận lại."
            />
          ) : current.orderStatus === 'PAYMENT_ACCEPTED' && !licenseReady ? (
            <Alert showIcon type="success" message="Thanh toán đã được xác nhận." />
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
            <>
              <FactList
                facts={[
                  { label: 'Sản phẩm', value: license.data?.productName ?? current.productNameSnapshot },
                  { label: 'Gói', value: license.data?.plan.name ?? current.planNameSnapshot },
                  { label: 'Mã bản quyền', value: license.data?.publicLicenseId ?? 'Đang cập nhật' },
                  { label: 'Hạn dùng', value: license.data ? new Date(license.data.expiresAt).toLocaleDateString('vi-VN') : 'Đang cập nhật' },
                  { label: 'Thiết bị tối đa', value: license.data?.maxActiveDevices ?? current.maxActiveDevicesSnapshot },
                ]}
              />
              <div className="workspace-actions">
                {activationKey ? null : keyAvailable ? (
                  <>
                    <p>Mã kích hoạt chỉ được hiển thị một lần. Hãy lưu lại trước khi rời trang.</p>
                    <Button
                      type="primary"
                      loading={retrieveKey.isPending}
                      disabled={retrieveKey.isPending}
                      onClick={() => {
                        setRetrieveError(null);
                        retrieveKey.mutate(
                          { id: license.data!.id },
                          {
                            onSuccess: (value) => {
                              setActivationKey(value.activationKey);
                              retrieveKey.reset();
                            },
                            onError: (error) => {
                              setRetrieveError(error);
                              retrieveKey.reset();
                            },
                          },
                        );
                      }}
                    >
                      Nhận mã kích hoạt
                    </Button>
                  </>
                ) : (
                  <Alert
                    showIcon
                    type="info"
                    message="Mã kích hoạt đã được nhận"
                    description={
                      <>
                        Nếu bạn đã mất mã, hãy sử dụng quy trình khôi phục khóa.{' '}
                        <a href={`/buyer/licenses?licenseId=${encodeURIComponent(license.data!.id)}&recover=1`}>
                          Mở License Hub
                        </a>
                      </>
                    }
                  />
                )}
                {activationKey ? (
                  <div className="workspace-card">
                    <h3>Mã kích hoạt của bạn</h3>
                    <Input.Password aria-label="Mã kích hoạt" readOnly value={activationKey} />
                    <div className="workspace-actions">
                      <Button onClick={() => void copyActivationKey()}>Sao chép</Button>
                      <Button
                        type="primary"
                        onClick={() => void navigate(`/buyer/licenses?licenseId=${encodeURIComponent(license.data!.id)}&activate=1`)}
                      >
                        Tôi đã lưu mã
                      </Button>
                    </div>
                    <p>Mã kích hoạt chỉ được cấp một lần. Hãy lưu lại trước khi rời trang.</p>
                    <span aria-live="polite">{copyStatus}</span>
                  </div>
                ) : null}
                {retrieveErrorMessage ? <Alert type="warning" message={retrieveErrorMessage} /> : null}
              </div>
            </>
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
                   status: current.orderStatus === 'PAYMENT_ACCEPTED' ? 'Hoàn tất' : providerReturned ? 'Đang xác nhận' : 'Đang chờ',
                   tone: current.orderStatus === 'PAYMENT_ACCEPTED' ? 'success' : 'warning',
                 },
                 {
                   label: 'Kích hoạt bản quyền',
                   status: licenseReady ? 'Hoàn tất' : current.orderStatus === 'PAYMENT_ACCEPTED' ? 'Đang xử lý' : 'Chưa bắt đầu',
                   tone: licenseReady ? 'success' : 'info',
                 },
              ]}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
