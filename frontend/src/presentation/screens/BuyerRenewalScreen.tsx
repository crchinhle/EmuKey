import { Alert, Button, Checkbox, Input, Result, Spin, Steps } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { describeApiError } from '../../application/auth/authContext';
import { useLicenses } from '../../application/licenses/licenseQueries';
import {
  type OrderDetail,
  useOrder,
  useOrderMutations,
  useOrderTerms,
} from '../../application/orders/orderQueries';
import { OrderSummary } from '../components/OrderSummary';
import { FactList, PageHeader, StatusChip } from '../components/WorkspacePrimitives';

export function BuyerRenewalScreen() {
  const { licenseId = '' } = useParams();
  const navigate = useNavigate();
  const licenses = useLicenses();
  const license = licenses.data?.find((item) => item.id === licenseId);
  const originOrder = useOrder(license?.originOrderId ?? '');
  const mutations = useOrderMutations();
  const [renewalOrder, setRenewalOrder] = useState<OrderDetail>();
  const terms = useOrderTerms(renewalOrder?.id ?? '');
  const [activationKey, setActivationKey] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (licenses.isPending) return <Spin aria-label="Đang tải License" />;
  if (licenses.isError || !license) {
    return <Result status="404" title="Không tìm thấy License cần gia hạn" />;
  }
  if (originOrder.isPending) return <Spin aria-label="Đang tải gói gia hạn" />;
  if (originOrder.isError || !originOrder.data) {
    return <Result status="error" title="Không thể tải gói hiện tại của License" />;
  }

  const createRenewal = () => {
    if (!activationKey.trim()) {
      setValidationError('Nhập activation key hiện tại để xác nhận quyền gia hạn.');
      return;
    }
    setValidationError(null);
    mutations.create.mutate(
      {
        licenseKey: activationKey.trim(),
        planId: originOrder.data.planId,
        targetLicenseId: license.id,
      },
      { onSuccess: setRenewalOrder },
    );
  };

  const acceptRenewalTerms = () => {
    if (!renewalOrder || !accepted) {
      setValidationError('Bạn cần đọc và đồng ý điều khoản trước khi thanh toán.');
      return;
    }
    setValidationError(null);
    mutations.acceptServiceTerms.mutate(renewalOrder, {
      onSuccess: (order) => void navigate(`/buyer/orders/${order.id}/payment`),
    });
  };

  const requestError = mutations.create.error ?? mutations.acceptServiceTerms.error ?? terms.error;

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Gia hạn License"
      />
      <Steps
        current={renewalOrder ? 1 : 0}
        items={[{ title: 'Xác nhận License' }, { title: 'Điều khoản' }, { title: 'Thanh toán' }]}
      />
      <div className="checkout-grid">
        <div className="checkout-stack">
          <section className="workspace-card section-card">
            <h2>License hiện tại</h2>
            <FactList facts={[
              { label: 'Mã License', value: license.publicLicenseId },
              { label: 'Sản phẩm', value: license.productName },
              { label: 'Gói', value: originOrder.data.planNameSnapshot },
              { label: 'Hết hạn hiện tại', value: new Date(license.expiresAt).toLocaleDateString('vi-VN') },
              { label: 'Trạng thái', value: <StatusChip tone={license.status === 'ACTIVE' ? 'success' : 'warning'}>{license.status}</StatusChip> },
            ]} />
          </section>
          <section className="workspace-card section-card">
            {!renewalOrder ? (
              <>
                <h2>Xác nhận activation key</h2>
                <p className="muted-copy">Key chỉ được gửi qua header bảo mật để backend xác minh, không được lưu trong đơn hàng.</p>
                <Input.Password
                  aria-label="Activation key hiện tại"
                  autoComplete="off"
                  onChange={(event) => setActivationKey(event.target.value)}
                  placeholder="Nhập activation key hiện tại"
                  value={activationKey}
                />
              </>
            ) : terms.isPending ? (
              <Spin aria-label="Đang tải điều khoản gia hạn" />
            ) : terms.data ? (
              <>
                <h2>Điều khoản gia hạn</h2>
                <pre className="terms-document">{terms.data.content}</pre>
                <p className="muted-copy">Service Terms áp dụng cho từng đơn gia hạn.</p>
                <Checkbox checked={accepted} onChange={(event) => setAccepted(event.target.checked)}>
                  Tôi đã đọc và đồng ý với điều khoản gia hạn
                </Checkbox>
              </>
            ) : null}
            {validationError || requestError ? (
              <Alert
                showIcon
                role="alert"
                type="error"
                message={validationError ?? describeApiError(requestError, 'Không thể tạo đơn gia hạn.')}
              />
            ) : null}
          </section>
        </div>
        <aside className="checkout-stack">
          <OrderSummary order={{ total: renewalOrder?.priceVndSnapshot ?? originOrder.data.priceVndSnapshot }} />
          <Alert
            showIcon
            type="info"
            message="Gia hạn không cộng thời gian ngay khi SePay báo thành công. Worker chỉ cập nhật sau event blockchain đã xác nhận."
          />
          <div className="workspace-actions">
            <Button onClick={() => void navigate('/buyer/licenses')}>Quay lại</Button>
            <Button
              disabled={renewalOrder ? !accepted || terms.isPending : !activationKey.trim()}
              loading={mutations.create.isPending || mutations.acceptServiceTerms.isPending}
              onClick={renewalOrder ? acceptRenewalTerms : createRenewal}
              type="primary"
            >
              {renewalOrder ? 'Đồng ý và thanh toán' : 'Tạo đơn gia hạn'}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
