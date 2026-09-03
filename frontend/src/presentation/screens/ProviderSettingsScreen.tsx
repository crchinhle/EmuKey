import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Switch,
  Tabs,
  message,
} from 'antd';
import { useState } from 'react';

import { PageHeader } from '../components/WorkspacePrimitives';

export function ProviderSettingsScreen() {
  const [messageApi, contextHolder] = message.useMessage();
  const [company, setCompany] = useState('EmuKey Software');
  return (
    <>
      {contextHolder}
      <PageHeader
        title="Cài đặt nhà cung cấp"
        description="Thông tin doanh nghiệp và tùy chọn vận hành của tài khoản demo."
      />
      <Tabs
        items={[
          {
            key: 'profile',
            label: 'Doanh nghiệp & chính sách',
            children: (
              <div className="settings-grid">
                <Form
                  component="section"
                  className="workspace-card settings-card"
                  layout="vertical"
                >
                  <h2>Hồ sơ doanh nghiệp</h2>
                  <div className="form-grid">
                    <Form.Item label="Tên doanh nghiệp">
                      <Input
                        value={company}
                        onChange={(event) => setCompany(event.target.value)}
                      />
                    </Form.Item>
                    <Form.Item label="Email hỗ trợ">
                      <Input defaultValue="support@demo.emukey.vn" />
                    </Form.Item>
                    <Form.Item className="full-field" label="Website">
                      <Input defaultValue="https://demo.emukey.vn" />
                    </Form.Item>
                  </div>
                  <Button
                    type="primary"
                    onClick={() =>
                      void messageApi.success(`Đã lưu thông tin ${company}`)
                    }
                  >
                    Lưu thay đổi
                  </Button>
                </Form>
                <section className="workspace-card settings-card">
                  <h2>Chính sách mặc định</h2>
                  <label className="setting-row">
                    <span>
                      <strong>Tự động cấp license</strong>
                      <small>Sau khi thanh toán được đối soát.</small>
                    </span>
                    <Switch defaultChecked />
                  </label>
                  <label className="setting-row">
                    <span>
                      <strong>Cảnh báo quota</strong>
                      <small>Gửi cảnh báo khi đạt 80%.</small>
                    </span>
                    <Switch defaultChecked />
                  </label>
                  <label>
                    <span>Thời hạn license</span>
                    <Select
                      defaultValue="12"
                      options={[
                        { value: '12', label: '12 tháng' },
                        { value: '24', label: '24 tháng' },
                      ]}
                    />
                  </label>
                </section>
              </div>
            ),
          },
          {
            key: 'readiness',
            label: 'Tích hợp & readiness',
            children: (
              <section className="workspace-card settings-card">
                <h2>Trạng thái tích hợp</h2>
                <Alert
                  showIcon
                  type="warning"
                  message="Môi trường demo chưa kiểm tra kết nối thật"
                />
                <p>
                  SePay, Brevo, Cloudinary, Gemini và Blockchain sẽ được backend
                  kiểm tra qua adapter riêng.
                </p>
                <Button
                  onClick={() =>
                    void messageApi.info('Mô phỏng kiểm tra readiness')
                  }
                >
                  Kiểm tra readiness
                </Button>
              </section>
            ),
          },
        ]}
      />
    </>
  );
}
