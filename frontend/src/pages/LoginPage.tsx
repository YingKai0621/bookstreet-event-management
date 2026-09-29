import React, { useEffect, useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Language } from '../types';
import { authApi } from '../services/authApi';
import { NotificationCallout } from '../components/ui/NotificationCallout';
import './LoginPage.css';

interface LoginPageProps {
  language: Language;
  onLoginSuccess?: (returnTarget?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ language, onLoginSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTarget = (location.state as { from?: string })?.from || '/';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<Array<{ role: 'participant' | 'partner' | 'organizer' | 'admin'; email: string }>>([]);

  useEffect(() => {
    authApi.getDemoAccounts().then(setDemoAccounts).catch(() => setDemoAccounts([]));
  }, []);

  const completeLogin = (res: Awaited<ReturnType<typeof authApi.login>>) => {
      const { user, accessToken } = res;
      localStorage.setItem('duongsach_token', accessToken);
      sessionStorage.setItem('duongsach_token', accessToken);
      localStorage.setItem('duongsach_user', JSON.stringify(user));

      sessionStorage.removeItem('duongsach_admin_auth_v1');
      localStorage.removeItem('duongsach_admin_auth_v1');
      sessionStorage.removeItem('duongsach_portal_auth');
      localStorage.removeItem('duongsach_portal_auth');
      sessionStorage.removeItem('duongsach_partner_auth_v1');
      localStorage.removeItem('duongsach_partner_auth_v1');
      sessionStorage.removeItem('duongsach_participant_auth_v1');
      localStorage.removeItem('duongsach_participant_auth_v1');

      if (user.primaryRole === 'admin') {
        sessionStorage.setItem('duongsach_admin_auth_v1', 'authenticated_admin');
        localStorage.setItem('duongsach_admin_auth_v1', 'true');
        setSuccessMsg(language === 'vi' ? 'Đăng nhập Quản Trị Viên thành công!' : 'Signed in as Administrator!');
        setTimeout(() => { navigate('/admin'); window.location.reload(); }, 500);
      } else if (user.primaryRole === 'organizer') {
        sessionStorage.setItem('duongsach_portal_auth', 'authenticated_bql');
        localStorage.setItem('duongsach_portal_auth', 'authenticated_bql');
        setSuccessMsg(language === 'vi' ? 'Đăng nhập Ban Quản Lý thành công!' : 'Signed in as Organizer!');
        setTimeout(() => { navigate('/portal'); window.location.reload(); }, 500);
      } else if (user.primaryRole === 'partner') {
        sessionStorage.setItem('duongsach_partner_auth_v1', 'authenticated_partner');
        localStorage.setItem('duongsach_partner_auth_v1', 'true');
        setSuccessMsg(language === 'vi' ? 'Đăng nhập Đối tác thành công!' : 'Signed in as Partner!');
        setTimeout(() => { navigate('/partner'); window.location.reload(); }, 500);
      } else {
        sessionStorage.setItem('duongsach_participant_auth_v1', 'true');
        localStorage.setItem('duongsach_participant_auth_v1', 'true');
        setSuccessMsg(language === 'vi' ? 'Đăng nhập Độc giả thành công!' : 'Signed in successfully!');
        setTimeout(() => onLoginSuccess ? onLoginSuccess('/participant') : navigate('/participant'), 500);
      }
  };

  const handleDemoLogin = async (role: 'participant' | 'partner' | 'organizer' | 'admin') => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      completeLogin(await authApi.demoLogin(role));
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Không thể đăng nhập tài khoản demo từ database.');
    } finally {
      setIsLoading(false);
    }
  };

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
      const res = await authApi.login({
        email: identifier.trim(),
        password: password,
      });

      completeLogin(res);
    } catch (err: any) {
      setErrorMsg(
        err?.message || (language === 'vi'
          ? 'Tài khoản hoặc mật khẩu không chính xác trong hệ thống.'
          : 'Invalid account credentials in database.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotEmail.trim()) {
      try {
        await authApi.forgotPassword(forgotEmail.trim());
        setForgotSuccess(true);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : 'Không thể gửi yêu cầu đặt lại mật khẩu');
      }
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
              <div className="auth-brand-pill">
                <ShieldCheck size={14} color="#E9BC63" />
                <span>{language === 'vi' ? 'ĐỘC GIẢ ĐƯỜNG SÁCH' : 'READER COMMUNITY'}</span>
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
                {language === 'vi' ? 'Email hoặc Tên đăng nhập' : 'Email or Username'}
              </label>
              <div className="auth-input-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder={language === 'vi' ? 'vi-du@duongsach.vn' : 'name@domain.com'}
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
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => setForgotModalOpen(true)}
                >
                  {language === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                </button>
              </div>

              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
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

            {/* Remember Me */}
            <div className="auth-remember-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="auth-checkbox-custom"></span>
                <span className="auth-checkbox-text">
                  {language === 'vi' ? 'Ghi nhớ đăng nhập trên thiết bị này' : 'Remember me on this device'}
                </span>
              </label>
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

          {demoAccounts.length > 0 && (
            <div className="auth-quick-roles-container">
              <div className="auth-quick-roles-divider"><span>✨ {language === 'vi' ? 'Đăng nhập nhanh để demo' : 'Quick demo sign-in'}</span></div>
              <div className="auth-quick-roles-grid">
                {demoAccounts.map(account => {
                  const roleConfig: Record<string, { label: string; icon: string; color: string }> = {
                    participant: { label: language === 'vi' ? 'Độc giả' : 'Reader', icon: '📖', color: '#5CD4A6' },
                    partner: { label: language === 'vi' ? 'Đối tác' : 'Partner', icon: '🏪', color: '#F3C975' },
                    organizer: { label: language === 'vi' ? 'Ban Quản Lý' : 'Organizer', icon: '🏛️', color: '#68B5FF' },
                    admin: { label: language === 'vi' ? 'Quản Trị' : 'Admin', icon: '⚡', color: '#C084FC' }
                  };
                  const cfg = roleConfig[account.role] || { label: account.role, icon: '👤', color: '#E9BC63' };

                  return (
                    <button key={account.role} type="button" className="auth-quick-role-btn" disabled={isLoading} onClick={() => void handleDemoLogin(account.role)}>
                      <span className="quick-role-badge">
                        <span>{cfg.icon}</span>
                        <span style={{ color: cfg.color }}>{cfg.label}</span>
                      </span>
                      <span className="quick-role-email">{account.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Switching to Register */}
          <div className="auth-switch-section">
            <span>
              {language === 'vi' ? 'Bạn là độc giả mới?' : "Don't have an account?"}{' '}
            </span>
            <Link to="/register" className="auth-switch-link">
              {language === 'vi' ? 'Đăng ký tài khoản ngay' : 'Create an account'}
            </Link>
          </div>

          {/* Link to BQL portal & Partner portal & Admin portal */}
          <div className="auth-portal-hint">
            <div>{language === 'vi' ? 'Cổng Chức năng & Quản trị:' : 'Portals & Administration:'}</div>
            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <Link to="/partner" className="auth-portal-link">
                {language === 'vi' ? 'Cổng Đối tác' : 'Partner Portal'} →
              </Link>
              <span style={{ color: '#D5DFDC' }}>•</span>
              <Link to="/portal" className="auth-portal-link">
                {language === 'vi' ? 'Cổng Ban Quản Lý' : 'Organizer Portal'} →
              </Link>
              <span style={{ color: '#D5DFDC' }}>•</span>
              <Link to="/admin" className="auth-portal-link">
                {language === 'vi' ? 'Cổng Quản Trị Hệ Thống' : 'Admin Portal'} →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      {forgotModalOpen && (
        <div className="auth-modal-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3 className="auth-modal-title">
              {language === 'vi' ? 'Khôi phục mật khẩu' : 'Reset Password'}
            </h3>
            <p className="auth-modal-sub">
              {language === 'vi'
                ? 'Nhập địa chỉ email liên kết với tài khoản bạn đọc để nhận liên kết đặt lại mật khẩu.'
                : 'Enter your registered reader email address to receive a password reset link.'}
            </p>

            {forgotSuccess ? (
              <div className="auth-alert success">
                <CheckCircle2 size={18} />
                <span>
                  {language === 'vi'
                    ? 'Đã gửi hướng dẫn khôi phục qua email của bạn!'
                    : 'Password reset instructions have been sent to your email!'}
                </span>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <div className="auth-field" style={{ marginBottom: '1.25rem' }}>
                  <div className="auth-input-wrap">
                    <Mail size={18} className="auth-input-icon" />
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="auth-modal-actions">
                  <button
                    type="button"
                    className="auth-modal-cancel"
                    onClick={() => setForgotModalOpen(false)}
                  >
                    {language === 'vi' ? 'Đóng' : 'Cancel'}
                  </button>
                  <button type="submit" className="auth-modal-submit">
                    {language === 'vi' ? 'Gửi liên kết' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
