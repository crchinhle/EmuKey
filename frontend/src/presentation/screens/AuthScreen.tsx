import { Button } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Brand } from '../components/Brand';
import {
  type AuthMode,
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
} from '../components/AuthForms';

const benefits = [
  'Kiểm soát license theo thiết bị',
  'Theo dõi hợp đồng và thanh toán',
  'Xác minh công khai trên Blockchain',
] as const;

const authCopy: Record<
  AuthMode,
  { readonly description: string; readonly title: string }
> = {
  forgot: {
    description: 'Nhập email để nhận hướng dẫn đặt lại mật khẩu.',
    title: 'Quên mật khẩu',
  },
  login: {
    description: 'Đăng nhập để quản lý hợp đồng và giấy phép của bạn.',
    title: 'Chào mừng trở lại',
  },
  register: {
    description: 'Tạo tài khoản khách hàng để bắt đầu sử dụng EmuKey.',
    title: 'Tạo tài khoản',
  },
};

function resolveAuthMode(value: string | null): AuthMode {
  return value === 'forgot' || value === 'register' ? value : 'login';
}

export function AuthScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = resolveAuthMode(searchParams.get('mode'));
  const copy = authCopy[mode];

  const selectMode = (nextMode: AuthMode) => {
    setSearchParams(nextMode === 'login' ? {} : { mode: nextMode });
  };

  return (
    <main className="auth-screen">
      <section aria-labelledby="auth-story-title" className="auth-story">
        <Brand inverted />
        <h1 id="auth-story-title">
          Quản lý bản quyền phần mềm minh bạch và an toàn
        </h1>
        <p>
          Hợp đồng điện tử, thanh toán SePay, AI hỗ trợ và bằng chứng Blockchain
          trong một nền tảng thống nhất.
        </p>
        <ul className="benefit-list">
          {benefits.map((benefit) => (
            <li key={benefit}>
              <span aria-hidden="true">✓</span>
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={copy.title} className="auth-area">
        <div className="auth-card">
          {mode !== 'login' ? (
            <Button
              aria-label="Quay lại đăng nhập"
              className="auth-back"
              onClick={() => selectMode('login')}
              type="text"
            >
              <span aria-hidden="true">←</span>
            </Button>
          ) : null}
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          {mode === 'login' ? (
            <>
              <div aria-label="Chế độ tài khoản" className="auth-tabs">
                <span>Đăng nhập</span>
                <Button onClick={() => selectMode('register')} type="link">
                  Đăng ký
                </Button>
              </div>
              <LoginForm
                onForgotPassword={() => selectMode('forgot')}
                onSuccess={() => void navigate('/products')}
              />
              <small>
                Bảo mật phiên đăng nhập và giới hạn thử sai được bật.
              </small>
            </>
          ) : null}
          {mode === 'register' ? <RegisterForm /> : null}
          {mode === 'forgot' ? <ForgotPasswordForm /> : null}
        </div>
      </section>
    </main>
  );
}
