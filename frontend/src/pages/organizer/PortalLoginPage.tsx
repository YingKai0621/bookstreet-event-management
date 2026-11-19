import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Shield,
  User
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { NotificationCallout } from '../../components/ui/NotificationCallout';
import { Language } from '../../types';
import './PortalLoginPage.css';

interface PortalLoginPageProps {
  language: Language;
  onLoginSuccess: () => void;
}

export const PortalLoginPage: React.FC<PortalLoginPageProps> = ({
  language,
  onLoginSuccess,
}) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập tài khoản và mật khẩu' : 'Please enter credentials');
      return;
    }

    setIsLoading(true);

    try {
      const account = await login({
        username: username.trim(),
        password,
      });

      if (!account.roles.includes('ORGANIZER')) {
        throw new Error(language === 'vi' ? 'Tài khoản không có quyền truy cập Cổng Ban Quản Lý' : 'Unauthorized for Management Portal');
      }

      onLoginSuccess();
    } catch (err: unknown) {
      setErrorMsg(
        (err instanceof Error && err.message) || (language === 'vi'
          ? 'Tên đăng nhập hoặc mật khẩu chưa chính xác trong hệ thống.'
          : 'Invalid credentials in database.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="portal-login-page">
      {/* Background Ambience */}
      <div className="portal-login-bg">
        <div className="portal-login-glow portal-login-glow-1"></div>
        <div className="portal-login-glow portal-login-glow-2"></div>
      </div>

      <div className="portal-login-container">
        {/* Top Back Link */}
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link 
            to="/" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: '0.82rem',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={14} />
            <span>{language === 'vi' ? 'Quay lại Trang chủ' : 'Back to Home'}</span>
          </Link>

          <Link 
            to="/login" 
            style={{ 
              color: 'rgba(233,188,99,0.85)', 
              fontSize: '0.8rem',
              textDecoration: 'none'
            }}
          >
            {language === 'vi' ? 'Đăng nhập Độc giả →' : 'Reader Login →'}
          </Link>
        </div>

        {/* Card Header & Brand */}
        <div className="portal-login-card">
          <div className="portal-login-header">
            <div className="portal-brand-badge">
              <div className="portal-brand-icon" style={{ padding: '2px', background: '#FFFFFF', borderRadius: '50%', overflow: 'hidden' }}>
                <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
              <div className="portal-shield-pill">
                <Shield size={14} color="#E9BC63" />
                <span>BẢO MẬT NỘI BỘ</span>
              </div>
            </div>

            <h1 className="portal-login-title">
              {language === 'vi' ? 'Cổng Ban Quản Lý' : 'Management Portal'}
            </h1>
            <p className="portal-login-sub">
              {language === 'vi'
                ? 'Hệ thống điều hành sự kiện, gian hàng & di sản Đường Sách TP.HCM'
                : 'Event, bookstall & heritage administration system for HCMC Book Street'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <NotificationCallout variant="error" title={language === 'vi' ? 'Không thể truy cập' : 'Access denied'}>
              {errorMsg}
            </NotificationCallout>
          )}

          {/* Form */}
          <form className="portal-login-form" onSubmit={handleSubmit}>
            <div className="portal-form-field">
              <label htmlFor="portal-username">
                {language === 'vi' ? 'Tài khoản điều hành' : 'Username'}
              </label>
              <div className="portal-input-wrap">
                <User size={18} className="input-ico" />
                <input
                  id="portal-username"
                  type="text"
                  required
                  autoFocus
                  placeholder={language === 'vi' ? 'Ví dụ: bql@duongsach.example.vn' : 'e.g. bql@duongsach.example.vn'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="portal-form-field">
              <label htmlFor="portal-password">
                {language === 'vi' ? 'Mật khẩu' : 'Password'}
              </label>
              <div className="portal-input-wrap">
                <Lock size={18} className="input-ico" />
                <input
                  id="portal-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={language === 'vi' ? 'Nhập mật khẩu' : 'Enter password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="portal-login-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>{language === 'vi' ? 'Đang xác thực...' : 'Authenticating...'}</span>
              ) : (
                <>
                  <span>{language === 'vi' ? 'Đăng nhập vào Cổng Quản Lý' : 'Sign In to Portal'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer note switching to Partner Portal */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            <span>{language === 'vi' ? 'Bạn là Đơn vị Đối tác / Nhà xuất bản?' : 'Are you a Partner / Publisher?'} </span>
            <Link to="/partner" style={{ color: '#E9BC63', textDecoration: 'none' }}>
              {language === 'vi' ? ' Đăng nhập Cổng Đối tác' : 'Partner Portal'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
