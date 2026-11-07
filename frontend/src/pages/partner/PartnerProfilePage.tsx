import { AlertCircle, Camera, Check, CheckCircle2, Edit3, Upload, UserRound } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { Language, PartnerOrganization } from '../../types';
import '../participant/ParticipantPages.css';
import './PartnerPages.css';
import '../../components/ui/RoleProfileDesign.css';

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
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.shortDesc);
  const [categoryCode, setCategoryCode] = useState(organization.categoryCode || 'OTHER');
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl || '');
  const [contactEmail, setContactEmail] = useState(organization.email);
  const [contactPhone, setContactPhone] = useState(organization.phone);
  const [address, setAddress] = useState(organization.address);
  const [organizationSource, setOrganizationSource] = useState(organization);
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
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
        setErrorMessage('');
        try {
          await onUpdateOrg({
            name: name.trim(),
            shortDesc: description.trim(),
            categoryCode: categoryCode.trim().toUpperCase(),
            logoUrl: base64,
            email: contactEmail.trim(),
            phone: contactPhone.trim(),
            address: address.trim(),
          });
          setSuccessMessage(language === 'vi' ? 'Đã cập nhật ảnh đại diện tổ chức thành công!' : 'Logo updated successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
          console.error('Failed to save uploaded logo', err);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (organizationSource !== organization) {
    setOrganizationSource(organization);
    setName(organization.name);
    setDescription(organization.shortDesc);
    setCategoryCode(organization.categoryCode || 'OTHER');
    setLogoUrl(organization.logoUrl || '');
    setContactEmail(organization.email);
    setContactPhone(organization.phone);
    setAddress(organization.address);
  }

  const saveProfile = async () => {
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
      setIsEditing(false);
      setSuccessMessage(
        organization.id
          ? (language === 'vi' ? 'Đã lưu thay đổi hồ sơ tổ chức thành công!' : 'Organization profile saved successfully!')
          : (language === 'vi' ? 'Đã tạo hồ sơ tổ chức thành công!' : 'Organization profile created successfully!'),
      );
      setTimeout(() => setSuccessMessage(''), 3000);
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
    <div className="partner-profile-page profile-settings-page">
      {/* 1. Header */}
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">
          {language === 'vi' ? 'Hồ sơ tổ chức & Cài đặt' : 'Organization Profile & Settings'}
        </h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {language === 'vi'
            ? 'Quản lý thông tin hồ sơ doanh nghiệp / nhà xuất bản và thông tin liên hệ.'
            : 'Manage your organization profile, representative, and contact information.'}
        </p>
      </div>

      {errorMessage && (
        <div className="partner-form-alert error" role="alert" style={{ maxWidth: '680px', marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
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
            maxWidth: '680px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. Main Profile Card matching Participant Role design */}
      <div className="profile-card-container">
        {/* User summary header */}
        <div className="profile-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div className="profile-user-summary">
            {/* Logo / Avatar with Upload Badge */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div
                className="profile-avatar-large"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '2px solid #E9BC63',
                  background: logoUrl ? '#FFFFFF' : 'linear-gradient(135deg, #E9BC63 0%, #D4A359 100%)',
                }}
                onClick={() => fileInputRef.current?.click()}
                title={language === 'vi' ? 'Bấm để đổi logo tổ chức' : 'Click to change logo'}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={name || organization.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                  />
                ) : (
                  name ? name.slice(0, 2).toUpperCase() : 'PT'
                )}
              </div>

              {/* Camera Upload Badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={language === 'vi' ? 'Tải logo lên từ máy tính' : 'Upload photo from device'}
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
                  transition: 'transform 160ms ease, background 160ms ease',
                }}
              >
                <Camera size={14} />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />
            </div>

            <div className="profile-names">
              <h2>{name || organization.name || (language === 'vi' ? 'Chưa đặt tên tổ chức' : 'Untitled Organization')}</h2>
              <p>{contactEmail || organization.email || (language === 'vi' ? 'Chưa cập nhật email' : 'No email')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span
                  className="activity-tag"
                  style={{ background: '#E6F5EE', color: '#267A58', border: '1px solid #BFE8D6' }}
                >
                  {organization.status === 'ACTIVE'
                    ? (language === 'vi' ? 'ĐỐI TÁC HOẠT ĐỘNG' : 'ACTIVE PARTNER')
                    : (organization.status || 'PARTNER')}
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
                    textDecoration: 'underline',
                  }}
                >
                  <Upload size={12} />
                  <span>{language === 'vi' ? 'Tải logo mới' : 'Upload logo'}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={isEditing ? 'btn-part-primary' : 'btn-part-secondary'}
            disabled={isSaving}
            style={{
              height: '38px',
              padding: '0 1.25rem',
              flex: '0 0 auto',
              width: 'auto',
              minWidth: 'auto',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
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
                <span>{isSaving ? (language === 'vi' ? 'Đang lưu...' : 'Saving...') : (language === 'vi' ? 'Lưu thay đổi' : 'Save')}</span>
              </>
            ) : (
              <>
                <Edit3 size={14} />
                <span>{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</span>
              </>
            )}
          </button>
        </div>

        {/* Organization Details Table / Fields */}
        <div className="profile-information-heading">
          <UserRound size={20} aria-hidden="true" />
          <div>
            <h3>{language === 'vi' ? 'Thông tin tổ chức' : 'Organization information'}</h3>
            <p>{language === 'vi' ? 'Thông tin liên hệ và hồ sơ của tổ chức đối tác.' : 'Partner organization details and contact information.'}</p>
          </div>
        </div>
        <div className="profile-details-table">
          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Tên tổ chức *:' : 'Organization name *:'}
            </span>
            {isEditing ? (
              <input
                id="partner-organization-name"
                aria-label="Tên tổ chức *"
                type="text"
                className="part-select"
                style={{ width: '100%' }}
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ) : (
              <span className="profile-detail-val">{name || organization.name}</span>
            )}
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Mô tả:' : 'Description:'}
            </span>
            {isEditing ? (
              <textarea
                id="partner-organization-description"
                aria-label="Mô tả"
                className="part-select"
                style={{ width: '100%', minHeight: '75px', padding: '0.5rem 0.85rem' }}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <span className="profile-detail-val">{description || (language === 'vi' ? 'Chưa cập nhật' : 'Not provided')}</span>
            )}
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Mã loại hình *:' : 'Category code *:'}
            </span>
            {isEditing ? (
              <input
                id="partner-organization-category"
                aria-label="Mã loại hình *"
                type="text"
                className="part-select"
                style={{ width: '100%' }}
                required
                maxLength={50}
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                placeholder="Ví dụ: PUBLISHER"
              />
            ) : (
              <span className="profile-detail-val">{categoryCode || 'OTHER'}</span>
            )}
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Người đại diện:' : 'Representative:'}
            </span>
            <span className="profile-detail-val" style={{ color: '#637771' }}>
              {organization.representativeName || (language === 'vi' ? 'Tài khoản Partner hiện tại' : 'Current Partner')} ({language === 'vi' ? 'Đồng bộ từ tài khoản' : 'Synced from account'})
            </span>
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Email liên hệ:' : 'Contact email:'}
            </span>
            {isEditing ? (
              <input
                id="partner-organization-email"
                aria-label="Email liên hệ"
                type="email"
                className="part-select"
                style={{ width: '100%' }}
                maxLength={255}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            ) : (
              <span className="profile-detail-val">{contactEmail || (language === 'vi' ? 'Chưa cập nhật' : 'Not provided')}</span>
            )}
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Số điện thoại:' : 'Phone number:'}
            </span>
            {isEditing ? (
              <input
                id="partner-organization-phone"
                aria-label="Số điện thoại liên hệ"
                type="tel"
                className="part-select"
                style={{ width: '100%' }}
                maxLength={20}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="0900 000 000"
              />
            ) : (
              <span className="profile-detail-val">{contactPhone || (language === 'vi' ? 'Chưa cập nhật' : 'Not provided')}</span>
            )}
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">
              {language === 'vi' ? 'Địa chỉ:' : 'Address:'}
            </span>
            {isEditing ? (
              <input
                id="partner-organization-address"
                aria-label="Địa chỉ"
                type="text"
                className="part-select"
                style={{ width: '100%' }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            ) : (
              <span className="profile-detail-val">{address || (language === 'vi' ? 'Chưa cập nhật' : 'Not provided')}</span>
            )}
          </div>

          {isEditing && (
            <div className="profile-detail-row">
              <span className="profile-detail-label">
                {language === 'vi' ? 'URL Logo:' : 'Logo URL:'}
              </span>
              <input
                id="partner-organization-logo"
                aria-label="URL logo"
                type="text"
                className="part-select"
                style={{ width: '100%' }}
                placeholder="https://... hoặc bấm nút Tải ảnh lên"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
