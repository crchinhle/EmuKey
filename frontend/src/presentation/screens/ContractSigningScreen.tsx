import { Alert, Button, Checkbox, Input } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  orders,
  primaryOrder,
} from '../../infrastructure/workspace/mockWorkspace';
import {
  PageHeader,
  StatusChip,
  formatMoney,
} from '../components/WorkspacePrimitives';

export function ContractSigningScreen() {
  const navigate = useNavigate();
  const { id = primaryOrder.id } = useParams();
  const order = orders.find((item) => item.id === id) ?? primaryOrder;
  const [otp, setOtp] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(false);

  function signContract() {
    if (!otp.trim() || !accepted) {
      setError(true);
      return;
    }
    void navigate(`/buyer/orders/${order.id}/payment`, {
      state: { signedDemo: true },
    });
  }

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Ký hợp đồng điện tử"
        description="Kiểm tra nội dung trước khi ký; PDF sau ký sẽ được lưu bất biến ở hệ thống thật."
        action={<Button>Trợ giúp</Button>}
      />
      <Alert
        showIcon
        message="Vui lòng kiểm tra thông tin. Thay đổi gói hoặc số thiết bị sẽ sinh lại hợp đồng."
        type="info"
      />
      <div className="signing-grid">
        <section className="workspace-card contract-preview">
          <header>
            <strong>HĐ-2026-000128.pdf</strong>
            <Button type="link">Tải xuống</Button>
            <Button>100%</Button>
          </header>
          <article className="document-sheet">
            <h2>HỢP ĐỒNG CẤP QUYỀN PHẦN MỀM</h2>
            <strong>Số: HĐ-2026-000128</strong>
            <p>Bên cấp quyền: EmuKey Software</p>
            <p>Bên mua: Công ty TNHH Minh An</p>
            <p>
              Sản phẩm: {order.product} · Gói {order.plan}
            </p>
            <p>Phạm vi: {order.devices} thiết bị · 12 tháng</p>
            <p>
              Giá trị sau khuyến mãi:{' '}
              <strong>{formatMoney(order.total)}</strong>
            </p>
            <hr />
            <small>
              Điều khoản sử dụng và trách nhiệm của các bên được trình bày trong
              6 trang mô phỏng.
            </small>
          </article>
        </section>
        <aside className="workspace-card signature-panel">
          <StatusChip tone="warning">Chưa ký</StatusChip>
          <h2>Xác nhận chữ ký</h2>
          <p>Người ký đại diện</p>
          <strong>Nguyễn Minh An · Giám đốc</strong>
          <div className="signature-sample">
            <strong>Nguyễn Minh An</strong>
            <small>Chữ ký điện tử mẫu</small>
          </div>
          <label>
            Mã xác nhận OTP
            <Input.Password
              aria-label="Mã xác nhận OTP"
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value);
                setError(false);
              }}
            />
          </label>
          <Checkbox
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked);
              setError(false);
            }}
          >
            Tôi xác nhận đã đọc toàn bộ hợp đồng
          </Checkbox>
          {error ? (
            <Alert
              message="Nhập OTP và xác nhận đã đọc hợp đồng."
              role="alert"
              type="error"
            />
          ) : null}
          <Button type="primary" onClick={signContract}>
            Ký hợp đồng
          </Button>
          <small>
            Mô phỏng UI: không tạo chữ ký mật mã hay bằng chứng pháp lý.
          </small>
        </aside>
      </div>
    </div>
  );
}
