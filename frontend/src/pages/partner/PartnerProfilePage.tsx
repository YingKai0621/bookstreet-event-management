import React, { useEffect, useState, useRef } from 'react';
import { AlertCircle, Building2, CheckCircle2, Save, UserRound, Upload, X } from 'lucide-react';
import { Language, PartnerOrganization } from '../../types';
import { ApiError } from '../../services/apiClient';
import './PartnerPages.css';

interface PartnerProfilePageProps {
  language: Language;
  organization: PartnerOrganization;
  onUpdateOrg: (updated: Partial<PartnerOrganization>) => void | Promise<void>;
}

export const PartnerProfilePage: React.FC<PartnerProfilePageProps> = ({
  language,
  organization,
  onUpdateOrg,
}) => {
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.shortDesc);
  const [categoryCode, setCategoryCode] = useState(organization.categoryCode || 'OTHER');
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl || '');
  const [contactEmail, setContactEmail] = useState(organization.email);
  const [contactPhone, setContactPhone] = useState(organization.phone);
  const [address, setAddress] = useState(organization.address);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(language === 'vi' ? 'Kích thước ảnh tối đa là 5MB.' : 'Image size must not exceed 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
        setErrorMessage('');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    setName(organization.name);
    setDescription(organization.shortDesc);
    setCategoryCode(organization.categoryCode || 'OTHER');
    setLogoUrl(organization.logoUrl || '');
    setContactEmail(organization.email);
    setContactPhone(organization.phone);
    setAddress(organization.address);
  }, [organization]);

  const handleSave = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await onUpdateOrg({
        name: name.trim(),
        shortDesc: description.trim(),
        categoryCode: categoryCode.trim().toUpperCase(),
        logoUrl: logoUrl.trim() || undefined,
        email: contactEmail.trim(),
        phone: contactPhone.trim(),
        address: address.trim(),
      });
      setSuccessMessage(
        organization.id
          ? 'Đã cập nhật hồ sơ tổ chức.'
          : 'Đã tạo hồ sơ tổ chức. Bạn có thể đăng ký tham gia sự kiện.',
      );
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        setErrorMessage(error.fieldErrors.map(item => item.message).join(' '));
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu hồ sơ tổ chức.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="partner-profile-page">
      <div className="partner-page-header">
        <h1 className="partner-page-title">
          {language === 'vi' ? 'Hồ sơ tổ chức' : 'Organization Profile'}
        </h1>
        <p className="partner-page-sub">
          {language === 'vi'
            ? 'Thông tin này được dùng khi tổ chức gửi hồ sơ tham gia sự kiện.'
            : 'This information identifies the organization in Event applications.'}
        </p>
      </div>

      {errorMessage && (
        <div className="partner-form-alert error" role="alert">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="partner-form-alert success" role="status">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="partner-profile-grid-layout">
        <aside className="partner-card" style={{ padding: '1.5rem', background: '#FAF8F5', border: '1px solid #EAE5DC' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(23, 56, 46, 0.08)', display: 'grid', placeItems: 'center', color: '#17382E', marginBottom: '0.75rem' }}>
            <Building2 size={26} />
          </div>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#8C6519', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
            {organization.id ? 'HỒ SƠ ĐỐI TÁC' : 'THIẾT LẬP BAN ĐẦU'}
          </div>
          <h2 style={{ margin: '0 0 0.45rem', color: '#172421', fontSize: '1.25rem', fontFamily: 'var(--font-serif)' }}>
            {organization.id ? organization.name : (language === 'vi' ? 'Chưa có hồ sơ tổ chức' : 'No Organization Profile')}
          </h2>
          <p style={{ margin: 0, color: '#556B65', lineHeight: 1.55, fontSize: '0.88rem' }}>
            {organization.id
              ? `Trạng thái: ${organization.status}`
              : (language === 'vi'
                ? 'Hoàn thiện thông tin bên phải để kích hoạt hồ sơ tổ chức và đủ điều kiện đăng ký sự kiện.'
                : 'Complete the form on the right to activate your organization profile for event applications.')}
          </p>

          <div style={{ marginTop: '1.25rem', paddingTop: '1.15rem', borderTop: '1px solid #E2EAE5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#172421', fontSize: '0.88rem' }}>
              <UserRound size={16} color="#17382E" />
              <strong>{language === 'vi' ? 'Người đại diện tài khoản' : 'Account Representative'}</strong>
            </div>
            <p style={{ margin: '0.35rem 0 0.5rem', color: '#334943', fontWeight: 600, fontSize: '0.92rem' }}>
              {organization.representativeName || (language === 'vi' ? 'Tài khoản Partner hiện tại' : 'Current Partner Account')}
            </p>
            <small style={{ color: '#7A8E87', display: 'block', lineHeight: 1.45, fontSize: '0.78rem' }}>
              {language === 'vi'
                ? 'Người đại diện được đồng bộ tự động từ phiên đăng nhập tài khoản.'
                : 'Representative is automatically linked from your authenticated session.'}
            </small>
          </div>
        </aside>

        <form className="partner-card" style={{ padding: '1.4rem' }} onSubmit={handleSave}>
          <div className="form-field-group">
            <label htmlFor="partner-organization-name">Tên tổ chức *</label>
            <input
              id="partner-organization-name"
              type="text"
              maxLength={150}
              required
              value={name}
              onChange={changeEvent => setName(changeEvent.target.value)}
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="partner-organization-description">Mô tả</label>
            <textarea
              id="partner-organization-description"
              rows={4}
              value={description}
              onChange={changeEvent => setDescription(changeEvent.target.value)}
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="partner-organization-category">Mã loại hình *</label>
            <input
              id="partner-organization-category"
              type="text"
              maxLength={50}
              required
              value={categoryCode}
              onChange={changeEvent => setCategoryCode(changeEvent.target.value)}
              placeholder="Ví dụ: PUBLISHER"
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="partner-organization-email">Email liên hệ</label>
            <input
              id="partner-organization-email"
              type="email"
              maxLength={255}
              value={contactEmail}
              onChange={changeEvent => setContactEmail(changeEvent.target.value)}
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="partner-organization-phone">Số điện thoại liên hệ</label>
            <input
              id="partner-organization-phone"
              type="tel"
              maxLength={20}
              value={contactPhone}
              onChange={changeEvent => setContactPhone(changeEvent.target.value)}
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="partner-organization-address">Địa chỉ</label>
            <input
              id="partner-organization-address"
              type="text"
              value={address}
              onChange={changeEvent => setAddress(changeEvent.target.value)}
            />
          </div>

          <div className="form-field-group">
            <label htmlFor="partner-organization-logo">URL logo</label>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input
                id="partner-organization-logo"
                type="text"
                placeholder="https://... hoặc tải ảnh từ máy tính"
                value={logoUrl}
                onChange={changeEvent => setLogoUrl(changeEvent.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-part-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0 0.9rem',
                  height: '38px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flex: '0 0 auto',
                  borderRadius: '8px'
                }}
              >
                <Upload size={14} />
                <span>Tải ảnh lên</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              style={{ display: 'none' }}
              onChange={handleLogoUpload}
            />

            {logoUrl && (
              <div style={{
                marginTop: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.55rem 0.85rem',
                background: '#F8FAF9',
                borderRadius: '8px',
                border: '1px solid #E2EAE5'
              }}>
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  style={{
                    width: '42px',
                    height: '42px',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    background: '#FFFFFF',
                    border: '1px solid #E2EAE5',
                    padding: '2px'
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '0.78rem', color: '#172421', display: 'block' }}>Xem trước Logo</strong>
                  <span style={{ fontSize: '0.72rem', color: '#637771', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {logoUrl.startsWith('data:') ? 'Ảnh đã tải từ máy tính' : logoUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  title="Xóa logo"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#DC2626',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    padding: '0.25rem'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="btn-part-primary" disabled={isSaving}>
            <Save size={16} />
            <span>{isSaving ? 'Đang lưu...' : organization.id ? 'Lưu thay đổi' : 'Tạo hồ sơ tổ chức'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
