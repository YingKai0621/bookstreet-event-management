import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { authApi } from '../../services/authApi';
import { useAuth } from '../../auth/useAuth';
import type { Language } from '../../types';
import './VerifyEmailPage.css';

export function VerifyEmailPage({ language }: { language: Language }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, status: authStatus, refreshCurrentUser } = useAuth();
  const [token] = useState(() => params.get('token') || '');
  const waiting = params.get('pending') === '1' && !token;
  const [status, setStatus] = useState<'ready' | 'sending' | 'success' | 'error'>('ready');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(waiting ? 60 : 0);
  const vi = language === 'vi';
  const email = user?.email || (location.state as { email?: string } | null)?.email;
  const success = status === 'success' || (waiting && Boolean(user?.emailVerified));

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!waiting || authStatus !== 'authenticated') return;
    const refresh = () => { void refreshCurrentUser().catch(() => {}); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [waiting, authStatus, refreshCurrentUser]);

  const confirm = async () => {
    if (!token || status === 'sending' || success) return;
    setStatus('sending');
    setError('');
    try {
      await authApi.confirmEmailVerification(token);
      window.history.replaceState(null, '', '/verify-email');
      window.dispatchEvent(new Event('email:verified'));
      setStatus('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (vi ? 'Không xác nhận được email.' : 'Could not verify email.'));
      setStatus('error');
    }
  };
  const resend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true); setError(''); setNotice('');
    try {
      await authApi.resendEmailVerification();
      setCooldown(60);
      setNotice(vi ? 'Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư.' : 'Verification email sent. Please check your inbox.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (vi ? 'Không gửi được email.' : 'Could not send email.'));
    } finally { setResending(false); }
  };
  return <main className="email-verification-page">
    <div className="email-verification-shell">
      <Link to="/" className="email-verification-brand"><BookOpen size={24} /><span>ĐƯỜNG SÁCH <small>TP. HỒ CHÍ MINH</small></span></Link>
      <section className="email-verification-card" aria-labelledby="verification-title">
        <div className={`email-verification-icon ${success ? 'verified' : ''}`}>{success ? <CircleCheck size={38} /> : <Mail size={38} />}</div>
        <span className="email-verification-step">{vi ? 'BẢO MẬT TÀI KHOẢN' : 'ACCOUNT SECURITY'}</span>
        <h1 id="verification-title">{success ? (vi ? 'Email đã được xác nhận' : 'Your email is verified') : waiting ? (vi ? 'Kiểm tra hộp thư của bạn' : 'Check your inbox') : (vi ? 'Xác nhận email' : 'Verify your email')}</h1>
        {success ? <>
          <p className="email-verification-description" role="status">{vi ? 'Email đã được xác nhận thành công. Tài khoản của bạn đã sẵn sàng để tiếp tục khám phá Đường Sách.' : 'Email verified successfully. You are ready to explore Book Street.'}</p>
          <div className="email-verification-note"><ShieldCheck size={20} /><span>{vi ? 'Nếu tài khoản có quyền quản lý hoặc đối tác, hãy đăng xuất và đăng nhập lại để cập nhật quyền.' : 'For management or partner permissions, sign out and sign in again to refresh access.'}</span></div>
          <Link className="email-verification-primary" to={authStatus === 'authenticated' ? '/participant/profile' : '/login'}>{authStatus === 'authenticated' ? (vi ? 'Về hồ sơ cá nhân' : 'Go to profile') : (vi ? 'Đăng nhập' : 'Sign in')}<ArrowRight size={18} /></Link>
        </> : <>
          <p className="email-verification-description">{waiting ? (vi ? 'Tài khoản đã được tạo. Hãy xác nhận email để hoàn tất bước đăng ký.' : 'Your account is created. Verify your email to complete registration.') : token ? (vi ? 'Chỉ còn một bước để xác nhận địa chỉ email của bạn.' : 'Just one step to confirm your email address.') : (vi ? 'Liên kết thiếu mã xác nhận. Hãy mở liên kết trong email hoặc gửi lại email từ hồ sơ cá nhân.' : 'This link is missing a token. Open your email link or request another from your profile.')}</p>
          {waiting && email && <div className="email-verification-address"><Mail size={18} /><strong>{email}</strong></div>}
          {waiting && <ol className="email-verification-instructions"><li>{vi ? 'Mở hộp thư, kiểm tra cả mục thư rác.' : 'Open your inbox and check the spam folder.'}</li><li>{vi ? 'Mở email từ Đường Sách và nhấn liên kết xác nhận.' : 'Open the Book Street email and follow its verification link.'}</li><li>{vi ? 'Xác nhận email trên trang được mở để hoàn tất.' : 'Confirm your email on the page that opens.'}</li></ol>}
          {error && <p className="email-verification-feedback error" role="alert">{error}</p>}
          {notice && <p className="email-verification-feedback" role="status"><Check size={16} />{notice}</p>}
          {token && <button className="email-verification-primary" type="button" disabled={status === 'sending'} onClick={() => void confirm()}>{status === 'sending' ? (vi ? 'Đang xác nhận...' : 'Verifying...') : (vi ? 'Xác nhận email' : 'Verify email')}<ArrowRight size={18} /></button>}
          {!token && authStatus === 'authenticated' && <button className="email-verification-primary" type="button" disabled={resending || cooldown > 0} onClick={() => void resend()}><RefreshCw size={17} />{resending ? (vi ? 'Đang gửi...' : 'Sending...') : cooldown > 0 ? `${vi ? 'Gửi lại sau' : 'Resend in'} ${cooldown}s` : (vi ? 'Gửi lại email xác nhận' : 'Resend verification email')}</button>}
          {waiting && authStatus === 'guest' && <Link className="email-verification-primary" to="/login" state={{ from: '/verify-email?pending=1' }}>{vi ? 'Đăng nhập để gửi lại email' : 'Sign in to resend email'}<ArrowRight size={18} /></Link>}
          <p className="email-verification-expiry">{vi ? 'Liên kết có hiệu lực 60 phút. Mỗi lần gửi lại sẽ thay thế liên kết trước đó.' : 'Links expire in 60 minutes. A new email replaces the previous link.'}</p>
          {!waiting && <Link className="email-verification-secondary" to="/participant/profile">{vi ? 'Về hồ sơ / Gửi lại email' : 'Profile / Resend email'}</Link>}
        </>}
      </section>
      <Link className="email-verification-back" to="/"><ArrowLeft size={16} />{vi ? 'Về trang chủ' : 'Back to home'}</Link>
    </div>
  </main>;
}
