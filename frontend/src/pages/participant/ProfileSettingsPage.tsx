import React, { useState } from 'react';
import { Edit3, Check } from 'lucide-react';
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
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone || '');
  const [emailNotifications, setEmailNotifications] = useState(profile.emailNotifications ?? true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const saveProfile = async () => {
    await onUpdateProfile({ name, phone, emailNotifications });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
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
        <div className="profile-card-header">
          <div className="profile-user-summary">
            <div className="profile-avatar-large">
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'NA'}
            </div>
            <div className="profile-names">
              <h2>{profile.name}</h2>
              <p>{profile.email}</p>
              <span className="activity-tag" style={{ background: '#E6F5EE', color: '#267A58', border: '1px solid #BFE8D6' }}>
                {profile.role}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={isEditing ? "btn-part-primary" : "btn-part-secondary"}
            style={{ height: '36px', padding: '0 1rem' }}
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
                <span>{language === 'vi' ? 'Lưu' : 'Save'}</span>
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

