import {
  Bell,
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
import React, { useEffect, useState } from 'react';
import { Language } from '../../types';
import { OrganizerProfile } from '../../types/organizer';

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
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [editAvatarUrl, setEditAvatarUrl] = useState(profile.avatarUrl || '');
  
  // Notifications toggles state
  const [notifyNewBooth, setNotifyNewBooth] = useState(profile.notificationPreferences?.newBooth ?? true);
  const [notifyNewActivity, setNotifyNewActivity] = useState(profile.notificationPreferences?.newActivity ?? true);
  const [notifyDailyEmail, setNotifyDailyEmail] = useState(profile.notificationPreferences?.dailyEmail ?? true);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Logout confirmation modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setEditEmail(profile.email);
    setEditPhone(profile.phone);
    setEditAvatarUrl(profile.avatarUrl || '');
    setNotifyNewBooth(profile.notificationPreferences?.newBooth ?? true);
    setNotifyNewActivity(profile.notificationPreferences?.newActivity ?? true);
    setNotifyDailyEmail(profile.notificationPreferences?.dailyEmail ?? true);
  }, [profile]);

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
      email: editEmail,
      phone: editPhone,
      avatarUrl: editAvatarUrl
      });
      setIsEditing(false);
      showToast(language === 'vi' ? 'Đã lưu thay đổi thông tin cá nhân thành công!' : 'Profile changes saved successfully!');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể lưu hồ sơ');
    }
  };

  const handleCancelEdit = () => {
    setEditEmail(profile.email);
    setEditPhone(profile.phone);
    setEditAvatarUrl(profile.avatarUrl || '');
    setIsEditing(false);
  };

  const handleToggleNotification = async (key: 'booth' | 'activity' | 'email') => {
    const next = {
      newBooth: key === 'booth' ? !notifyNewBooth : notifyNewBooth,
      newActivity: key === 'activity' ? !notifyNewActivity : notifyNewActivity,
      dailyEmail: key === 'email' ? !notifyDailyEmail : notifyDailyEmail,
    };
    try {
      await onUpdateProfile({ notificationPreferences: next });
      setNotifyNewBooth(next.newBooth);
      setNotifyNewActivity(next.newActivity);
      setNotifyDailyEmail(next.dailyEmail);
      showToast(language === 'vi' ? 'Đã cập nhật tùy chọn thông báo' : 'Notification preference updated');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật tùy chọn');
    }
  };

  return (
    <div className="organizer-content" style={{ padding: '1.75rem 2rem' }}>
      <div className="org-profile-container">
        {/* 1. Page Header matching prompt */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ 
            fontSize: '1.45rem', 
            fontWeight: 700, 
            color: '#13241F', 
            margin: '0 0 0.35rem 0',
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            letterSpacing: '0.01em'
          }}>
            {language === 'vi' ? 'Hồ sơ Ban Quản Lý' : 'Organizer Profile'}
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#6B7280', margin: 0 }}>
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

              <p style={{ 
                fontSize: '0.82rem', 
                color: '#4B5563', 
                lineHeight: 1.45, 
                margin: '0 0 1rem 0',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #E5E7EB'
              }}>
                {profile.organization || 'Ban Quản Lý & Vận Hành Đường Sách TP.HCM'}
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Lần đăng nhập:</span>
                  <span style={{ color: '#13241F', fontWeight: 500 }}>Hôm nay, 08:30</span>
                </div>
              </div>
            </div>

            {/* Session / Account Card */}
            <div className="organizer-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#13241F', margin: '0 0 0.5rem 0' }}>
                {language === 'vi' ? 'Phiên làm việc' : 'Session Management'}
              </h3>
              
              <div style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.45, marginBottom: '1rem' }}>
                <div>Trình duyệt hiện tại: <strong>Chrome trên Windows</strong></div>
                <div style={{ marginTop: 2 }}>Kết nối mã hóa phiên an toàn.</div>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  width: '100%',
                  padding: '7px 12px',
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
              <form onSubmit={handleSaveProfile}>
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
                      value={profile.role}
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
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Cơ quan / Tổ chức trực thuộc' : 'Affiliated Organization'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        type="text"
                        value={profile.organization || 'Ban Quản Lý & Vận Hành Đường Sách TP.HCM'}
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
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        type="email"
                        value={isEditing ? editEmail : profile.email}
                        onChange={e => setEditEmail(e.target.value)}
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

                  {/* Số điện thoại liên hệ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      {language === 'vi' ? 'Số điện thoại liên hệ' : 'Contact Phone'}
                    </label>
                    <div style={{ position: 'relative' }}>
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

            {/* 4. Notification Preferences Card with Modern Toggle Switches */}
            <div className="organizer-card" style={{ padding: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                paddingBottom: '0.9rem',
                borderBottom: '1px solid #E5E7EB',
                marginBottom: '1rem'
              }}>
                <Bell size={18} color="#13241F" />
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#13241F', margin: 0 }}>
                  {language === 'vi' ? 'Cài đặt thông báo điều hành' : 'Notification Preferences'}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {/* Row 1 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #F3F4F6'
                }}>
                  <div style={{ paddingRight: '1rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1F2937', marginBottom: 2 }}>
                      {language === 'vi' ? 'Thông báo đơn đăng ký gian hàng mới' : 'New Booth Registration Alerts'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                      {language === 'vi' ? 'Nhận thông báo khi có hồ sơ gian hàng mới.' : 'Alerts when a new booth application is submitted.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`org-toggle-switch ${notifyNewBooth ? 'is-active' : ''}`}
                    onClick={() => handleToggleNotification('booth')}
                    role="switch"
                    aria-checked={notifyNewBooth}
                    aria-label="Thông báo đơn đăng ký gian hàng mới"
                  >
                    <span className="org-toggle-switch-thumb" />
                  </button>
                </div>

                {/* Row 2 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #F3F4F6'
                }}>
                  <div style={{ paddingRight: '1rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1F2937', marginBottom: 2 }}>
                      {language === 'vi' ? 'Thông báo đề xuất hoạt động cần duyệt' : 'Activity Proposal Alerts'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                      {language === 'vi' ? 'Nhận thông báo khi có đề xuất tọa đàm, workshop mới.' : 'Alerts when new activity proposals need review.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`org-toggle-switch ${notifyNewActivity ? 'is-active' : ''}`}
                    onClick={() => handleToggleNotification('activity')}
                    role="switch"
                    aria-checked={notifyNewActivity}
                    aria-label="Thông báo đề xuất hoạt động cần duyệt"
                  >
                    <span className="org-toggle-switch-thumb" />
                  </button>
                </div>

                {/* Row 3 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem 0'
                }}>
                  <div style={{ paddingRight: '1rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1F2937', marginBottom: 2 }}>
                      {language === 'vi' ? 'Nhận tóm tắt báo cáo định kỳ qua Email' : 'Periodic Summary via Email'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                      {language === 'vi' ? 'Gửi báo cáo tổng hợp lưu lượng người tham gia vào cuối ngày.' : 'Daily digest of attendee volume and operations.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`org-toggle-switch ${notifyDailyEmail ? 'is-active' : ''}`}
                    onClick={() => handleToggleNotification('email')}
                    role="switch"
                    aria-checked={notifyDailyEmail}
                    aria-label="Nhận tóm tắt báo cáo định kỳ qua Email"
                  >
                    <span className="org-toggle-switch-thumb" />
                  </button>
                </div>
              </div>
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
