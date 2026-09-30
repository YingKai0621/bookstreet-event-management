import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Edit3, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  User, 
  FileText 
} from 'lucide-react';
import { Language, PartnerOrganization } from '../../types';
import { partnerApi } from '../../services/partnerApi';
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
  const [activeTab, setActiveTab] = useState<'general' | 'rep' | 'account' | 'security'>('general');
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [name, setName] = useState(organization.name);
  const [shortDesc, setShortDesc] = useState(organization.shortDesc);
  const [address, setAddress] = useState(organization.address);
  const [website, setWebsite] = useState(organization.website);
  const [repName, setRepName] = useState(organization.representativeName);
  const [email, setEmail] = useState(organization.email);
  const [phone, setPhone] = useState(organization.phone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setName(organization.name); setShortDesc(organization.shortDesc); setAddress(organization.address);
    setWebsite(organization.website); setRepName(organization.representativeName); setEmail(organization.email); setPhone(organization.phone);
  }, [organization]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateOrg({
      name,
      shortDesc,
      address,
      website,
      representativeName: repName,
      email,
      phone
    });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleChangePassword = async () => {
    try {
      await partnerApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword('');
      alert(language === 'vi' ? 'Đã cập nhật mật khẩu. Vui lòng đăng nhập lại ở phiên tiếp theo.' : 'Password updated.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu'); }
  };

  return (
    <div className="partner-profile-page">
      {/* 1. Header matching Sketch Screen 9 */}
      <div className="partner-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="partner-page-title" style={{ margin: 0 }}>
            {language === 'vi' ? 'Thông tin tổ chức' : 'Organization Profile'}
          </h1>
          <p className="partner-page-sub">
            {language === 'vi' 
              ? 'Hồ sơ pháp lý, thông tin đại diện và tài khoản đối tác triển lãm.' 
              : 'Legal organization information, representative contact and security.'}
          </p>
        </div>

        <button
          type="button"
          className="btn-part-primary"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Edit3 size={15} />
          <span>{isEditing ? (language === 'vi' ? 'Hủy chỉnh sửa' : 'Cancel') : (language === 'vi' ? 'Chỉnh sửa' : 'Edit Profile')}</span>
        </button>
      </div>

      {saveSuccess && (
        <div style={{
          backgroundColor: '#E8F5EF',
          border: '1px solid #B8E0CF',
          borderRadius: '10px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          marginBottom: '1.5rem',
          color: '#065F46',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>{language === 'vi' ? 'Đã lưu thông tin tổ chức thành công!' : 'Profile updated successfully!'}</span>
        </div>
      )}

      {/* 2. Top Profile Summary Card matching Sketch Screen 9 */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '14px',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          width: '74px',
          height: '74px',
          borderRadius: '50%',
          background: '#1B382F',
          border: '2.5px solid #E9BC63',
          color: '#E9BC63',
          fontSize: '2rem',
          fontWeight: 800,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-serif)',
          flexShrink: 0
        }}>
          B
        </div>

        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', fontWeight: 800, color: '#172421', margin: '0 0 0.35rem 0' }}>
            {organization.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.84rem', color: '#556B65', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Mail size={14} color="#B3862A" />
              {organization.email}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} color="#B3862A" />
              {organization.phone}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Globe size={14} color="#B3862A" />
              <a href={organization.website} target="_blank" rel="noreferrer" style={{ color: '#17382E', fontWeight: 600 }}>
                {organization.website}
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tabs Navigation matching Sketch Screen 9 */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2EAE5', borderRadius: '14px', padding: '1.75rem' }}>
        <div className="partner-tabs-bar">
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'general' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            {language === 'vi' ? 'Thông tin chung' : 'General Info'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'rep' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('rep')}
          >
            {language === 'vi' ? 'Người liên hệ' : 'Representative'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'account' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            {language === 'vi' ? 'Tài khoản' : 'Account'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'security' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            {language === 'vi' ? 'Bảo mật' : 'Security'}
          </button>
        </div>

        {/* Tab 1: General Info */}
        {activeTab === 'general' && (
          isEditing ? (
            <form onSubmit={handleSave} style={{ maxWidth: '750px' }}>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Tên tổ chức *' : 'Organization Name *'}</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Mô tả tổ chức *' : 'Description *'}</label>
                <textarea 
                  rows={3}
                  required 
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                />
              </div>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Địa chỉ trụ sở *' : 'Address *'}</label>
                <input 
                  type="text" 
                  required 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Website chính thức' : 'Website'}</label>
                <input 
                  type="url" 
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-part-secondary" onClick={() => setIsEditing(false)}>
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn-part-primary">
                  {language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Tên tổ chức:' : 'Organization:'}
                </span>
                <strong style={{ color: '#172421', fontSize: '0.92rem' }}>{organization.name}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Mô tả:' : 'Description:'}
                </span>
                <span style={{ color: '#2D3E39', fontSize: '0.9rem', lineHeight: 1.6 }}>{organization.shortDesc}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Địa chỉ:' : 'Address:'}
                </span>
                <span style={{ color: '#2D3E39', fontSize: '0.9rem' }}>{organization.address}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Website:' : 'Website:'}
                </span>
                <a href={organization.website} target="_blank" rel="noreferrer" style={{ color: '#17382E', fontWeight: 700, textDecoration: 'underline' }}>
                  {organization.website}
                </a>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Danh mục ngành hàng:' : 'Categories:'}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {organization.categories.map((c, idx) => (
                    <span key={idx} style={{ background: '#FAF8F3', border: '1px solid #EFE8D8', color: '#8C6519', padding: '0.2rem 0.65rem', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 600 }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {/* Tab 2: Representative Info */}
        {activeTab === 'rep' && (
          isEditing ? (
            <form onSubmit={handleSave} style={{ maxWidth: '750px' }}>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Người đại diện *' : 'Representative Name *'}</label>
                <input 
                  type="text" 
                  required 
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  placeholder={language === 'vi' ? 'Họ và tên người đại diện...' : 'Representative full name...'}
                />
              </div>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Email liên hệ *' : 'Contact Email *'}</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                />
              </div>
              <div className="form-field-group">
                <label>{language === 'vi' ? 'Số điện thoại liên hệ *' : 'Phone Number *'}</label>
                <input 
                  type="tel" 
                  required 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0909 123 456"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-part-secondary" onClick={() => setIsEditing(false)}>
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn-part-primary">
                  {language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Người đại diện:' : 'Representative:'}
                </span>
                <strong style={{ color: '#172421', fontSize: '0.92rem' }}>{organization.representativeName}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Email liên hệ:' : 'Email:'}
                </span>
                <span style={{ color: '#2D3E39', fontSize: '0.9rem' }}>{organization.email}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0' }}>
                <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>
                  {language === 'vi' ? 'Số điện thoại:' : 'Phone:'}
                </span>
                <span style={{ color: '#2D3E39', fontSize: '0.9rem' }}>{organization.phone}</span>
              </div>
            </div>
          )
        )}

        {/* Tab 3: Account */}
        {activeTab === 'account' && (
          <div style={{ maxWidth: '800px' }}>
            <p style={{ color: '#556B65', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              {language === 'vi' ? 'Tài khoản định danh đối tác trên hệ thống Đường Sách TP.HCM.' : 'Account credentials.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0', borderBottom: '1px solid #EEF2F0' }}>
              <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>Tên đăng nhập:</span>
              <strong>{organization.email}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem', padding: '0.85rem 0' }}>
              <span style={{ fontSize: '0.86rem', color: '#637771', fontWeight: 600 }}>Trạng thái tài khoản:</span>
              <span className={`status-badge ${organization.isVerified ? 'approved' : 'pending'}`}>{organization.isVerified ? 'Đã xác minh' : 'Chờ xác minh'}</span>
            </div>
          </div>
        )}

        {/* Tab 4: Security */}
        {activeTab === 'security' && (
          <div style={{ maxWidth: '600px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>
              {language === 'vi' ? 'Đổi mật khẩu tài khoản' : 'Change Password'}
            </h3>
            <div className="form-field-group">
              <label>{language === 'vi' ? 'Mật khẩu hiện tại' : 'Current Password'}</label>
              <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-field-group">
              <label>{language === 'vi' ? 'Mật khẩu mới' : 'New Password'}</label>
              <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="••••••••" />
            </div>
            <button 
              type="button" 
              className="btn-part-primary" 
              style={{ marginTop: '0.5rem' }}
              onClick={() => void handleChangePassword()}
            >
              <ShieldCheck size={16} />
              <span>{language === 'vi' ? 'Cập nhật mật khẩu' : 'Update Password'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

