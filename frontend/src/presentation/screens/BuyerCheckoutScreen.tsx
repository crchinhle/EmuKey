import { Alert, Button, Checkbox, Input, Result, Spin, Steps } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useProduct } from '../../application/catalog/catalogQueries';
import { describeApiError } from '../../application/auth/authContext';
import {
  type OrderDetail,
  useOrderMutations,
  useOrderTerms,
} from '../../application/orders/orderQueries';
import { OrderSummary } from '../components/OrderSummary';
import { PageHeader } from '../components/WorkspacePrimitives';

export function BuyerCheckoutScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productSlug = searchParams.get('product') ?? 'securedesk';
  const { data: product, isLoading, isError } = useProduct(productSlug);
  const planId = searchParams.get('planId') ?? product?.plans[0]?.id;
  const [order, setOrder] = useState<OrderDetail>();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderMutations = useOrderMutations();
  const createOrderMutation = orderMutations.create;
  const termsQuery = useOrderTerms(order?.id ?? '');

  function createOrder() {
    if (!planId) return;
    setError(null);
    createOrderMutation.mutate(
      { planId },
      {
        onSuccess: setOrder,
      },
    );
  }

  function acceptServiceTerms() {
    if (!accepted || !order) {
      setError('Bạn cần đọc và đồng ý điều khoản trước khi tiếp tục.');
      return;
    }
    setError(null);
    orderMutations.acceptServiceTerms.mutate(order, {
      onSuccess: (acceptedOrder) =>
        void navigate(`/buyer/orders/${acceptedOrder.id}/payment`),
    });
  }

  if (isLoading) return <Spin aria-label="Đang tải gói giá" />;
  if (isError)
    return (
      <Result
        status="error"
        title="Không thể tải gói giá"
        subTitle="Danh mục đang tạm thời không khả dụng."
      />
    );
  if (!product || !planId)
    return (
      <Result
        status="info"
        title="Gói chưa sẵn sàng"
        subTitle="Gói này chưa được công bố hoặc đã thay đổi. Quay lại danh mục để chọn gói khác."
      />
    );
  const selectedPlan =
    product.plans.find((plan) => plan.id === planId) ?? product.plans[0];
  if (!selectedPlan)
    return <Result status="info" title="Sản phẩm chưa có gói được công bố" />;

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Hoàn tất mua bản quyền"
        description="Backend tạo snapshot đơn hàng trước, sau đó bạn đọc và chấp nhận đúng phiên bản điều khoản đã lưu."
        action={<Button>Thông báo</Button>}
      />
      <Steps
        current={order ? 1 : 0}
        items={[
          { title: 'Chọn gói' },
          { title: 'Xác nhận' },
          { title: 'Thanh toán' },
        ]}
      />
      <div className="checkout-grid">
        <div className="checkout-stack">
          <Alert
            showIcon
            type="success"
            message="Đơn hàng và License sẽ được gắn với tài khoản Emukey đang đăng nhập. Activation key không cần thêm khóa riêng hay khóa dự phòng theo tài khoản."
          />
          <section className="workspace-card section-card">
            <h2>Cấu hình đơn hàng</h2>
            <div className="form-grid">
              <label>
                Gói
                <Input aria-label="Gói" value={selectedPlan.label} readOnly />
              </label>
              <label>
                Số thiết bị tối đa
                <Input
                  aria-label="Số thiết bị tối đa"
                  value={`${selectedPlan.devices} thiết bị`}
                  readOnly
                />
              </label>
            </div>
          </section>
          <section className="workspace-card section-card">
            {!order ? (
              <Alert
                showIcon
                type="info"
                message="Tạo đơn hàng để backend khóa giá, quyền sử dụng và phiên bản điều khoản."
              />
            ) : termsQuery.isPending ? (
              <Spin aria-label="Đang tải điều khoản" />
            ) : termsQuery.isError || !termsQuery.data ? (
              <Alert
                showIcon
                type="error"
                message="Không thể tải đúng phiên bản điều khoản của đơn hàng."
              />
            ) : (
              <>
                <h2>Điều khoản cấp phép</h2>
                <pre className="terms-document">{termsQuery.data.content}</pre>
                <p className="muted-copy">Service Terms áp dụng cho từng đơn hàng.</p>
                <Checkbox
                  checked={accepted}
                  onChange={(event) => {
                    setAccepted(event.target.checked);
                    setError(null);
                  }}
                >
                  Tôi đã đọc và đồng ý với điều khoản cấp phép
                </Checkbox>
              </>
            )}
            {error ||
            createOrderMutation.error ||
            orderMutations.acceptServiceTerms.error ||
            termsQuery.error ? (
              <Alert
                message={
                  error ??
                  describeApiError(
                    createOrderMutation.error ??
                      orderMutations.acceptServiceTerms.error ??
                      termsQuery.error,
                    'Không thể hoàn tất bước đơn hàng và điều khoản. Vui lòng thử lại.',
                  )
                }
                role="alert"
                type="error"
              />
            ) : null}
          </section>
        </div>
        <aside className="checkout-stack">
          <OrderSummary
            order={{ total: order?.priceVndSnapshot ?? selectedPlan.priceVnd }}
          />
          <section className="workspace-card section-card">
            <StatusHold />
            <p>Quay lại danh mục nếu bạn muốn chọn một gói khác.</p>
          </section>
          <div className="workspace-actions">
            <Button onClick={() => void navigate('/products/securedesk')}>
              Quay lại
            </Button>
            <Button
              type="primary"
              disabled={
                order
                  ? !accepted || termsQuery.isPending
                  : createOrderMutation.isPending
              }
              loading={
                createOrderMutation.isPending ||
                orderMutations.acceptServiceTerms.isPending
              }
              onClick={order ? acceptServiceTerms : createOrder}
            >
              {order
                ? 'Đồng ý và tiếp tục thanh toán'
                : createOrderMutation.isPending
                  ? 'Đang tạo...'
                  : 'Tạo đơn hàng'}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusHold() {
  return (
    <span className="status-chip status-chip--warning">
      Deadline được backend xác định sau khi tạo đơn
    </span>
  );
}
