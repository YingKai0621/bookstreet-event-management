import { Camera, Check, Edit3, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Language, ParticipantProfile } from '../../types';
import './ParticipantPages.css';

interface ProfileSettingsPageProps {
  language: Language;
  profile: ParticipantProfile;
  onUpdateProfile: (updated: Partial<ParticipantProfile>) => void | Promise<void>;
}

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({
  language,
  profile,
  onUpdateProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [avatar, setAvatar] = useState(profile.avatar || '');
  const [emailNotifications, setEmailNotifications] = useState(profile.emailNotifications ?? true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setName(profile.name || '');
    setPhone(profile.phone || '');
    setAvatar(profile.avatar || '');
    setEmailNotifications(profile.emailNotifications ?? true);
  }, [profile.name, profile.phone, profile.avatar, profile.emailNotifications]);

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile({ name, phone, emailNotifications, avatar });
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save profile', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(language === 'vi' ? 'Kích thước ảnh tối đa là 5MB.' : 'Image size must not exceed 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatar(base64);
        try {
          await onUpdateProfile({ name, phone, emailNotifications, avatar: base64 });
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
          console.error('Failed to save uploaded avatar', err);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToggleNotifications = () => {
    const nextVal = !emailNotifications;
    setEmailNotifications(nextVal);
    void onUpdateProfile({ emailNotifications: nextVal });
  };

  return (
    <div className="profile-settings-page">
      {/* 1. Header */}
      <div className="participant-page-header">
        <h1 className="participant-page-title">
          {language === 'vi' ? 'Hồ sơ cá nhân & Cài đặt' : 'Profile & Settings'}
        </h1>
        <p className="participant-page-sub">
          {language === 'vi' 
            ? 'Quản lý thông tin tài khoản độc giả và tùy chọn nhận thông báo của bạn.' 
            : 'Manage your reader profile information and notification preferences.'}
        </p>
      </div>

      {saveSuccess && (
        <div style={{
          backgroundColor: '#E8F5EF',
          border: '1px solid #B8E0CF',
          color: '#1D6246',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          maxWidth: '680px'
        }}>
          <Check size={16} />
          <span>{language === 'vi' ? 'Đã lưu thay đổi hồ sơ thành công!' : 'Profile changes saved successfully!'}</span>
        </div>
      )}

      {/* 2. Main Profile Card matching Sketch Screen 9 */}
      <div className="profile-card-container">
        {/* User summary header */}
        <div className="profile-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div className="profile-user-summary">
            {/* Avatar with Upload Icon */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div 
                className="profile-avatar-large"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '2px solid #E9BC63',
                  background: avatar ? '#14241F' : 'linear-gradient(135deg, #E9BC63 0%, #D4A359 100%)'
                }}
                onClick={() => fileInputRef.current?.click()}
                title={language === 'vi' ? 'Bấm để đổi ảnh đại diện' : 'Click to change avatar'}
              >
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt={name || profile.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  name ? name.slice(0, 2).toUpperCase() : 'DE'
                )}
              </div>

              {/* Camera Upload Badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={language === 'vi' ? 'Tải ảnh đại diện lên từ máy tính' : 'Upload photo from device'}
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#14241F',
                  border: '2px solid #FFFFFF',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: '#E9BC63',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  transition: 'transform 160ms ease, background 160ms ease'
                }}
              >
                <Camera size={14} />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleAvatarFileSelect}
              />
            </div>

            <div className="profile-names">
              <h2>{name || profile.name}</h2>
              <p>{profile.email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span className="activity-tag" style={{ background: '#E6F5EE', color: '#267A58', border: '1px solid #BFE8D6' }}>
                  {profile.role || 'Participant'}
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#185E48',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.15rem 0.35rem',
                    textDecoration: 'underline'
                  }}
                >
                  <Upload size={12} />
                  <span>{language === 'vi' ? 'Tải ảnh mới' : 'Upload photo'}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={isEditing ? "btn-part-primary" : "btn-part-secondary"}
            disabled={isSaving}
            style={{ 
              height: '38px', 
              padding: '0 1.25rem', 
              flex: '0 0 auto', 
              width: 'auto', 
              minWidth: 'auto',
              borderRadius: '8px',
              whiteSpace: 'nowrap'
            }}
            onClick={async () => {
              if (isEditing) {
                await saveProfile();
              } else {
                setIsEditing(true);
              }
            }}
          >
            {isEditing ? (
              <>
                <Check size={14} />
                <span>{isSaving ? (language === 'vi' ? 'Đang lưu...' : 'Saving...') : (language === 'vi' ? 'Lưu' : 'Save')}</span>
              </>
            ) : (
              <>
                <Edit3 size={14} />
                <span>{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</span>
              </>
            )}
          </button>
        </div>

        {/* User Details Table / Fields */}
        <div className="profile-details-table">
          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Họ và tên:' : 'Full name:'}
            </span>
            {isEditing ? (
              <input
                type="text"
                className="part-select"
                style={{ width: '100%' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ) : (
              <span className="profile-detail-val">{name}</span>
            )}
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Email:' : 'Email:'}
            </span>
            <span className="profile-detail-val" style={{ color: '#637771' }}>
              {profile.email} (Không thay đổi)
            </span>
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Số điện thoại:' : 'Phone:'}
            </span>
            {isEditing ? (
              <input
                type="text"
                className="part-select"
                style={{ width: '100%' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0900 000 000"
              />
            ) : (
              <span className="profile-detail-val">{phone || (language === 'vi' ? 'Chưa cập nhật' : 'Not provided')}</span>
            )}
          </div>
        </div>

        {/* Notification Settings Toggle matching Sketch Screen 9 */}
        <div className="profile-settings-toggle-row">
          <div className="settings-toggle-info">
            <strong>{language === 'vi' ? 'Nhận thông báo qua Email' : 'Email Notifications'}</strong>
            <span>
              {language === 'vi' 
                ? 'Nhận thông báo nhắc lịch hoạt động và sự kiện mới nhất' 
                : 'Receive activity reminder alerts and new event notices'}
            </span>
          </div>

          <label className="switch-label">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={handleToggleNotifications}
            />
            <span className="switch-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

