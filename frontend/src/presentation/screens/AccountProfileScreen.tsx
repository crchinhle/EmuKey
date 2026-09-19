import { Alert, Button, Form, Input, Tag } from 'antd';
import { useState } from 'react';

import {
  describeApiError,
  type ProfileInput,
  useAuth,
} from '../../application/auth/authContext';
import { PageHeader } from '../components/WorkspacePrimitives';

const roleLabels: Record<string, string> = {
  CUSTOMER: 'Người mua',
  PROVIDER_ADMIN: 'Provider',
  SUPPORT_STAFF: 'Hỗ trợ',
  SYSTEM_ADMIN: 'Quản trị hệ thống',
};

export function AccountProfileScreen() {
  const { updateProfile, user } = useAuth();
  const [form] = Form.useForm<ProfileInput>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const submit = async (values: ProfileInput) => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({
        displayName: values.displayName.trim(),
        ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
        ...(values.address?.trim() ? { address: values.address.trim() } : {}),
        ...(user.role === 'PROVIDER_ADMIN'
          ? values.organizationName?.trim()
            ? { organizationName: values.organizationName.trim() }
            : {}
          : {}),
      });
      setSaved(true);
    } catch (cause) {
      setError(
        describeApiError(cause, 'Không thể cập nhật hồ sơ. Vui lòng thử lại.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Hồ sơ tài khoản"
        description="Quản lý thông tin liên hệ gắn với tài khoản Emukey đang đăng nhập."
        action={<Tag color={user.status === 'ACTIVE' ? 'green' : 'orange'}>{user.status}</Tag>}
      />
      <div className="workspace-two-column profile-layout">
        <section className="workspace-card section-card">
          <h2>Thông tin cá nhân</h2>
          <Form
            form={form}
            initialValues={{
              address: user.address ?? '',
              displayName: user.displayName,
              organizationName: user.organizationName ?? '',
              phone: user.phone ?? '',
            }}
            layout="vertical"
            onFinish={(values) => void submit(values)}
          >
            <Form.Item
              label="Tên hiển thị"
              name="displayName"
              rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị.' }, { max: 255 }]}
            >
              <Input autoComplete="name" />
            </Form.Item>
            <Form.Item label="Email">
              <Input disabled value={user.email} />
            </Form.Item>
            <Form.Item label="Số điện thoại" name="phone" rules={[{ max: 30 }]}>
              <Input autoComplete="tel" />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="address" rules={[{ max: 500 }]}>
              <Input.TextArea autoComplete="street-address" rows={3} />
            </Form.Item>
            {user.role === 'PROVIDER_ADMIN' ? (
              <Form.Item
                label="Tên tổ chức"
                name="organizationName"
                rules={[{ max: 255 }]}
              >
                <Input autoComplete="organization" />
              </Form.Item>
            ) : null}
            {saved ? <Alert showIcon type="success" message="Đã cập nhật hồ sơ." /> : null}
            {error ? <Alert showIcon role="alert" type="error" message={error} /> : null}
            <Button htmlType="submit" loading={saving} type="primary">
              Lưu thay đổi
            </Button>
          </Form>
        </section>
        <aside className="workspace-card section-card profile-summary">
          <span className="status-chip status-chip--neutral">{roleLabels[user.role] ?? user.role}</span>
          <h2>{user.displayName}</h2>
          <p>{user.email}</p>
          <small>
            Email và vai trò được bảo vệ bởi hệ thống xác thực, không thay đổi tại màn hình này.
          </small>
        </aside>
      </div>
    </>
  );
}
