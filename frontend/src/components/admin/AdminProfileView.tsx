import {
  Building,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Save,
  Shield,
  X
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { AdminProfile } from '../../types/admin';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface AdminProfileViewProps {
  profile: AdminProfile;
  onUpdateProfile: (updates: Partial<AdminProfile>) => void | Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => void | Promise<unknown>;
  onLogout: () => void;
}

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onChangePassword,
  onLogout
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState(profile.name);
  const [formEmail, setFormEmail] = useState(profile.email);
  const [formPhone, setFormPhone] = useState(profile.phone);
  const [formDepartment, setFormDepartment] = useState(profile.department);
  const [saveToast, setSaveToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change password modal
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // Logout confirm
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  useModalDismiss(isPwdModalOpen, () => setIsPwdModalOpen(false));
  useModalDismiss(isLogoutConfirmOpen, () => setIsLogoutConfirmOpen(false));

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Dung lượng ảnh tối đa là 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        try {
          await onUpdateProfile({ avatarUrl: result });
          setSaveToast(true);
          setTimeout(() => setSaveToast(false), 3000);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Không thể cập nhật ảnh đại diện');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const initials = formName
      .trim()
      .split(' ')
      .slice(-2)
      .map(w => w.charAt(0).toUpperCase())
      .join('') || profile.avatarInitials;

    await onUpdateProfile({
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim(),
      department: formDepartment.trim(),
      avatarInitials: initials
    });
    setIsEditing(false);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');

    if (newPwd.length < 8) {
      setPwdError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      await onChangePassword(currentPwd, newPwd);
      setPwdSuccess(true);
    } catch (error) {
      setPwdError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
      return;
    }
    setTimeout(() => {
      setPwdSuccess(false);
      setIsPwdModalOpen(false);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    }, 1500);
  };

  return (
    <div className="adm-profile-view">
      <div className="adm-profile-container">
        {/* Header */}
        <div className="adm-page-header">
          <div>

            <h1 className="adm-page-title workspace-page-title">Hồ sơ Quản trị viên</h1>
            <p className="adm-page-subtitle workspace-page-subtitle">
              Quản lý thông tin định danh quản trị và chính sách bảo mật tài khoản cá nhân.
            </p>
          </div>
        </div>

        {saveToast && (
          <div className="adm-toast-banner">
            <Check size={16} />
            <span>Đã cập nhật thành công thông tin hồ sơ của bạn.</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="adm-card adm-profile-card">
          <div className="adm-profile-header-band">
            <span className="admin-profile-card-label"><Shield size={15} /> Thông tin tài khoản</span>
          </div>

          <div className="adm-profile-body">
            <div className="adm-profile-top-bar">
              {/* Avatar with Camera Upload Icon Button */}
              <div className="adm-profile-avatar-wrapper">
                <div className="adm-profile-avatar-large">
                  {profile.avatarUrl ? (
                    <img 
                      src={profile.avatarUrl} 
                      alt={profile.name} 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    profile.avatarInitials
                  )}
                </div>

                {/* Upload Button overlay */}
                <button
                  type="button"
                  className="adm-avatar-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Tải lên ảnh đại diện mới"
                  aria-label="Tải lên ảnh đại diện"
                >
                  <Camera size={15} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarFileChange} 
                  accept="image/png, image/jpeg, image/webp" 
                  style={{ display: 'none' }} 
                />
              </div>

              <div className="adm-profile-actions">
                {!isEditing ? (
                  <button 
                    type="button"
                    className="adm-btn adm-btn-edit-profile"
                    onClick={() => {
                      setFormName(profile.name);
                      setFormEmail(profile.email);
                      setFormPhone(profile.phone);
                      setFormDepartment(profile.department);
                      setIsEditing(true);
                    }}
                  >
                    <Edit3 size={15} className="btn-icon" />
                    <span>Chỉnh sửa thông tin</span>
                  </button>
                ) : (
                  <button 
                    type="button"
                    className="adm-btn adm-btn-cancel-profile"
                    onClick={() => {
                      setIsEditing(false);
                      setFormName(profile.name);
                      setFormEmail(profile.email);
                      setFormPhone(profile.phone);
                      setFormDepartment(profile.department);
                    }}
                  >
                    <X size={15} className="btn-icon" />
                    <span>Hủy bỏ</span>
                  </button>
                )}
              </div>
            </div>

            <div className="adm-profile-info-block">
              <div className="adm-profile-name-group">
                <h2 className="adm-profile-name">{profile.name}</h2>
                <span className="adm-badge-role badge-role-admin">
                  <Shield size={13} />
                  <span>{profile.role}</span>
                </span>
              </div>
              <p className="adm-profile-dept">{profile.department}</p>
            </div>

            <div className="adm-profile-divider"></div>

            {/* Form or Readonly Information */}
            {!isEditing ? (
              <div className="adm-profile-details-grid">
                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-icon">
                    <Mail size={16} />
                  </div>
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Email tài khoản</span>
                    <span className="adm-field-val">{profile.email}</span>
                  </div>
                </div>

                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-icon">
                    <Phone size={16} />
                  </div>
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Số điện thoại liên hệ</span>
                    <span className="adm-field-val">{profile.phone}</span>
                  </div>
                </div>

                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-icon">
                    <Building size={16} />
                  </div>
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Đơn vị quản lý</span>
                    <span className="adm-field-val">{profile.department}</span>
                  </div>
                </div>

                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-icon">
                    <Clock size={16} />
                  </div>
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Phiên đăng nhập cuối</span>
                    <span className="adm-field-val">{profile.lastLogin}</span>
                  </div>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSaveProfile} className="adm-profile-form">
              <div className="adm-form-row">
                <div className="adm-form-group">
                  <label className="adm-form-label">Họ và tên <span style={{ color: '#EF4444' }}>*</span></label>
                  <input 
                    type="text"
                    required
                    className="adm-form-input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-form-label">Email tài khoản <span style={{ color: '#EF4444' }}>*</span></label>
                  <input 
                    type="email"
                    required
                    className="adm-form-input"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="adm-form-row">
                <div className="adm-form-group">
                  <label className="adm-form-label">Số điện thoại</label>
                  <input 
                    type="tel"
                    className="adm-form-input"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-form-label">Đơn vị / Phòng ban</label>
                  <input 
                    type="text"
                    className="adm-form-input"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                  />
                </div>
              </div>

              <div className="adm-form-actions-right">
                <button 
                  type="button" 
                  className="adm-btn adm-btn-cancel-profile" 
                  onClick={() => setIsEditing(false)}
                >
                  <X size={15} className="btn-icon" />
                  <span>Hủy</span>
                </button>
                <button type="submit" className="adm-btn adm-btn-save-profile">
                  <Save size={15} className="btn-icon" />
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          )}
          </div>
        </div>

        {/* Security & Credentials Card */}
        <div className="adm-card adm-profile-sec-card">
          <div className="adm-card-header">
            <div>
              <h3 className="adm-card-title">Bảo mật & Đăng nhập</h3>
              <p className="adm-card-subtitle">Mật khẩu tài khoản và cơ chế xác thực an ninh hai lớp</p>
            </div>
          </div>

          <div className="adm-profile-sec-body">
            <div className="adm-sec-item">
              <div className="adm-sec-item-info">
                <div className="adm-sec-title">Mật khẩu đăng nhập</div>
                <div className="adm-sec-desc">Thay đổi mật khẩu và thu hồi các phiên đăng nhập cũ.</div>
              </div>
              <button 
                className="adm-btn adm-btn-secondary"
                onClick={() => setIsPwdModalOpen(true)}
              >
                <KeyRound size={15} />
                <span>Đổi mật khẩu</span>
              </button>
            </div>

          </div>
        </div>

        {/* Session / Logout Card */}
        <div className="adm-card adm-profile-sec-card">
          <div className="adm-card-header">
            <div>
              <h3 className="adm-card-title">Phiên làm việc & Đăng xuất</h3>
              <p className="adm-card-subtitle">Hủy bỏ phiên truy cập quản trị viên hiện tại trên thiết bị này</p>
            </div>
          </div>

          <div className="adm-profile-sec-body">
            <div className="adm-sec-item">
              <div className="adm-sec-item-info">
                <div className="adm-sec-title">Đăng xuất tài khoản quản trị</div>
                <div className="adm-sec-desc">Để bảo mật hệ thống, vui lòng đăng xuất khi rời khỏi máy làm việc.</div>
              </div>
              <button 
                className="adm-btn adm-btn-danger"
                onClick={() => setIsLogoutConfirmOpen(true)}
              >
                <LogOut size={15} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {isPwdModalOpen && (
        <div className="adm-modal-overlay">
          <div className="adm-modal-content adm-dialog-content">
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">Đổi mật khẩu tài khoản</h3>
              <button className="adm-modal-close" onClick={() => setIsPwdModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {pwdSuccess ? (
              <div className="adm-modal-body text-center" style={{ padding: '2rem' }}>
                <CheckCircle2 size={42} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                <h4>Đổi mật khẩu thành công!</h4>
                <p style={{ color: '#64748b' }}>Mật khẩu mới của bạn đã có hiệu lực.</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword}>
                <div className="adm-modal-body">
                  {pwdError && (
                    <div className="adm-error-callout" style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      {pwdError}
                    </div>
                  )}

                  <div className="adm-form-group">
                    <label className="adm-form-label">Mật khẩu hiện tại *</label>
                    <input 
                      type="password"
                      required
                      className="adm-form-input"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                    />
                  </div>

                  <div className="adm-form-group">
                    <label className="adm-form-label">Mật khẩu mới (tối thiểu 8 ký tự) *</label>
                    <input 
                      type="password"
                      required
                      className="adm-form-input"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                    />
                  </div>

                  <div className="adm-form-group">
                    <label className="adm-form-label">Nhập lại mật khẩu mới *</label>
                    <input 
                      type="password"
                      required
                      className="adm-form-input"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="adm-modal-footer">
                  <button 
                    type="button" 
                    className="adm-btn adm-btn-secondary"
                    onClick={() => setIsPwdModalOpen(false)}
                  >
                    Hủy bỏ
                  </button>
                  <button type="submit" className="adm-btn adm-btn-primary">
                    Cập nhật mật khẩu
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {isLogoutConfirmOpen && (
        <div className="adm-modal-overlay">
          <div className="adm-modal-content adm-dialog-content">
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">Xác nhận đăng xuất</h3>
              <button className="adm-modal-close" onClick={() => setIsLogoutConfirmOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-confirm-text">
                Bạn có chắc chắn muốn kết thúc phiên làm việc Quản trị viên của <strong>{profile.name}</strong>?
              </p>
            </div>
            <div className="adm-modal-footer">
              <button 
                type="button" 
                className="adm-btn adm-btn-secondary"
                onClick={() => setIsLogoutConfirmOpen(false)}
              >
                Ở lại
              </button>
              <button 
                type="button" 
                className="adm-btn adm-btn-danger"
                onClick={onLogout}
              >
                Đăng xuất ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

