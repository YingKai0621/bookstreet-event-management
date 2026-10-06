import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Save, UserRound } from 'lucide-react';
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.7fr) minmax(0, 1.5fr)', gap: '1.5rem', alignItems: 'start' }}>
        <aside className="partner-card" style={{ padding: '1.25rem' }}>
          <Building2 size={30} color="#17382E" />
          <h2 style={{ margin: '0.8rem 0 0.35rem', color: '#172421' }}>
            {organization.id ? organization.name : 'Chưa có hồ sơ tổ chức'}
          </h2>
          <p style={{ margin: 0, color: '#637771', lineHeight: 1.55 }}>
            {organization.id
              ? `Trạng thái: ${organization.status}`
              : 'Hoàn thiện biểu mẫu để tạo hồ sơ tổ chức đang hoạt động.'}
          </p>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2EAE5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334943' }}>
              <UserRound size={16} />
              <strong>Người đại diện tài khoản</strong>
            </div>
            <p style={{ margin: '0.4rem 0 0', color: '#637771' }}>
              {organization.representativeName || 'Tài khoản Partner hiện tại'}
            </p>
            <small style={{ color: '#7A8E87' }}>
              Người đại diện được xác định từ phiên đăng nhập và không gửi trong request.
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
            <input
              id="partner-organization-logo"
              type="url"
              value={logoUrl}
              onChange={changeEvent => setLogoUrl(changeEvent.target.value)}
            />
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
