import { Camera, Check, Edit3, Mail, UserRound, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Language, ParticipantProfile } from '../../types';
import './ParticipantPages.css';
import './ProfileSettingsPage.css';
import '../../components/ui/RoleProfileDesign.css';
import { authApi } from '../../services/authApi';

interface ProfileSettingsPageProps {
  language: Language;
  profile: ParticipantProfile;
  onUpdateProfile: (updated: Partial<ParticipantProfile>) => void | Promise<void>;
}

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({ language, profile, onUpdateProfile }) => {
  const vi = language === 'vi';
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone || '');
  const [profileSource, setProfileSource] = useState({ name: profile.name, phone: profile.phone || '' });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (profileSource.name !== profile.name || profileSource.phone !== (profile.phone || '')) {
    setProfileSource({ name: profile.name, phone: profile.phone || '' });
    setName(profile.name);
    setPhone(profile.phone || '');
  }

  const persist = async (updated: Partial<ParticipantProfile>) => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await onUpdateProfile(updated);
      setSaveSuccess(true);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (vi ? 'Không lưu được hồ sơ.' : 'Could not save profile.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isSaving) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setSaveError(vi ? 'Chọn ảnh PNG, JPG, WebP hoặc GIF, tối đa 5MB.' : 'Choose a PNG, JPG, WebP or GIF image, up to 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') void persist({ avatar: reader.result }); };
    reader.onerror = () => setSaveError(vi ? 'Không đọc được ảnh. Vui lòng thử lại.' : 'Could not read image. Please try again.');
    reader.readAsDataURL(file);
  };

  const cancelEdit = () => {
    setName(profile.name);
    setPhone(profile.phone || '');
    setSaveError('');
    setIsEditing(false);
  };

  const requestVerification = async () => {
    if (sendingVerification) return;
    if (Date.now() < resendAfter) {
      setVerificationMessage(vi ? 'Vui lòng chờ 60 giây giữa các lần gửi.' : 'Please wait 60 seconds between requests.');
      return;
    }
    setSendingVerification(true);
    setVerificationMessage('');
    try {
      await authApi.resendEmailVerification();
      setResendAfter(Date.now() + 60000);
      setVerificationMessage(vi ? 'Đã gửi email xác nhận. Kiểm tra hộp thư và thư rác; liên kết có hiệu lực 60 phút.' : 'Verification email sent. Check your inbox and spam folder; the link expires in 60 minutes.');
    } catch (error) {
      setVerificationMessage(error instanceof Error ? error.message : (vi ? 'Không gửi được email. Vui lòng thử lại.' : 'Could not send email. Please try again.'));
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="profile-settings-page reader-profile-page">
      <header className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">{vi ? 'Hồ sơ cá nhân & Cài đặt' : 'Profile & Settings'}</h1>
        <p className="participant-page-sub workspace-page-subtitle">{vi ? 'Cập nhật thông tin cá nhân và quản lý tài khoản của bạn.' : 'Update your personal information and manage your account.'}</p>
      </header>
      {saveError && <div className="reader-profile-notice error" role="alert">{saveError}</div>}
      {saveSuccess && <div className="reader-profile-notice success" role="status"><Check size={18} />{vi ? 'Đã lưu thay đổi hồ sơ thành công!' : 'Profile changes saved successfully!'}</div>}
      <div className="profile-card-container">
        <div className="profile-card-header">
          <div className="profile-user-summary">
            <div className="reader-avatar-wrapper">
              <div className="profile-avatar-large">
                {profile.avatar ? <img src={profile.avatar} alt={profile.name} /> : profile.name.slice(0, 2).toUpperCase()}
              </div>
              <button className="reader-avatar-button" type="button" disabled={isSaving} onClick={() => fileInputRef.current?.click()}
                aria-label={vi ? 'Đổi ảnh đại diện' : 'Change profile photo'} title={vi ? 'Đổi ảnh đại diện' : 'Change profile photo'}><Camera size={18} /></button>
              <input type="file" ref={fileInputRef} accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={isSaving} onChange={handleAvatarFileSelect} />
            </div>
            <div className="profile-names">

              <h2>{profile.name}</h2>
              <p>{profile.email || (vi ? 'Chưa có email' : 'No email added')}</p>
              <span className="reader-role">{vi ? 'Độc giả' : 'Participant'}</span>
            </div>
          </div>
          {!isEditing && <button type="button" className="btn-part-secondary reader-edit-button" disabled={isSaving} onClick={() => { setIsEditing(true); setSaveSuccess(false); }}><Edit3 size={18} />{vi ? 'Chỉnh sửa' : 'Edit'}</button>}
        </div>
        <div className="reader-profile-body">
          <section className="reader-profile-information" aria-labelledby="reader-information-title">
            <div className="reader-section-heading"><UserRound size={20} /><h3 id="reader-information-title">{vi ? 'Thông tin cá nhân' : 'Personal information'}</h3></div>
            <p className="reader-section-description">{vi ? 'Thông tin giúp chúng tôi liên hệ và nhận diện bạn tại sự kiện.' : 'Your information helps us contact and identify you at events.'}</p>
            <form className="profile-details-table" onSubmit={async event => { event.preventDefault(); if (await persist({ name, phone })) setIsEditing(false); }}>
              <div className="profile-detail-row"><label className="profile-detail-label" htmlFor="reader-full-name">{vi ? 'Họ và tên' : 'Full name'}</label>
                {isEditing ? <input id="reader-full-name" className="part-select" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={50} autoComplete="name" autoFocus disabled={isSaving} /> : <span className="profile-detail-val">{profile.name}</span>}
              </div>
              <div className="profile-detail-row"><label className="profile-detail-label" htmlFor="reader-phone">{vi ? 'Số điện thoại' : 'Phone'}</label>
                {isEditing ? <input id="reader-phone" type="tel" className="part-select" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="0900 000 000" disabled={isSaving} /> : <span className="profile-detail-val">{profile.phone || (vi ? 'Chưa cập nhật' : 'Not provided')}</span>}
              </div>
              <div className="profile-detail-row"><span className="profile-detail-label">Email</span><div className="profile-detail-val">
                <div className="reader-email-line"><span>{profile.email || (vi ? 'Chưa có email' : 'No email added')}</span>
                  {profile.email && !profile.emailVerified && <button type="button" className="reader-verify-button" disabled={sendingVerification} onClick={() => void requestVerification()}><Mail size={15} />{sendingVerification ? (vi ? 'Đang gửi...' : 'Sending...') : (vi ? 'Xác nhận email' : 'Verify email')}</button>}
                  {profile.emailVerified && <span className="reader-email-verified"><Check size={15} />{vi ? 'Đã xác nhận' : 'Verified'}</span>}
                </div>
                <small>{vi ? 'Email tài khoản không thể chỉnh sửa tại đây.' : 'Account email cannot be edited here.'}</small>
                {!profile.emailVerified && verificationMessage && <small role="status">{verificationMessage}</small>}
              </div></div>
              {isEditing && <div className="reader-profile-actions"><button type="button" className="btn-part-secondary" disabled={isSaving} onClick={cancelEdit}><X size={17} />{vi ? 'Hủy' : 'Cancel'}</button><button type="submit" className="btn-part-primary" disabled={isSaving}><Check size={17} />{isSaving ? (vi ? 'Đang lưu...' : 'Saving...') : (vi ? 'Lưu' : 'Save')}</button></div>}
            </form>
          </section>

        </div>
      </div>
    </div>
  );
};
