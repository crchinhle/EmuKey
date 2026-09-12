import { Alert, Button, Checkbox, Form, Input, Select } from 'antd';
import { useState } from 'react';

import type { AuthUser, RegisterInput } from '../../application/auth/authContext';

export type AuthMode = 'forgot' | 'login' | 'register' | 'reset' | 'verify';

const emailRules = [
  { message: 'Vui lòng nhập email.', required: true },
  { message: 'Email chưa đúng định dạng.', type: 'email' as const },
];
const passwordComplexityRule = {
  message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt.',
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/,
};

export function LoginForm({
  onForgotPassword,
  onLogin,
  onSuccess,
}: {
  readonly onForgotPassword: () => void;
  readonly onLogin: (email: string, password: string) => Promise<AuthUser>;
  readonly onSuccess: (user: AuthUser) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <Form
      layout="vertical"
      onFinish={(values: { email: string; password: string }) => {
        setLoading(true);
        setError(null);
        void onLogin(values.email, values.password)
          .then((user) => onSuccess(user))
          .catch(() => setError('Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.'))
          .finally(() => setLoading(false));
      }}
    >
      {error ? <Alert message={error} role="alert" type="error" /> : null}
      <Form.Item label="Email" name="email" rules={emailRules}>
        <Input autoComplete="email" inputMode="email" />
      </Form.Item>
      <Form.Item
        extra="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
        label="Mật khẩu"
        name="password"
        rules={[
          { message: 'Vui lòng nhập mật khẩu.', required: true },
          { message: 'Mật khẩu cần có ít nhất 8 ký tự.', min: 8 },
          passwordComplexityRule,
        ]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <div className="remember-row">
        <Form.Item name="remember" noStyle valuePropName="checked">
          <Checkbox>Ghi nhớ đăng nhập</Checkbox>
        </Form.Item>
        <Button onClick={onForgotPassword} type="link">Quên mật khẩu?</Button>
      </div>
      <Button block htmlType="submit" loading={loading} type="primary">Đăng nhập</Button>
    </Form>
  );
}

export function RegisterForm({
  onRegister,
  onRegistered,
}: {
  readonly onRegister: (input: RegisterInput) => Promise<void>;
  readonly onRegistered: (email: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <Form
      initialValues={{ customerType: 'INDIVIDUAL' }}
      layout="vertical"
      onFinish={(values: RegisterInput & { passwordConfirmation: string }) => {
        setLoading(true);
        setError(null);
        void onRegister(values)
          .then(() => onRegistered(values.email))
          .catch(() => setError('Không thể tạo tài khoản. Email có thể đã được sử dụng.'))
          .finally(() => setLoading(false));
      }}
    >
      {error ? <Alert message={error} role="alert" type="error" /> : null}
      <Form.Item label="Họ và tên" name="displayName" rules={[{ required: true }, { max: 255 }]}>
        <Input autoComplete="name" />
      </Form.Item>
      <Form.Item label="Loại khách hàng" name="customerType" rules={[{ required: true }]}>
        <Select options={[
          { label: 'Cá nhân', value: 'INDIVIDUAL' },
          { label: 'Học sinh / sinh viên', value: 'STUDENT' },
          { label: 'Doanh nghiệp', value: 'BUSINESS' },
        ]} />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={emailRules}>
        <Input autoComplete="email" inputMode="email" />
      </Form.Item>
      <Form.Item label="Mật khẩu" name="password" rules={[{ required: true }, { min: 8 }, passwordComplexityRule]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        dependencies={['password']}
        label="Xác nhận mật khẩu"
        name="passwordConfirmation"
        rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Mật khẩu xác nhận không khớp.')); } })]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button block htmlType="submit" loading={loading} type="primary">Tạo tài khoản</Button>
    </Form>
  );
}

export function ForgotPasswordForm({
  onForgotPassword,
}: {
  readonly onForgotPassword: (email: string) => Promise<void>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (submitted) {
    return <Alert showIcon type="info" message="Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi." />;
  }
  return (
    <Form
      layout="vertical"
      onFinish={(values: { email: string }) => {
        setLoading(true);
        setError(null);
        void onForgotPassword(values.email)
          .then(() => setSubmitted(true))
          .catch(() => setError('Không thể gửi yêu cầu lúc này.'))
          .finally(() => setLoading(false));
      }}
    >
      {error ? <Alert message={error} role="alert" type="error" /> : null}
      <Form.Item label="Email" name="email" rules={emailRules}>
        <Input autoComplete="email" inputMode="email" />
      </Form.Item>
      <Button block htmlType="submit" loading={loading} type="primary">Gửi hướng dẫn</Button>
    </Form>
  );
}

export function ResetPasswordForm({
  onResetPassword,
}: {
  readonly onResetPassword: (token: string, password: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <Form
      layout="vertical"
      onFinish={(values: { password: string; passwordConfirmation: string; token: string }) => {
        setLoading(true);
        setError(null);
        void onResetPassword(values.token, values.password)
          .catch(() => setError('Không thể đặt lại mật khẩu. Mã có thể đã hết hạn.'))
          .finally(() => setLoading(false));
      }}
    >
      {error ? <Alert message={error} role="alert" type="error" /> : null}
      <Form.Item label="Mã đặt lại mật khẩu" name="token" rules={[{ required: true }]}>
        <Input autoComplete="one-time-code" />
      </Form.Item>
      <Form.Item
        label="Mật khẩu mới"
        name="password"
        rules={[{ required: true }, { min: 12 }, passwordComplexityRule]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        dependencies={['password']}
        label="Xác nhận mật khẩu mới"
        name="passwordConfirmation"
        rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator(_, value) {
              return !value || getFieldValue('password') === value
                ? Promise.resolve()
                : Promise.reject(new Error('Mật khẩu xác nhận không khớp.'));
            },
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button block htmlType="submit" loading={loading} type="primary">Đặt lại mật khẩu</Button>
    </Form>
  );
}
