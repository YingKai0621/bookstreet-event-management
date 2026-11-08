import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { NotificationCallout } from '../../components/ui/NotificationCallout';
import { Language } from '../../types';
import type { AccountResponse } from '../../types/auth';
import './LoginPage.css';

interface LoginPageProps {
  language: Language;
  onLoginSuccess?: (returnTarget?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ language, onLoginSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const returnTarget = (location.state as { from?: string })?.from || '/';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  function resolveDestination(account: AccountResponse): string {
    if (returnTarget === '/verify-email?pending=1' && account.email && !account.emailVerified) return returnTarget;
    if (returnTarget.startsWith('/admin') && account.roles.includes('ADMIN')) return returnTarget;
    if ((returnTarget.startsWith('/portal') || returnTarget.startsWith('/organizer')) && account.roles.includes('ORGANIZER')) return returnTarget;
    if (returnTarget.startsWith('/partner') && account.roles.includes('PARTNER')) return returnTarget;
    if (returnTarget.startsWith('/participant') && account.roles.includes('PARTICIPANT')) return returnTarget;
    if (account.roles.includes('ADMIN')) return '/admin';
    if (account.roles.includes('ORGANIZER')) return '/portal';
    if (account.roles.includes('PARTNER')) return '/partner';
    return '/participant';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!identifier.trim()) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập email hoặc tên đăng nhập' : 'Please enter your email or username');
      return;
    }
    if (!password) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập mật khẩu' : 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const account = await login({
        username: identifier.trim(),
        password,
      });

      const destination = resolveDestination(account);
      setSuccessMsg(language === 'vi' ? 'Đăng nhập thành công!' : 'Signed in successfully!');
      window.setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(destination);
        } else {
          navigate(destination);
        }
      }, 350);
    } catch (err: unknown) {
      setErrorMsg(
        (err instanceof Error && err.message) || (language === 'vi'
          ? 'Tài khoản hoặc mật khẩu không chính xác trong hệ thống.'
          : 'Invalid account credentials in database.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-root">
      {/* Dynamic ambient backdrop with Realistic Cultural Artworks & Motifs */}
      <div className="auth-bg-layer" aria-hidden="true">
        <div className="auth-glow-spot auth-glow-1"></div>
        <div className="auth-glow-spot auth-glow-2"></div>
        
        {/* Họa tiết lưới hoa văn chìm */}
        <div className="auth-motif-pattern-overlay"></div>
        
        {/* Hiện vật thực tế: Trống đồng Đông Sơn cổ đại xoay chậm */}
        <div className="auth-realistic-artwork-wrap drum-top-left">
          <img 
            src="/dong_son_bronze_drum.jpg" 
            alt="Họa tiết Trống đồng Đông Sơn" 
            className="auth-realistic-drum-img" 
          />
        </div>

        {/* Hiện vật thực tế: Cổ thư Đường Sách phát sáng góc dưới phải */}
        <div className="auth-realistic-artwork-wrap book-bottom-right">
          <img 
            src="/vintage_book_ornament.jpg" 
            alt="Cổ thư di sản Đường Sách" 
            className="auth-realistic-book-img" 
          />
        </div>

        {/* Đốm bụi vàng lơ lửng chuyển động */}
        <div className="auth-gold-particle particle-1"></div>
        <div className="auth-gold-particle particle-2"></div>
        <div className="auth-gold-particle particle-3"></div>
      </div>

      <div className="auth-container">
        {/* Back link to Home */}
        <div className="auth-top-nav">
          <Link to="/" className="auth-back-link" title={language === 'vi' ? 'Về trang chủ' : 'Back to Home'}>
            <ArrowLeft size={16} />
            <span>{language === 'vi' ? 'Quay lại Trang chủ' : 'Back to Home'}</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="auth-card">
          {/* Họa tiết khung chỉ kim viền đôi */}
          <div className="auth-card-inner-border" aria-hidden="true"></div>

          {/* Dải hoa văn hình học cổ điển đầu và chân thẻ */}
          <div className="auth-card-motif-band band-top" aria-hidden="true"></div>
          <div className="auth-card-motif-band band-bottom" aria-hidden="true"></div>

          {/* Họa tiết 4 góc cổ điển kim hoàng */}
          <div className="auth-card-corner corner-top-left" aria-hidden="true"></div>
          <div className="auth-card-corner corner-top-right" aria-hidden="true"></div>
          <div className="auth-card-corner corner-bottom-left" aria-hidden="true"></div>
          <div className="auth-card-corner corner-bottom-right" aria-hidden="true"></div>

          {/* Decorative perforated notches on card header */}
          <div className="auth-card-notch notch-left" aria-hidden="true"></div>
          <div className="auth-card-notch notch-right" aria-hidden="true"></div>

          {/* Header & Brand */}
          <div className="auth-header">
            <Link to="/" className="auth-brand-badge" title="Đường Sách TP.HCM">
              <div className="auth-brand-icon" style={{ padding: '2px', background: '#FFFFFF', borderRadius: '50%', overflow: 'hidden' }}>
                <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
            </Link>

            <h1 className="auth-title">
              {language === 'vi' ? 'Chào mừng bạn đọc' : 'Welcome Back'}
            </h1>
            <p className="auth-subtitle">
              {language === 'vi'
                ? 'Đăng nhập để lưu gian hàng yêu thích, nhận lịch sự kiện sớm và đăng ký tham gia giao lưu sách.'
                : 'Sign in to bookmark bookstalls, receive event invites, and join literary gatherings.'}
            </p>
          </div>

          {/* Alert Message Area */}
          {errorMsg && (
            <NotificationCallout variant="error" title={language === 'vi' ? 'Đăng nhập thất bại' : 'Sign in failed'}>
              {errorMsg}
            </NotificationCallout>
          )}

          {successMsg && (
            <NotificationCallout variant="success" title={language === 'vi' ? 'Đăng nhập thành công' : 'Signed in'}>
              {successMsg}
            </NotificationCallout>
          )}

          {/* Login Form */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Identifier Field */}
            <div className="auth-field">
              <label htmlFor="login-identifier">
                {language === 'vi' ? 'Tên đăng nhập' : 'Username'}
              </label>
              <div className="auth-input-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder={language === 'vi' ? 'Ví dụ: booklover' : 'e.g. booklover'}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field">
              <div className="auth-field-label-row">
                <label htmlFor="login-password">
                  {language === 'vi' ? 'Mật khẩu' : 'Password'}
                </label>
                <Link to="/forgot-password" className="auth-link-btn">
                  {language === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                </Link>
              </div>

              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={64}
                  autoComplete="current-password"
                  placeholder={language === 'vi' ? 'Nhập mật khẩu' : 'Enter password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                />
                <button
                  type="button"
                  className="auth-btn-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="auth-btn-loading-content">
                  <span className="auth-spinner"></span>
                  <span>{language === 'vi' ? 'Đang xác thực...' : 'Signing in...'}</span>
                </span>
              ) : (
                <>
                  <span>{language === 'vi' ? 'Đăng nhập ngay' : 'Sign In'}</span>
                  <ArrowRight size={18} className="auth-btn-arrow" />
                </>
              )}
            </button>

          </form>

          {/* Footer Switching to Register */}
          <div className="auth-switch-section">
            <span>
              {language === 'vi' ? 'Bạn là độc giả mới?' : "Don't have an account?"}{' '}
            </span>
            <Link to="/register" className="auth-switch-link">
              {language === 'vi' ? 'Đăng ký tài khoản ngay' : 'Create an account'}
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
};
