import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  X
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Language } from '../../types';
import './LoginPage.css';
import './RegisterPage.css';

interface RegisterPageProps {
  language: Language;
  onRegisterSuccess?: (returnTarget?: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ language, onRegisterSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, login } = useAuth();
  const returnTarget = (location.state as { from?: string })?.from || '/';
  
  // Form fields
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Email format validation
  const isEmailValid = useMemo(() => {
    if (!email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const isUsernameValid = useMemo(() => {
    return /^[A-Za-z][A-Za-z0-9]{2,19}$/.test(username);
  }, [username]);

  const isPasswordLengthValid = useMemo(() => {
    const utf8ByteLength = new TextEncoder().encode(password).length;
    return password.length >= 8 && password.length <= 64 && utf8ByteLength <= 72;
  }, [password]);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, labelVi: '', labelEn: '', color: '' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
      return { score: 1, labelVi: 'Yếu', labelEn: 'Weak', color: '#C84C32' };
    } else if (score <= 3) {
      return { score: 2, labelVi: 'Trung bình', labelEn: 'Moderate', color: '#E9BC63' };
    } else {
      return { score: 3, labelVi: 'Mạnh', labelEn: 'Strong', color: '#40A881' };
    }
  }, [password]);

  // Password match verification
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  // Form validity check for enabling submit
  const isFormValid = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      fullName.trim().length <= 50 &&
      isUsernameValid &&
      isEmailValid &&
      isPasswordLengthValid &&
      password === confirmPassword &&
      agreeTerms
    );
  }, [fullName, isUsernameValid, isEmailValid, isPasswordLengthValid, password, confirmPassword, agreeTerms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isFormValid) {
      setErrorMsg(
        language === 'vi'
          ? 'Vui lòng hoàn thiện các trường thông tin bắt buộc và đồng ý với điều khoản.'
          : 'Please fill in all required fields accurately and agree to the terms.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const account = await register({
        username,
        fullName: fullName.trim(),
        password,
        confirmPassword,
        email: email.trim() ? email.trim().toLowerCase() : null,
      });

      if (account.email) {
        // Registration has committed; a session enables authenticated resend.
        try { await login({ username, password }); } catch { /* Account creation still succeeded. */ }
        navigate('/verify-email?pending=1', { replace: true, state: { email: account.email } });
        return;
      }
      setIsSuccess(true);
      setTimeout(() => {
        if (onRegisterSuccess) {
          onRegisterSuccess('/login');
        } else {
          navigate('/login', { state: { from: returnTarget } });
        }
      }, 1000);
    } catch (err: unknown) {
      setErrorMsg(
        (err instanceof Error && err.message) || (language === 'vi'
          ? 'Đăng ký tài khoản thất bại. Vui lòng kiểm tra lại thông tin.'
          : 'Registration failed. Please check your information.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-root">
      {/* Background Ambience with Realistic Cultural Artworks & Motifs */}
      <div className="auth-bg-layer" aria-hidden="true">
        <div className="auth-glow-spot register-glow-1"></div>
        <div className="auth-glow-spot register-glow-2"></div>
        
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

      <div className="auth-container register-container">
        {/* Top Back Link */}
        <div className="auth-top-nav">
          <Link to="/" className="auth-back-link" title={language === 'vi' ? 'Về trang chủ' : 'Back to Home'}>
            <ArrowLeft size={16} />
            <span>{language === 'vi' ? 'Quay lại Trang chủ' : 'Back to Home'}</span>
          </Link>
        </div>

        {/* Main Register Card */}
        <div className="auth-card register-card">
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

          <div className="auth-card-notch notch-left" aria-hidden="true"></div>
          <div className="auth-card-notch notch-right" aria-hidden="true"></div>

          {isSuccess ? (
            /* Success View */
            <div className="register-success-view">
              <div className="register-success-badge">
                <CheckCircle2 size={48} color="#40A881" />
              </div>
              <h2 className="register-success-title">
                {language === 'vi' ? 'Đăng ký tài khoản thành công!' : 'Account Created Successfully!'}
              </h2>
              <p className="register-success-desc">
                {language === 'vi'
                  ? `Chào mừng ${fullName || 'bạn đọc'} đã gia nhập cộng đồng Đường Sách TP.HCM. Hãy đăng nhập bằng tài khoản vừa tạo.${email ? ` Email xác nhận đã được gửi đến ${email}.` : ''}`
                  : `Welcome ${fullName || 'reader'} to the HCMC Book Street community. Sign in with your new account.${email ? ` A confirmation email has been sent to ${email}.` : ''}`}
              </p>

              <div className="register-success-actions">
                <Link to="/login" state={{ from: returnTarget }} className="register-success-btn primary">
                  <span>{language === 'vi' ? 'Đi đến đăng nhập' : 'Continue to sign in'}</span>
                  <ArrowRight size={18} />
                </Link>
                <Link to="/" className="register-success-btn secondary">
                  <span>{language === 'vi' ? 'Về trang chủ' : 'Back to home'}</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Registration Form View */
            <>
              {/* Header */}
              <div className="auth-header">
                <Link to="/" className="auth-brand-badge" title="Đường Sách TP.HCM">
                  <div className="auth-brand-icon" style={{ padding: '2px', background: '#FFFFFF', borderRadius: '50%', overflow: 'hidden' }}>
                    <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                  <div className="auth-brand-pill">
                    <ShieldCheck size={14} color="#E9BC63" />
                    <span>{language === 'vi' ? 'THÀNH VIÊN ĐỘC GIẢ' : 'READER PASS'}</span>
                  </div>
                </Link>

                <h1 className="auth-title">
                  {language === 'vi' ? 'Tạo tài khoản Độc giả' : 'Create Member Account'}
                </h1>
                <p className="auth-subtitle">
                  {language === 'vi'
                    ? 'Đăng ký một lần để khám phá trọn vẹn sự kiện, ưu đãi sách và lưu giữ hành trình di sản văn hóa.'
                    : 'Register once to explore author talks, bookstall specials, and interactive heritage trails.'}
                </p>
              </div>

              {/* Alert Message Area */}
              {errorMsg && (
                <div className="auth-alert error" role="alert">
                  <AlertCircle size={18} className="auth-alert-icon" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form */}
              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Username Field */}
                <div className="auth-field">
                  <label htmlFor="reg-username">
                    {language === 'vi' ? 'Tên đăng nhập *' : 'Username *'}
                  </label>
                  <div className="auth-input-wrap">
                    <User size={18} className="auth-input-icon" />
                    <input
                      id="reg-username"
                      type="text"
                      required
                      autoFocus
                      autoComplete="username"
                      minLength={3}
                      maxLength={20}
                      placeholder={language === 'vi' ? '3–20 ký tự chữ và số' : '3–20 letters and numbers'}
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                    />
                    {username && (
                      <span className={`reg-inline-badge ${isUsernameValid ? 'valid' : 'invalid'}`}>
                        {isUsernameValid ? <Check size={14} /> : <X size={14} />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Full Name Field */}
                <div className="auth-field">
                  <label htmlFor="reg-fullname">
                    {language === 'vi' ? 'Họ và tên *' : 'Full Name *'}
                  </label>
                  <div className="auth-input-wrap">
                    <User size={18} className="auth-input-icon" />
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      autoComplete="name"
                      minLength={2}
                      maxLength={50}
                      placeholder={language === 'vi' ? 'Ví dụ: Nguyễn Văn An' : 'e.g. John Doe'}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="auth-field">
                  <label htmlFor="reg-email">
                    {language === 'vi' ? 'Địa chỉ Email (Không bắt buộc)' : 'Email Address (Optional)'}
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={18} className="auth-input-icon" />
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      maxLength={255}
                      placeholder={language === 'vi' ? 'ban-doc@gmail.com' : 'you@example.com'}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                    />
                    {email && (
                      <span className={`reg-inline-badge ${isEmailValid ? 'valid' : 'invalid'}`}>
                        {isEmailValid ? <Check size={14} /> : <X size={14} />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Password Field */}
                <div className="auth-field">
                  <label htmlFor="reg-password">
                    {language === 'vi' ? 'Mật khẩu (8–64 ký tự) *' : 'Password (8–64 chars) *'}
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={64}
                      autoComplete="new-password"
                      placeholder={language === 'vi' ? 'Nhập mật khẩu an toàn' : 'Create strong password'}
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

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="password-strength-wrap">
                      <div className="password-strength-bars">
                        <div
                          className={`strength-bar ${passwordStrength.score >= 1 ? 'filled' : ''}`}
                          style={{ backgroundColor: passwordStrength.score >= 1 ? passwordStrength.color : undefined }}
                        ></div>
                        <div
                          className={`strength-bar ${passwordStrength.score >= 2 ? 'filled' : ''}`}
                          style={{ backgroundColor: passwordStrength.score >= 2 ? passwordStrength.color : undefined }}
                        ></div>
                        <div
                          className={`strength-bar ${passwordStrength.score >= 3 ? 'filled' : ''}`}
                          style={{ backgroundColor: passwordStrength.score >= 3 ? passwordStrength.color : undefined }}
                        ></div>
                      </div>
                      <span className="strength-label" style={{ color: passwordStrength.color }}>
                        {language === 'vi' ? passwordStrength.labelVi : passwordStrength.labelEn}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="auth-field">
                  <label htmlFor="reg-confirm-password">
                    {language === 'vi' ? 'Xác nhận lại mật khẩu *' : 'Confirm Password *'}
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={64}
                      autoComplete="new-password"
                      placeholder={language === 'vi' ? 'Nhập lại mật khẩu trên' : 'Re-enter your password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-btn-eye"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Password match feedback */}
                  {confirmPassword && (
                    <div className={`password-match-hint ${passwordsMatch ? 'match' : 'no-match'}`}>
                      {passwordsMatch ? (
                        <>
                          <Check size={14} />
                          <span>{language === 'vi' ? 'Mật khẩu hoàn toàn trùng khớp' : 'Passwords match perfectly'}</span>
                        </>
                      ) : (
                        <>
                          <X size={14} />
                          <span>{language === 'vi' ? 'Mật khẩu chưa trùng khớp' : 'Passwords do not match yet'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Terms and Privacy Checkbox */}
                <div className="auth-remember-row register-terms-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                    />
                    <span className="auth-checkbox-custom"></span>
                    <span className="auth-checkbox-text terms-text">
                      {language === 'vi' ? (
                        <>
                          Tôi đồng ý với <a href="#dieukhoan" onClick={(e) => e.preventDefault()}>Điều khoản sử dụng</a> và{' '}
                          <a href="#baomat" onClick={(e) => e.preventDefault()}>Chính sách bảo mật</a> của Đường Sách TP.HCM.
                        </>
                      ) : (
                        <>
                          I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a> and{' '}
                          <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                        </>
                      )}
                    </span>
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  className="auth-submit-btn register-submit-btn"
                  disabled={!isFormValid || isLoading}
                >
                  {isLoading ? (
                    <span className="auth-btn-loading-content">
                      <span className="auth-spinner"></span>
                      <span>{language === 'vi' ? 'Đang tạo tài khoản...' : 'Creating account...'}</span>
                    </span>
                  ) : (
                    <>
                      <span>{language === 'vi' ? 'Hoàn tất Đăng ký' : 'Create Account'}</span>
                      <ArrowRight size={18} className="auth-btn-arrow" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer Switch to Login */}
              <div className="auth-switch-section">
                <span>
                  {language === 'vi' ? 'Bạn đã có tài khoản?' : 'Already have an account?'}{' '}
                </span>
                <Link to="/login" className="auth-switch-link">
                  {language === 'vi' ? 'Đăng nhập tại đây' : 'Sign In here'}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
