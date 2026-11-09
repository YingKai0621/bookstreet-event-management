import {
  Check,
  Edit3,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import type { AdminProfileUpdate } from '../../services/adminProfileApi';
import { AdminProfile } from '../../types/admin';
import '../ui/RoleProfileDesign.css';
import './AdminAccounts.css';
import { fullNameError, normalizeFullName, phoneError } from './adminAccountValidation';

interface AdminProfileViewProps {
  profile: AdminProfile | null;
  loadError: string;
  onRetry: () => void;
  onUpdateProfile: (update: AdminProfileUpdate) => Promise<void>;
  onLogout: () => void;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';
  return 'Không lưu được hồ sơ. Vui lòng thử lại.';
}

/**
 * AC-ADM-S11-03: the Admin profile reads and updates through /auth/profile. Email cannot be changed
 * here, and there is no password action: users recover a password through the reset flow.
 */
export const AdminProfileView: React.FC<AdminProfileViewProps> = ({
  profile,
  loadError,
  onRetry,
  onUpdateProfile,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [saveToast, setSaveToast] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useModalDismiss(isLogoutConfirmOpen, () => setIsLogoutConfirmOpen(false));

  if (!profile) {
    return (
      <div className="adm-profile-view">
        <div className="adm-profile-container">
          <div className="adm-card adm-table-card">
            {loadError ? (
              <div className="adm-table-empty" role="alert">
                <p>{loadError}</p>
                <button type="button" className="adm-btn adm-btn-secondary" onClick={onRetry}>
                  <RefreshCw size={14} />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : (
              <p className="app-loading-state" role="status">Đang tải hồ sơ...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const save = async (update: AdminProfileUpdate) => {
    setSaving(true);
    setSaveError('');
    try {
      await onUpdateProfile(update);
      setIsEditing(false);
      setSaveToast(true);
      window.setTimeout(() => setSaveToast(false), 3000);
    } catch (error) {
      setSaveError(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const currentUpdate = (): AdminProfileUpdate => ({
    fullName: profile.name,
    phone: profile.phone || null,
    avatarUrl: profile.avatarUrl ?? null,
  });

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setSaveError('Ảnh đại diện phải là tệp PNG, JPG hoặc WEBP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setSaveError('Ảnh đại diện tối đa 5 MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }
    const reader = new FileReader();
    reader.onload = loaded => {
      const avatarUrl = loaded.target?.result;
      if (typeof avatarUrl === 'string') void save({ ...currentUpdate(), avatarUrl });
    };
    reader.readAsDataURL(file);
  };

  const startEditing = () => {
    setFormName(profile.name);
    setFormPhone(profile.phone);
    setSaveError('');
    setFieldErrors({});
    setIsEditing(true);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = normalizeFullName(formName);
    const errors = { fullName: fullNameError(formName) || undefined, phone: phoneError(formPhone) || undefined };
    setFieldErrors(errors);
    setSaveError('');
    if (errors.fullName || errors.phone) return;
    await save({ ...currentUpdate(), fullName, phone: formPhone.trim() || null });
  };

  return (
    <div className="adm-profile-view">
      <div className="adm-profile-container">
        <div className="adm-page-header">
          <div>
            <h1 className="adm-page-title workspace-page-title">Hồ sơ Quản trị viên</h1>
            <p className="adm-page-subtitle workspace-page-subtitle">
              Xem và cập nhật thông tin cá nhân của tài khoản quản trị.
            </p>
          </div>
        </div>

        {saveToast && (
          <div className="adm-toast-banner" role="status">
            <Check size={16} />
            <span>Đã cập nhật hồ sơ của bạn.</span>
          </div>
        )}

        <div className="adm-card adm-profile-card">
          <div className="adm-profile-body">
            <div className="adm-profile-identity">
              <div className="adm-profile-top-bar">
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
                  <button
                    type="button"
                    className="adm-avatar-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Tải lên ảnh đại diện mới"
                    aria-label="Tải lên ảnh đại diện"
                    disabled={saving}
                  >
                    <Upload size={12} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/png, image/jpeg, image/webp"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              <div className="adm-profile-info-block">
                <div className="adm-profile-name-group">
                  <h2 className="adm-profile-name">{profile.name}</h2>
                </div>
                <p className="adm-profile-dept">{profile.email || 'Chưa có email'}</p>
                <div className="adm-profile-role-pill">
                  <ShieldCheck size={13} color="#B48A3C" />
                  <span>Admin / Quản trị hệ thống</span>
                </div>
                <div className="adm-profile-status-row">
                  <span>Trạng thái:</span>
                  <span className="adm-profile-status-badge">
                    <span className="adm-profile-status-dot" />
                    Đang hoạt động
                  </span>
                </div>
              </div>
            </div>

            <div className="adm-profile-information-heading">
              <User size={18} color="#13241F" aria-hidden="true" />
              <div>
                <h3>Thông tin cá nhân</h3>
              </div>
              <div className="adm-profile-actions">
                <button
                  type="button"
                  className="adm-btn adm-btn-edit-profile"
                  disabled={saving}
                  aria-label={isEditing ? 'Hủy bỏ' : 'Chỉnh sửa thông tin'}
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      setSaveError('');
                    } else {
                      startEditing();
                    }
                  }}
                >
                  {isEditing ? <X size={13} /> : <Edit3 size={13} />}
                  <span>{isEditing ? 'Hủy bỏ' : 'Chỉnh sửa'}</span>
                </button>
              </div>
            </div>

            {saveError && <p className="adm-form-error" role="alert">{saveError}</p>}

            {!isEditing ? (
              <div className="adm-profile-details-grid">
                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Họ và tên</span>
                    <span className="adm-field-val">{profile.name}</span>
                  </div>
                </div>
                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Chức vụ</span>
                    <span className="adm-field-val">Quản trị viên</span>
                  </div>
                </div>
                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-icon"><Mail size={15} /></div>
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Email công vụ</span>
                    <span className="adm-field-val adm-profile-contact-value">
                      <Mail size={15} aria-hidden="true" />
                      {profile.email || 'Chưa có email'}
                    </span>
                  </div>
                </div>
                <div className="adm-profile-field-box">
                  <div className="adm-profile-field-icon"><Phone size={15} /></div>
                  <div className="adm-profile-field-content">
                    <span className="adm-field-label">Số điện thoại liên hệ</span>
                    <span className="adm-field-val adm-profile-contact-value">
                      <Phone size={15} aria-hidden="true" />
                      {profile.phone || ''}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="adm-profile-form" noValidate>
                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-profile-name">Họ và tên *</label>
                    <input
                      id="admin-profile-name"
                      type="text"
                      className="adm-form-input"
                      maxLength={50}
                      value={formName}
                      aria-invalid={fieldErrors.fullName ? true : undefined}
                      aria-describedby={fieldErrors.fullName ? 'admin-profile-name-error' : undefined}
                      onChange={event => {
                        setFormName(event.target.value);
                        setFieldErrors(current => ({ ...current, fullName: undefined }));
                      }}
                    />
                    {fieldErrors.fullName && <small id="admin-profile-name-error" className="adm-field-error">{fieldErrors.fullName}</small>}
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-profile-role">Chức vụ</label>
                    <input
                      id="admin-profile-role"
                      type="text"
                      className="adm-form-input"
                      value="Quản trị viên"
                      disabled
                    />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-profile-email">Email công vụ</label>
                    <input
                      id="admin-profile-email"
                      type="email"
                      className="adm-form-input"
                      value={profile.email || ''}
                      disabled
                    />
                    <small className="adm-form-hint">Email không thể thay đổi tại đây.</small>
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-profile-phone">Số điện thoại</label>
                    <input
                      id="admin-profile-phone"
                      type="tel"
                      className="adm-form-input"
                      maxLength={20}
                      value={formPhone}
                      aria-invalid={fieldErrors.phone ? true : undefined}
                      aria-describedby={fieldErrors.phone ? 'admin-profile-phone-error' : undefined}
                      onChange={event => {
                        setFormPhone(event.target.value);
                        setFieldErrors(current => ({ ...current, phone: undefined }));
                      }}
                    />
                    {fieldErrors.phone && <small id="admin-profile-phone-error" className="adm-field-error">{fieldErrors.phone}</small>}
                  </div>
                </div>
                <div className="adm-form-actions-right">
                  <button
                    type="button"
                    className="adm-btn adm-btn-cancel-profile"
                    disabled={saving}
                    onClick={() => { setIsEditing(false); setSaveError(''); }}
                  >
                    <X size={14} className="btn-icon" />
                    <span>Hủy</span>
                  </button>
                  <button type="submit" className="adm-btn adm-btn-save-profile" disabled={saving}>
                    <Save size={14} className="btn-icon" />
                    <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="adm-card adm-profile-sec-card">
          <div className="adm-profile-sec-body">
            <div className="adm-sec-item">
              <div className="adm-sec-item-info">
                <div className="adm-sec-title">Phiên làm việc</div>
                <div className="adm-sec-desc">Đăng xuất khỏi tài khoản trên thiết bị này.</div>
              </div>
              <button
                type="button"
                className="adm-btn adm-btn-logout-outline"
                onClick={() => setIsLogoutConfirmOpen(true)}
              >
                <LogOut size={14} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLogoutConfirmOpen && (
        <div className="adm-modal-overlay" onClick={() => setIsLogoutConfirmOpen(false)}>
          <section
            className="adm-modal-content adm-dialog-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-logout-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="admin-logout-title" className="adm-modal-title">Xác nhận đăng xuất</h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng" onClick={() => setIsLogoutConfirmOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-confirm-text">
                Bạn có chắc chắn muốn kết thúc phiên làm việc Quản trị viên của <strong>{profile.name}</strong>?
              </p>
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setIsLogoutConfirmOpen(false)}>
                Ở lại
              </button>
              <button type="button" className="adm-btn adm-btn-danger" onClick={onLogout}>
                Đăng xuất ngay
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
