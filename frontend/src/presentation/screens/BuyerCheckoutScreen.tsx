import { Alert, Button, Checkbox, Input, Select, Steps } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { products } from '../../infrastructure/catalog/mockCatalog';
import { primaryOrder } from '../../infrastructure/workspace/mockWorkspace';
import { OrderSummary } from '../components/OrderSummary';
import { PageHeader } from '../components/WorkspacePrimitives';

export function BuyerCheckoutScreen() {
  const navigate = useNavigate();
  const product = products[0]!;
  const [devices, setDevices] = useState(25);
  const [accepted, setAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  const order = primaryOrder;

  function createContract() {
    if (!accepted) {
      setShowError(true);
      return;
    }
    void navigate(`/buyer/contracts/${order.id}/sign`);
  }

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Hoàn tất mua bản quyền"
        description="Xác nhận doanh nghiệp, gói giá và điều khoản trước khi tạo hợp đồng."
        action={<Button>Thông báo</Button>}
      />
      <Steps
        current={1}
        items={[
          { title: 'Chọn gói' },
          { title: 'Xác nhận' },
          { title: 'Ký & thanh toán' },
        ]}
      />
      <div className="checkout-grid">
        <div className="checkout-stack">
          <section className="workspace-card section-card">
            <h2>Thông tin doanh nghiệp</h2>
            <div className="form-grid">
              <label>
                Tên doanh nghiệp
                <Input value="Công ty TNHH Minh An" readOnly />
              </label>
              <label>
                Mã số thuế
                <Input value="0312345678" readOnly />
              </label>
              <label className="full-field">
                Địa chỉ ký hợp đồng
                <Input value="12 Nguyễn Huệ, Quận 1, TP.HCM" readOnly />
              </label>
            </div>
          </section>
          <section className="workspace-card section-card">
            <h2>Cấu hình đơn hàng</h2>
            <div className="form-grid">
              <label>
                Gói
                <Select
                  aria-label="Gói"
                  value="Business"
                  options={[{ value: 'Business', label: 'Business' }]}
                />
              </label>
              <label>
                Số thiết bị
                <Select
                  aria-label="Số thiết bị"
                  value={devices}
                  onChange={setDevices}
                  options={product.plans.map((plan) => ({
                    value: plan.devices,
                    label: plan.label,
                  }))}
                />
              </label>
            </div>
            <p className="commerce-note">
              Khuyến mãi “Ưu đãi tháng 8” được tự động áp dụng. Không cần mã
              coupon.
            </p>
          </section>
          <section className="workspace-card section-card">
            <Checkbox
              checked={accepted}
              onChange={(event) => {
                setAccepted(event.target.checked);
                setShowError(false);
              }}
            >
              Tôi đã đọc điều khoản và chính sách hoàn tiền
            </Checkbox>
            <p className="muted-copy">
              Giá và khuyến mãi chỉ là preview UI; backend mới là nguồn quyết
              định.
            </p>
            {showError ? (
              <Alert
                message="Bạn cần đồng ý điều khoản trước khi tạo hợp đồng."
                role="alert"
                type="error"
              />
            ) : null}
          </section>
        </div>
        <aside className="checkout-stack">
          <OrderSummary order={{ ...order, devices }} />
          <section className="workspace-card section-card">
            <StatusHold />
            <p>
              Nếu thay đổi gói hoặc số thiết bị, backend sẽ tính lại khi được
              kết nối.
            </p>
          </section>
          <div className="workspace-actions">
            <Button onClick={() => void navigate('/products/securedesk')}>
              Quay lại
            </Button>
            <Button type="primary" onClick={createContract}>
              Tạo hợp đồng
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
      Giữ giá 30 phút · mô phỏng
    </span>
  );
}
