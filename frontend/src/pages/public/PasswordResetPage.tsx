import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NotificationCallout } from '../../components/ui/NotificationCallout';
import { ApiError } from '../../services/apiClient';
import { authApi } from '../../services/authApi';
import type { Language } from '../../types';
import './LoginPage.css';
import './PasswordResetPage.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

/** Same frame as the sign-in page, so the reset flow feels like part of it. */
function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth-page-root">
      <div className="auth-bg-layer" aria-hidden="true">
        <div className="auth-glow-spot auth-glow-1"></div>
        <div className="auth-glow-spot auth-glow-2"></div>
        <div className="auth-motif-pattern-overlay"></div>
        <div className="auth-realistic-artwork-wrap drum-top-left">
          <img src="/dong_son_bronze_drum.jpg" alt="" className="auth-realistic-drum-img" />
        </div>
        <div className="auth-realistic-artwork-wrap book-bottom-right">
          <img src="/vintage_book_ornament.jpg" alt="" className="auth-realistic-book-img" />
        </div>
        <div className="auth-gold-particle particle-1"></div>
        <div className="auth-gold-particle particle-2"></div>
        <div className="auth-gold-particle particle-3"></div>
      </div>

      <div className="auth-container">
        <div className="auth-top-nav">
          <Link to="/login" className="auth-back-link">
            <ArrowLeft size={16} />
            <span>Quay lại Đăng nhập</span>
          </Link>
        </div>

        <div className="auth-card">
          <div className="auth-card-inner-border" aria-hidden="true"></div>
          <div className="auth-card-motif-band band-top" aria-hidden="true"></div>
          <div className="auth-card-motif-band band-bottom" aria-hidden="true"></div>
          <div className="auth-card-corner corner-top-left" aria-hidden="true"></div>
          <div className="auth-card-corner corner-top-right" aria-hidden="true"></div>
          <div className="auth-card-corner corner-bottom-left" aria-hidden="true"></div>
          <div className="auth-card-corner corner-bottom-right" aria-hidden="true"></div>
          <div className="auth-card-notch notch-left" aria-hidden="true"></div>
          <div className="auth-card-notch notch-right" aria-hidden="true"></div>

          <div className="auth-header">
            <Link to="/" className="auth-brand-badge" title="Đường Sách TP.HCM">
              <div className="auth-brand-icon password-reset-logo">
                <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" />
              </div>
            </Link>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ busy, busyLabel, label }: { busy: boolean; busyLabel: string; label: string }) {
  return (
    <button type="submit" className="auth-submit-btn" disabled={busy}>
      {busy ? (
        <span className="auth-btn-loading-content">
          <span className="auth-spinner"></span>
          <span>{busyLabel}</span>
        </span>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight size={18} className="auth-btn-arrow" />
        </>
      )}
    </button>
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
      <AuthFrame
        title="Kiểm tra hộp thư"
        subtitle="Liên kết đặt lại mật khẩu có hiệu lực trong 30 phút và chỉ dùng được một lần."
      >
        <NotificationCallout variant="success" title="Đã ghi nhận yêu cầu">
          Nếu email này thuộc một tài khoản đã xác minh, chúng tôi đã gửi liên kết đặt lại mật khẩu.
          Hãy kiểm tra cả mục thư rác.
        </NotificationCallout>
        <div className="auth-switch-section">
          <span>Chưa nhận được thư? </span>
          <button type="button" className="auth-switch-link password-reset-text-btn" onClick={() => setSent(false)}>
            Gửi lại yêu cầu
          </button>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Quên mật khẩu"
      subtitle="Nhập email đã xác minh của tài khoản, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới."
    >
      {error && <NotificationCallout variant="error" title="Chưa gửi được">{error}</NotificationCallout>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="password-reset-email">Email</label>
          <div className="auth-input-wrap">
            <Mail size={18} className="auth-input-icon" />
            <input
              id="password-reset-email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="Ví dụ: ban@example.com"
              value={email}
              onChange={event => {
                setEmail(event.target.value);
                if (error) setError('');
              }}
              disabled={sending}
            />
          </div>
        </div>
        <SubmitButton busy={sending} busyLabel="Đang gửi..." label="Gửi liên kết đặt lại" />
      </form>
      <div className="auth-switch-section">
        <span>Nhớ ra mật khẩu rồi? </span>
        <Link to="/login" className="auth-switch-link">Đăng nhập</Link>
      </div>
    </AuthFrame>
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
      <AuthFrame title="Đã đặt lại mật khẩu" subtitle="Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.">
        <NotificationCallout variant="success" title="Hoàn tất">
          Mật khẩu mới đã có hiệu lực. Các phiên đăng nhập trước đó đã được đăng xuất để bảo vệ tài khoản.
        </NotificationCallout>
        <Link to="/login" className="auth-submit-btn password-reset-link-btn">
          <span>Đăng nhập</span>
          <ArrowRight size={18} className="auth-btn-arrow" />
        </Link>
      </AuthFrame>
    );
  }

  if (linkInvalid || !token) {
    return (
      <AuthFrame title="Liên kết không còn hiệu lực" subtitle="Bạn có thể yêu cầu một liên kết mới bằng email đã xác minh.">
        <NotificationCallout variant="error" title="Không dùng được liên kết">
          Liên kết đặt lại mật khẩu không đúng, đã hết hạn hoặc đã được dùng.
        </NotificationCallout>
        <Link to="/forgot-password" className="auth-submit-btn password-reset-link-btn">
          <span>Yêu cầu liên kết mới</span>
          <ArrowRight size={18} className="auth-btn-arrow" />
        </Link>
      </AuthFrame>
    );
  }

  const fields = [
    { id: 'password-reset-new', label: 'Mật khẩu mới', value: password, set: setPassword, placeholder: 'Từ 8 đến 64 ký tự' },
    { id: 'password-reset-confirm', label: 'Nhập lại mật khẩu mới', value: confirmation, set: setConfirmation, placeholder: 'Nhập lại mật khẩu' },
  ];

  return (
    <AuthFrame title="Đặt mật khẩu mới" subtitle="Chọn một mật khẩu mới cho tài khoản của bạn.">
      {error && <NotificationCallout variant="error" title="Chưa đặt lại được">{error}</NotificationCallout>}
      <form className="auth-form" onSubmit={submit} noValidate>
        {fields.map((field, index) => (
          <div className="auth-field" key={field.id}>
            <label htmlFor={field.id}>{field.label}</label>
            <div className="auth-input-wrap">
              <Lock size={18} className="auth-input-icon" />
              <input
                id={field.id}
                type={showPassword ? 'text' : 'password'}
                autoFocus={index === 0}
                maxLength={64}
                autoComplete="new-password"
                placeholder={field.placeholder}
                value={field.value}
                onChange={event => {
                  field.set(event.target.value);
                  if (error) setError('');
                }}
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
        <SubmitButton busy={saving} busyLabel="Đang lưu..." label="Đặt mật khẩu mới" />
      </form>
    </AuthFrame>
  );
}

export function PasswordResetPage({ language: _language }: { language: Language }) {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') || '');
  const isConfirmStep = window.location.pathname === '/reset-password';
  return isConfirmStep ? <ConfirmStep token={token} /> : <RequestStep />;
}
