import { Alert, Button, Checkbox, Form, Input, Select } from 'antd';
import { useState } from 'react';

export type AuthMode = 'forgot' | 'login' | 'register';

interface LoginFormProps {
  readonly onForgotPassword: () => void;
  readonly onSuccess: () => void;
}

const customerTypes = [
  { label: 'Học sinh', value: 'STUDENT' },
  { label: 'Giáo viên', value: 'TEACHER' },
  { label: 'Trung tâm STEM', value: 'STEM_CENTER' },
  { label: 'Trường học', value: 'SCHOOL' },
] as const;

const emailRules = [
  { message: 'Vui lòng nhập email.', required: true },
  { message: 'Email chưa đúng định dạng.', type: 'email' as const },
];

export function LoginForm({
  onForgotPassword,
  onSuccess,
}: LoginFormProps) {
  return (
    <Form
      initialValues={{
        email: 'buyer@company.vn',
        password: '123456789012',
        remember: false,
      }}
      layout="vertical"
      onFinish={onSuccess}
    >
      <Form.Item label="Email" name="email" rules={emailRules}>
        <Input autoComplete="email" inputMode="email" />
      </Form.Item>
      <Form.Item
        label="Mật khẩu"
        name="password"
        rules={[{ message: 'Vui lòng nhập mật khẩu.', required: true }]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <div className="remember-row">
        <Form.Item name="remember" noStyle valuePropName="checked">
          <Checkbox>Ghi nhớ đăng nhập</Checkbox>
        </Form.Item>
        <Button onClick={onForgotPassword} type="link">
          Quên mật khẩu?
        </Button>
      </div>
      <Button block htmlType="submit" type="primary">
        Đăng nhập
      </Button>
    </Form>
  );
}

export function RegisterForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Alert
        aria-label="Kiểm tra email để xác minh tài khoản"
        className="auth-result"
        description="Tài khoản đang ở trạng thái chờ xác minh. Hãy mở liên kết được gửi qua email trước khi đăng nhập."
        message="Kiểm tra email để xác minh tài khoản"
        role="status"
        showIcon
        type="success"
      />
    );
  }

  return (
    <Form layout="vertical" onFinish={() => setSubmitted(true)}>
      <Form.Item
        label="Họ và tên"
        name="displayName"
        rules={[
          { message: 'Vui lòng nhập họ và tên.', required: true, whitespace: true },
          { max: 255, message: 'Họ và tên không được quá 255 ký tự.' },
        ]}
      >
        <Input autoComplete="name" />
      </Form.Item>
      <Form.Item
        label="Loại khách hàng"
        name="customerType"
        rules={[{ message: 'Vui lòng chọn loại khách hàng.', required: true }]}
      >
        <Select options={[...customerTypes]} placeholder="Chọn loại khách hàng" />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={emailRules}>
        <Input autoComplete="email" inputMode="email" />
      </Form.Item>
      <Form.Item
        extra="Tối thiểu 12 ký tự."
        label="Mật khẩu"
        name="password"
        rules={[
          { message: 'Vui lòng nhập mật khẩu.', required: true },
          { message: 'Mật khẩu cần có ít nhất 12 ký tự.', min: 12 },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        dependencies={['password']}
        label="Xác nhận mật khẩu"
        name="passwordConfirmation"
        rules={[
          { message: 'Vui lòng xác nhận mật khẩu.', required: true },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }

              return Promise.reject(
                new Error('Mật khẩu xác nhận không khớp.'),
              );
            },
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button block htmlType="submit" type="primary">
        Tạo tài khoản
      </Button>
    </Form>
  );
}

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Alert
        aria-label="Yêu cầu đặt lại mật khẩu đã được tiếp nhận"
        className="auth-result"
        description="Nếu email thuộc một tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi."
        message="Yêu cầu đặt lại mật khẩu đã được tiếp nhận"
        role="alert"
        showIcon
        type="info"
      />
    );
  }

  return (
    <Form layout="vertical" onFinish={() => setSubmitted(true)}>
      <Form.Item label="Email" name="email" rules={emailRules}>
        <Input autoComplete="email" inputMode="email" />
      </Form.Item>
      <Button block htmlType="submit" type="primary">
        Gửi hướng dẫn
      </Button>
    </Form>
  );
}
