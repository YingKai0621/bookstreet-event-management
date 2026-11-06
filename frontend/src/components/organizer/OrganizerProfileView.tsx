import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  Building2,
  Check,
  Edit3,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Upload,
  User,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { Language } from '../../types';
import { OrganizerProfile } from '../../types/organizer';
import '../ui/RoleProfileDesign.css';

interface OrganizerProfileViewProps {
  language: Language;
  profile: OrganizerProfile;
  onUpdateProfile: (updates: Partial<OrganizerProfile>) => void | Promise<void>;
  onLogout?: () => void;
}

export const OrganizerProfileView: React.FC<OrganizerProfileViewProps> = ({
  language,
  profile,
  onUpdateProfile,
  onLogout
}) => {
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [editAvatarUrl, setEditAvatarUrl] = useState(profile.avatarUrl || '');
  const [profileSource, setProfileSource] = useState(profile);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Logout confirmation modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  useModalDismiss(showLogoutConfirm, () => setShowLogoutConfirm(false));

  if (profileSource !== profile) {
    setProfileSource(profile);
    setEditPhone(profile.phone);
    setEditAvatarUrl(profile.avatarUrl || '');
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateProfile({
        phone: editPhone,
        avatarUrl: editAvatarUrl,
      });
      setIsEditing(false);
      showToast(language === 'vi' ? 'Đã lưu thay đổi thông tin cá nhân thành công!' : 'Profile changes saved successfully!');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể lưu hồ sơ');
    }
  };

  const handleCancelEdit = () => {
    setEditPhone(profile.phone);
    setEditAvatarUrl(profile.avatarUrl || '');
    setIsEditing(false);
  };

  return (
    <div className="organizer-content" style={{ padding: '1.75rem 2rem' }}>
      <div className="org-profile-container">
        {/* 1. Page Header matching prompt */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className="workspace-page-title">
            {language === 'vi' ? 'Hồ sơ Ban Quản Lý' : 'Organizer Profile'}
          </h1>
          <p className="workspace-page-subtitle">
            {language === 'vi' 
              ? 'Quản lý thông tin cá nhân và tùy chọn tài khoản.'
              : 'Manage personal profile and account preferences.'}
          </p>
        </div>

        {/* 2-Column Balanced Layout on Desktop (320px left, 1fr right) */}
        <div className="org-profile-layout">

          {/* LEFT COLUMN: Profile Summary & Session */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Profile Summary Card */}
            <div className="organizer-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 0.85rem auto' }}>
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #E9BC63',
                      boxShadow: '0 4px 12px rgba(19, 36, 31, 0.12)'
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#13241F',
                    color: '#E9BC63',
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    display: 'grid',
                    placeItems: 'center',
                    border: '2px solid #E9BC63',
                    boxShadow: '0 4px 12px rgba(19, 36, 31, 0.12)'
                  }}>
                    {profile.avatarInitials}
                  </div>
                )}
                <label 
                  style={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
                    background: '#17382E',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    border: '2px solid #FFFFFF'
                  }}
                  title={language === 'vi' ? 'Tải ảnh đại diện mới' : 'Upload new avatar'}
                >
                  <Upload size={12} />
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const res = evt.target?.result;
                          if (typeof res === 'string') {
                            setEditAvatarUrl(res);
                            void Promise.resolve(onUpdateProfile({ avatarUrl: res }))
                              .then(() => showToast(language === 'vi' ? 'Đã cập nhật ảnh đại diện!' : 'Avatar updated!'))
                              .catch(error => showToast(error instanceof Error ? error.message : 'Không thể cập nhật ảnh đại diện'));
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#13241F', margin: '0 0 0.25rem 0' }}>
                {profile.name}
              </h2>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(19, 36, 31, 0.06)',
                color: '#13241F',
                padding: '3px 10px',
                borderRadius: 16,
                fontSize: '0.76rem',
                fontWeight: 600,
                marginBottom: '0.75rem'
              }}>
                <ShieldCheck size={13} color="#B48A3C" />
                <span>Organizer / Điều hành sự kiện</span>
              </div>

              <p className="org-profile-email" style={{
                fontSize: '0.82rem', 
                color: '#4B5563', 
                lineHeight: 1.45, 
                margin: '0 0 1rem 0',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #E5E7EB'
              }}>
                {profile.email || '—'}
              </p>

              {/* Status and metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left', fontSize: '0.8rem', color: '#6B7280' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Trạng thái:</span>
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 5, 
                    color: '#059669', 
                    fontWeight: 600, 
                    fontSize: '0.75rem',
                    background: '#ECFDF5',
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }}></span>
                    {language === 'vi' ? 'Đang hoạt động' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Session / Account Card */}
            <div className="organizer-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem 1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#13241F', margin: '0 0 0.25rem 0' }}>
                  {language === 'vi' ? 'Phiên làm việc' : 'Session'}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.45, margin: 0 }}>
                  {language === 'vi' ? 'Đăng xuất khỏi tài khoản trên thiết bị này.' : 'Sign out of your account on this device.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  padding: '7px 16px',
                  background: 'transparent',
                  border: '1px solid #EF4444',
                  color: '#EF4444',
                  borderRadius: 7,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LogOut size={14} />
                <span>{language === 'vi' ? 'Đăng xuất' : 'Logout'}</span>
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: Personal Information & Notification Preferences */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* 3. Personal Information Card */}
            <div className="organizer-card" style={{ padding: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingBottom: '1rem',
                borderBottom: '1px solid #E5E7EB',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={18} color="#13241F" />
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#13241F', margin: 0 }}>
                    {language === 'vi' ? 'Thông tin cá nhân' : 'Personal Information'}
                  </h3>
                </div>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="btn-org-secondary"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 6
                    }}
                  >
                    <Edit3 size={13} />
                    <span>{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      style={{
                        padding: '5px 12px',
                        background: '#FFFFFF',
                        border: '1px solid #D1D5DB',
                        color: '#4B5563',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {language === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="btn-org-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: 6
                      }}
                    >
                      <Check size={14} />
                      <span>{language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Form Layout: 2 Columns on Desktop */}
              <form className={`org-profile-form${isEditing ? ' is-editing' : ''}`} onSubmit={handleSaveProfile}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.1rem'
                }}>
                  {/* Họ và tên */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Họ và tên' : 'Full Name'}
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      disabled
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 7,
                        border: '1px solid #E5E7EB',
                        background: '#F9FAFB',
                        color: '#1F2937',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  {/* Chức vụ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Chức vụ' : 'Designation'}
                    </label>
                    <input
                      type="text"
                      value={profile.role === 'ORGANIZER' ? (language === 'vi' ? 'Ban tổ chức' : 'Organizer') : profile.role}
                      disabled
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 7,
                        border: '1px solid #E5E7EB',
                        background: '#F9FAFB',
                        color: '#1F2937',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  {/* Cơ quan / Tổ chức trực thuộc */}
                  <div style={{ gridColumn: '1 / -1', ...(profile.organization ? {} : { display: 'none' }) }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Cơ quan / Tổ chức trực thuộc' : 'Affiliated Organization'}
                    </label>
                    <div className="org-profile-input-with-icon" style={{ position: 'relative' }}>
                      <Building2 size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        type="text"
                        value={profile.organization || ''}
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: 7,
                          border: '1px solid #E5E7EB',
                          background: '#F9FAFB',
                          color: '#1F2937',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>
                  </div>

                  {/* Ảnh đại diện (Avatar URL / Tải ảnh lên) */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 650, color: '#374151', margin: 0 }}>
                        {language === 'vi' ? 'Ảnh đại diện (Avatar)' : 'Avatar'}
                      </label>
                      {isEditing && (
                        <label 
                          className="btn-org-secondary" 
                          style={{ 
                            padding: '0.25rem 0.65rem', 
                            fontSize: '0.75rem', 
                            cursor: 'pointer', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem',
                            background: '#FFFFFF',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            color: '#17382E',
                            fontWeight: 650
                          }}
                          title={language === 'vi' ? 'Tải ảnh từ máy tính' : 'Upload from computer'}
                        >
                          <Upload size={12} />
                          <span>{language === 'vi' ? 'Tải ảnh lên' : 'Upload Avatar'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  if (typeof evt.target?.result === 'string') {
                                    setEditAvatarUrl(evt.target.result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={isEditing ? editAvatarUrl : (profile.avatarUrl || '')}
                        onChange={e => setEditAvatarUrl(e.target.value)}
                        placeholder={language === 'vi' ? 'https://... hoặc bấm tải ảnh lên' : 'https://... or upload image'}
                        disabled={!isEditing}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 7,
                          border: isEditing ? '1px solid #13241F' : '1px solid #E5E7EB',
                          background: isEditing ? '#FFFFFF' : '#F9FAFB',
                          color: '#1F2937',
                          fontSize: '0.85rem'
                        }}
                      />
                      {(isEditing ? editAvatarUrl : profile.avatarUrl) && (
                        <img
                          src={isEditing ? editAvatarUrl : profile.avatarUrl}
                          alt="Avatar preview"
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid #E5E7EB', flexShrink: 0 }}
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Email công vụ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Email công vụ' : 'Work Email'}
                    </label>
                    <div className="org-profile-input-with-icon" style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: 7,
                          border: '1px solid #E5E7EB',
                          background: '#F9FAFB',
                          color: '#1F2937',
                          fontSize: '0.85rem',
                          outline: 'none',
                          boxShadow: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Số điện thoại liên hệ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Số điện thoại liên hệ' : 'Contact Phone'}
                    </label>
                    <div className="org-profile-input-with-icon" style={{ position: 'relative' }}>
                      <Phone size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        type="tel"
                        value={isEditing ? editPhone : profile.phone}
                        onChange={e => setEditPhone(e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: 7,
                          border: isEditing ? '1px solid #13241F' : '1px solid #E5E7EB',
                          background: isEditing ? '#FFFFFF' : '#F9FAFB',
                          color: '#1F2937',
                          fontSize: '0.85rem',
                          outline: 'none',
                          boxShadow: isEditing ? '0 0 0 3px rgba(19, 36, 31, 0.08)' : 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

          </div>

        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="org-toast-banner">
          <Check size={16} color="#E9BC63" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog before Logout */}
      {showLogoutConfirm && (
        <div className="org-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="org-modal-box" style={{ maxWidth: 420, padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#13241F', margin: 0 }}>
                {language === 'vi' ? 'Xác nhận đăng xuất' : 'Confirm Logout'}
              </h3>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', fontSize: '0.88rem', color: '#4B5563', lineHeight: 1.5 }}>
              {language === 'vi' 
                ? 'Bạn có chắc chắn muốn kết thúc phiên làm việc của Ban Quản Lý và đăng xuất khỏi cổng?'
                : 'Are you sure you want to end your active organizer session and log out?'}
            </div>

            <div style={{ 
              padding: '0.85rem 1.5rem', 
              background: '#F9FAFB', 
              borderTop: '1px solid #E5E7EB', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '0.75rem' 
            }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  color: '#374151',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {language === 'vi' ? 'Không, ở lại' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout?.();
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {language === 'vi' ? 'Đăng xuất' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
