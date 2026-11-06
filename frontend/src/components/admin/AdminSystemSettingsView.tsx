import {
  Building,
  Check,
  RotateCcw,
  Save,
  ShieldCheck
} from 'lucide-react';
import React, { useState } from 'react';
import { AdminSystemSettings } from '../../types/admin';

interface AdminSystemSettingsViewProps {
  settings: AdminSystemSettings;
  onSaveSettings: (newSettings: AdminSystemSettings) => void;
  onResetSettings: () => void;
}

export const AdminSystemSettingsView: React.FC<AdminSystemSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetSettings
}) => {
  const [formData, setFormData] = useState<AdminSystemSettings>({
    general: { ...settings.general },
    security: { ...settings.security },
    notifications: { ...settings.notifications }
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const handleGeneralChange = (key: keyof AdminSystemSettings['general'], value: any) => {
    setFormData(prev => ({
      ...prev,
      general: { ...prev.general, [key]: value }
    }));
    setHasChanges(true);
    setSaveToast(false);
  };

  const handleSecurityChange = (key: keyof AdminSystemSettings['security'], value: any) => {
    setFormData(prev => ({
      ...prev,
      security: { ...prev.security, [key]: value }
    }));
    setHasChanges(true);
    setSaveToast(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setHasChanges(false);
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
    }, 4000);
  };

  const handleReset = () => {
    onResetSettings();
    setFormData({
      general: { ...settings.general },
      security: { ...settings.security },
      notifications: { ...settings.notifications }
    });
    setHasChanges(false);
  };

  return (
    <div className="adm-settings-view">
      {/* Header */}
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Cài đặt Hệ thống</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Cấu hình thông số vận hành chung và chính sách bảo mật phiên làm việc.
          </p>
        </div>
        <div className="adm-page-header-actions">
          {hasChanges && (
            <button 
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={handleReset}
            >
              <RotateCcw size={16} />
              <span>Hủy thay đổi</span>
            </button>
          )}
          <button 
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={handleSubmit}
            disabled={!hasChanges}
          >
            <Save size={16} />
            <span>Lưu cài đặt</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="adm-toast-banner">
          <Check size={16} />
          <span>Đã lưu thành công các cài đặt hệ thống mới. Các cấu hình bảo mật có hiệu lực ngay lập tức.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="adm-settings-form">
        {/* Section 1: General Branding */}
        <div className="adm-card adm-settings-card">
          <div className="adm-card-header">
            <div className="adm-card-header-icon">
              <Building size={20} />
            </div>
            <div>
              <h3 className="adm-card-title">Thông tin Nhận diện & Liên hệ Nền tảng</h3>
              <p className="adm-card-subtitle">Hiển thị trên toàn bộ cổng thông tin và các thông báo gửi đến đối tác, độc giả</p>
            </div>
          </div>

          <div className="adm-card-body">
            <div className="adm-form-row">
              <div className="adm-form-group">
                <label className="adm-form-label">Tên hệ thống</label>
                <input 
                  type="text"
                  className="adm-form-input"
                  value={formData.general.systemName}
                  onChange={(e) => handleGeneralChange('systemName', e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-form-label">Khẩu hiệu / Slogan</label>
                <input 
                  type="text"
                  className="adm-form-input"
                  value={formData.general.slogan}
                  onChange={(e) => handleGeneralChange('slogan', e.target.value)}
                />
              </div>
            </div>

            <div className="adm-form-row">
              <div className="adm-form-group">
                <label className="adm-form-label">Email hỗ trợ kỹ thuật</label>
                <input 
                  type="email"
                  className="adm-form-input"
                  value={formData.general.supportEmail}
                  onChange={(e) => handleGeneralChange('supportEmail', e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-form-label">Đường dây nóng (Hotline)</label>
                <input 
                  type="text"
                  className="adm-form-input"
                  value={formData.general.supportPhone}
                  onChange={(e) => handleGeneralChange('supportPhone', e.target.value)}
                />
              </div>
            </div>

            <div className="adm-form-group">
              <label className="adm-form-label">Địa chỉ trụ sở điều hành</label>
              <input 
                type="text"
                className="adm-form-input"
                value={formData.general.physicalAddress}
                onChange={(e) => handleGeneralChange('physicalAddress', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Security Policies */}
        <div className="adm-card adm-settings-card">
          <div className="adm-card-header">
            <div className="adm-card-header-icon icon-emerald">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="adm-card-title">Chính sách Bảo mật & Tài khoản</h3>
              <p className="adm-card-subtitle">Quy định độ phức tạp mật khẩu và tự động bảo vệ tài khoản khỏi xâm nhập trái phép</p>
            </div>
          </div>

          <div className="adm-card-body">
            <div className="adm-form-row">
              <div className="adm-form-group">
                <label className="adm-form-label">Độ dài mật khẩu tối thiểu (ký tự)</label>
                <input 
                  type="number"
                  min={6}
                  max={32}
                  className="adm-form-input"
                  value={formData.security.minPasswordLength}
                  onChange={(e) => handleSecurityChange('minPasswordLength', parseInt(e.target.value) || 8)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-form-label">Giới hạn đăng nhập sai trước khi tự khóa</label>
                <input 
                  type="number"
                  min={3}
                  max={10}
                  className="adm-form-input"
                  value={formData.security.maxFailedAttempts}
                  onChange={(e) => handleSecurityChange('maxFailedAttempts', parseInt(e.target.value) || 5)}
                />
              </div>
            </div>

            <div className="adm-form-row">
              <div className="adm-form-group">
                <label className="adm-form-label">Thời gian hết hạn phiên làm việc (Phút)</label>
                <input 
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  className="adm-form-input"
                  value={formData.security.sessionTimeoutMinutes}
                  onChange={(e) => handleSecurityChange('sessionTimeoutMinutes', parseInt(e.target.value) || 60)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-form-label">Xác thực hai bước (2FA bắt buộc với Quản trị viên)</label>
                <div className="adm-toggle-row">
                  <label className="adm-toggle-label">
                    <input 
                      type="checkbox"
                      className="adm-toggle-checkbox"
                      checked={formData.security.twoFactorEnabled}
                      onChange={(e) => handleSecurityChange('twoFactorEnabled', e.target.checked)}
                    />
                    <span className="adm-toggle-slider"></span>
                  </label>
                  <span className="adm-toggle-status-text">
                    {formData.security.twoFactorEnabled ? 'Bắt buộc xác thực OTP 2FA' : 'Chưa bắt buộc'}
                  </span>
                </div>
              </div>
            </div>

            <div className="adm-setting-toggle-item">
              <div className="adm-setting-toggle-info">
                <span className="adm-setting-toggle-title">Bắt buộc mật khẩu có ký tự đặc biệt & số</span>
                <span className="adm-setting-toggle-desc">Áp dụng cho mọi tài khoản đối tác và ban tổ chức khi khởi tạo hoặc đổi mật khẩu</span>
              </div>
              <label className="adm-toggle-label">
                <input 
                  type="checkbox"
                  className="adm-toggle-checkbox"
                  checked={formData.security.requireSpecialChar}
                  onChange={(e) => handleSecurityChange('requireSpecialChar', e.target.checked)}
                />
                <span className="adm-toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};

