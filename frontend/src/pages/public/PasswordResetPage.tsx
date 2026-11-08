import { ArrowLeft, BookOpen, CircleCheck, Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../services/apiClient';
import { authApi } from '../../services/authApi';
import type { Language } from '../../types';
import './LoginPage.css';
import './VerifyEmailPage.css';
import './PasswordResetPage.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function Shell({ success, children }: { success?: boolean; children: React.ReactNode }) {
  return (
    <main className="email-verification-page">
      <div className="email-verification-shell">
        <Link to="/" className="email-verification-brand">
          <BookOpen size={24} />
          <span>ĐƯỜNG SÁCH <small>TP. HỒ CHÍ MINH</small></span>
        </Link>
        <section className="email-verification-card" aria-labelledby="password-reset-title">
          <div className={`email-verification-icon ${success ? 'verified' : ''}`}>
            {success ? <CircleCheck size={38} /> : <KeyRound size={34} />}
          </div>
          <span className="email-verification-step">BẢO MẬT TÀI KHOẢN</span>
          {children}
        </section>
        <Link to="/login" className="email-verification-back">
          <ArrowLeft size={16} />
          <span>Quay lại đăng nhập</span>
        </Link>
      </div>
    </main>
  );
}

function RequestStep() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError('Vui lòng nhập một địa chỉ email hợp lệ.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await authApi.requestPasswordReset(value);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 422
        ? 'Vui lòng nhập một địa chỉ email hợp lệ.'
        : 'Chưa gửi được yêu cầu. Vui lòng thử lại sau.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Shell>
        <h1 id="password-reset-title">Kiểm tra hộp thư của bạn</h1>
        <p className="email-verification-description" role="status">
          Nếu email này thuộc một tài khoản đã xác minh, chúng tôi đã gửi liên kết đặt lại mật khẩu.
        </p>
        <ol className="email-verification-instructions">
          <li>Mở hộp thư, kiểm tra cả mục thư rác.</li>
          <li>Bấm liên kết trong thư. Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.</li>
          <li>Nếu không nhận được thư, hãy chờ một phút rồi gửi lại.</li>
        </ol>
        <button type="button" className="email-verification-primary" onClick={() => setSent(false)}>
          Gửi lại yêu cầu
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 id="password-reset-title">Quên mật khẩu</h1>
      <p className="email-verification-description">
        Nhập email đã xác minh của tài khoản. Chúng tôi sẽ gửi cho bạn một liên kết để đặt mật khẩu mới.
      </p>
      <form className="auth-form password-reset-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="password-reset-email">Email</label>
          <div className="auth-input-wrap">
            <Mail size={18} className="auth-input-icon" />
            <input
              id="password-reset-email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
              disabled={sending}
            />
          </div>
        </div>
        {error && <p className="email-verification-feedback error" role="alert">{error}</p>}
        <button type="submit" className="email-verification-primary" disabled={sending}>
          {sending ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
        </button>
      </form>
      <p className="email-verification-expiry">
        Tài khoản chưa có email đã xác minh không tự đặt lại mật khẩu được.
      </p>
    </Shell>
  );
}

function ConfirmStep({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password.length > 64 || byteLength(password) > 72) {
      setError('Mật khẩu mới cần từ 8 đến 64 ký tự.');
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authApi.confirmPasswordReset(token, password, confirmation);
      // The link is single-use, so it should not stay in the address bar or browser history.
      window.history.replaceState(null, '', '/reset-password');
      setDone(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        setLinkInvalid(true);
      } else if (cause instanceof ApiError && cause.status === 422) {
        setError('Mật khẩu mới chưa hợp lệ. Vui lòng kiểm tra lại.');
      } else {
        setError('Chưa đặt lại được mật khẩu. Vui lòng thử lại sau.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Shell success>
        <h1 id="password-reset-title">Đã đặt lại mật khẩu</h1>
        <p className="email-verification-description" role="status">
          Mật khẩu mới đã có hiệu lực. Các phiên đăng nhập trước đó đã được đăng xuất để bảo vệ tài khoản.
        </p>
        <Link className="email-verification-primary" to="/login">Đăng nhập</Link>
      </Shell>
    );
  }

  if (linkInvalid || !token) {
    return (
      <Shell>
        <h1 id="password-reset-title">Liên kết không còn hiệu lực</h1>
        <p className="email-verification-description" role="alert">
          Liên kết đặt lại mật khẩu không đúng, đã hết hạn hoặc đã được dùng. Bạn có thể yêu cầu một liên kết mới.
        </p>
        <Link className="email-verification-primary" to="/forgot-password">Yêu cầu liên kết mới</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 id="password-reset-title">Đặt mật khẩu mới</h1>
      <p className="email-verification-description">Mật khẩu mới cần từ 8 đến 64 ký tự.</p>
      <form className="auth-form password-reset-form" onSubmit={submit} noValidate>
        {(['Mật khẩu mới', 'Nhập lại mật khẩu mới'] as const).map((label, index) => (
          <div className="auth-field" key={label}>
            <label htmlFor={`password-reset-${index}`}>{label}</label>
            <div className="auth-input-wrap">
              <Lock size={18} className="auth-input-icon" />
              <input
                id={`password-reset-${index}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={index === 0 ? password : confirmation}
                onChange={event => (index === 0 ? setPassword : setConfirmation)(event.target.value)}
                disabled={saving}
              />
              {index === 0 && (
                <button
                  type="button"
                  className="auth-btn-eye"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
          </div>
        ))}
        {error && <p className="email-verification-feedback error" role="alert">{error}</p>}
        <button type="submit" className="email-verification-primary" disabled={saving}>
          {saving ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
        </button>
      </form>
    </Shell>
  );
}

export function PasswordResetPage({ language: _language }: { language: Language }) {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') || '');
  const isConfirmStep = window.location.pathname === '/reset-password';
  return isConfirmStep ? <ConfirmStep token={token} /> : <RequestStep />;
}
