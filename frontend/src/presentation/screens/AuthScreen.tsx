import { Alert, Button } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../application/auth/authContext';
import { Brand } from '../components/Brand';
import {
  type AuthMode,
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
  ResetPasswordForm,
} from '../components/AuthForms';

const authCopy: Record<AuthMode, { description: string; title: string }> = {
  forgot: {
    description: 'Nhập email tài khoản để nhận hướng dẫn đặt lại mật khẩu.',
    title: 'Quên mật khẩu',
  },
  login: {
    description: 'Đăng nhập để quản lý đơn hàng, license và tài khoản EmuKey.',
    title: 'Đăng nhập',
  },
  register: {
    description: 'Tạo tài khoản người mua EmuKey. Bạn không cần tạo thêm khóa riêng cho tài khoản.',
    title: 'Đăng ký tài khoản',
  },
  reset: {
    description: 'Tạo mật khẩu mới bằng mã khôi phục được gửi qua email.',
    title: 'Đặt lại mật khẩu',
  },
  verify: {
    description: 'Chúng tôi đã gửi liên kết xác minh đến email của bạn.',
    title: 'Xác minh email',
  },
};

function resolveAuthMode(value: string | null): AuthMode {
  return value === 'forgot' || value === 'register' || value === 'reset' || value === 'verify' ? value : 'login';
}

export function AuthScreen() {
  const { forgotPassword, login, register, resendVerification, resetPassword, verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = resolveAuthMode(searchParams.get('mode'));
  const [verification, setVerification] = useState<'failed' | 'pending' | 'verified' | null>(null);
  const verificationToken = searchParams.get('token');
  useEffect(() => {
    if (mode !== 'verify' || !verificationToken || verification) return;
    setVerification('pending');
    void verifyEmail(verificationToken)
      .then(() => setVerification('verified'))
      .catch(() => setVerification('failed'));
  }, [mode, verification, verificationToken, verifyEmail]);
  const copy = authCopy[mode];
  const selectMode = (nextMode: AuthMode) =>
    setSearchParams(nextMode === 'login' ? {} : { mode: nextMode });

  return (
    <main className="auth-screen">
      <section aria-labelledby="auth-story-title" className="auth-story">
        <Brand inverted />
        <h1 id="auth-story-title">Một tài khoản cho mọi license</h1>
        <p>
          Đơn hàng và license gắn với tài khoản EmuKey của bạn. Activation key vẫn
          hoạt động như một bearer key, không có thêm khóa riêng theo tài khoản.
        </p>
        <Button onClick={() => void navigate('/products')}>Xem sản phẩm</Button>
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
              ←
            </Button>
          ) : null}
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          {mode === 'login' ? (
            <>
              <LoginForm
                onForgotPassword={() => selectMode('forgot')}
                onLogin={login}
                onSuccess={(user) => void navigate(
                  user.role === 'CUSTOMER'
                    ? '/buyer'
                    : user.role === 'PROVIDER_ADMIN'
                      ? '/provider'
                      : user.role === 'SUPPORT_STAFF'
                        ? '/support'
                        : '/system/console',
                )}
              />
              <Button block onClick={() => selectMode('register')} type="link">Đăng ký</Button>
            </>
          ) : null}
          {mode === 'register' ? (
            <RegisterForm onRegister={register} onRegistered={(email) => setSearchParams({ mode: 'verify', email })} />
          ) : null}
          {mode === 'verify' ? (
            <>
              {verification === 'pending' ? <Alert showIcon title="Đang xác minh email..." type="info" /> : null}
              {verification === 'verified' ? <Alert showIcon title="Email đã được xác minh. Bạn có thể đăng nhập." type="success" /> : null}
              {verification === 'failed' ? <Alert showIcon title="Liên kết xác minh không hợp lệ hoặc đã hết hạn." type="error" /> : null}
              {verification === 'verified' ? (
                <Button block onClick={() => selectMode('login')} type="primary">Đăng nhập</Button>
              ) : (
                <Button block disabled={!searchParams.get('email')} onClick={() => void resendVerification(searchParams.get('email') ?? '')} type="primary">Gửi lại email xác minh</Button>
              )}
            </>
          ) : null}
          {mode === 'forgot' ? (
            <ForgotPasswordForm onForgotPassword={forgotPassword} />
          ) : null}
          {mode === 'reset' ? (
            <ResetPasswordForm onResetPassword={resetPassword} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
