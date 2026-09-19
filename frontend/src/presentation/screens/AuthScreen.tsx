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
    description: 'Đăng nhập để quản lý đơn hàng, License và thiết bị.',
    title: 'Chào mừng trở lại',
  },
  'licensing-action': {
    description: 'Đăng nhập bằng tài khoản người mua để tiếp tục thao tác bảo mật từ email.',
    title: 'Xác nhận thao tác License',
  },
  register: {
    description: 'Tạo tài khoản người mua Emukey. Bạn không cần tạo thêm khóa riêng cho tài khoản.',
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
  return value === 'forgot' || value === 'licensing-action' || value === 'register' || value === 'reset' || value === 'verify' ? value : 'login';
}

export function AuthScreen() {
  const { forgotPassword, login, register, resendVerification, resetPassword, user, verifyEmail } = useAuth();
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
  useEffect(() => {
    if (mode === 'licensing-action' && verificationToken && user?.role === 'CUSTOMER') {
      void navigate(`/buyer/licenses?actionToken=${encodeURIComponent(verificationToken)}`, { replace: true });
    }
  }, [mode, navigate, user?.role, verificationToken]);
  const copy = authCopy[mode];
  const selectMode = (nextMode: AuthMode) =>
    setSearchParams(nextMode === 'login' ? {} : { mode: nextMode });

  return (
    <main className="auth-screen">
      <section aria-labelledby="auth-story-title" className="auth-story">
        <Brand inverted />
        <h1 id="auth-story-title">Quản lý bản quyền phần mềm đa Provider bằng Blockchain</h1>
        <p>
          Thanh toán off-chain, quyền sử dụng được xác lập và kiểm chứng on-chain.
        </p>
        <ul className="benefit-list">
          <li><span aria-hidden="true">✓</span>Quản lý License và thiết bị</li>
          <li><span aria-hidden="true">✓</span>Theo dõi đơn hàng và thanh toán</li>
          <li><span aria-hidden="true">✓</span>Xác minh công khai trên Blockchain</li>
        </ul>
      </section>
      <section aria-label={copy.title} className="auth-area">
        <div className={`auth-card auth-card--${mode}`}>
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
          {mode === 'login' || mode === 'register' ? (
            <div aria-label="Chế độ xác thực" className="auth-tabs">
              {mode === 'login' ? <span>Đăng nhập</span> : (
                <Button onClick={() => selectMode('login')} type="link">Đăng nhập</Button>
              )}
              {mode === 'register' ? <span>Đăng ký</span> : (
                <Button onClick={() => selectMode('register')} type="link">Đăng ký</Button>
              )}
            </div>
          ) : null}
          {mode === 'login' || mode === 'licensing-action' ? (
            <>
              {mode === 'licensing-action' && !verificationToken ? (
                <Alert showIcon title="Liên kết xác nhận không hợp lệ." type="error" />
              ) : null}
              <LoginForm
                onForgotPassword={() => selectMode('forgot')}
                onLogin={login}
                onSuccess={(user) => {
                  const destination = mode === 'licensing-action' && user.role === 'CUSTOMER' && verificationToken
                    ? `/buyer/licenses?actionToken=${encodeURIComponent(verificationToken)}`
                    : user.role === 'CUSTOMER'
                      ? '/buyer'
                      : user.role === 'PROVIDER_ADMIN'
                        ? '/provider'
                        : user.role === 'SUPPORT_STAFF'
                          ? '/support'
                          : '/system/console';
                  void navigate(destination, { replace: mode === 'licensing-action' });
                }}
                submitLabel={mode === 'licensing-action' ? 'Đăng nhập và tiếp tục' : 'Đăng nhập'}
              />
              {mode === 'login' ? <small>Bảo mật phiên đăng nhập và giới hạn thử sai được bật.</small> : null}
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
