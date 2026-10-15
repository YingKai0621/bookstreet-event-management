import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react';
import { Language } from '../../types';
import './Footer.css';

interface FooterProps {
  language: Language;
}

interface PublicSiteConfig {
  systemName?: string;
  supportEmail?: string;
  supportPhone?: string;
  physicalAddress?: string;
}

export const Footer: React.FC<FooterProps> = ({ language }) => {
  const isVi = language === 'vi';
  const [siteConfig] = useState<PublicSiteConfig | null>({ systemName: 'Đường Sách TP.HCM', supportEmail: 'hotro@duongsach.example.vn', supportPhone: '028 3822 5555', physicalAddress: 'Đường Nguyễn Văn Bình, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh' });

  return (
    <footer className="yg-footer">
      <div className="yg-footer-container">

        {/* Top Main Section */}
        <div className="yg-footer-main-grid">

          {/* Col 1: Navigation (2 sub-columns) */}
          <div className="yg-footer-col yg-nav-col">
            <span className="yg-section-label">
              {isVi ? 'ĐIỀU HƯỚNG' : 'NAVIGATION'}
            </span>
            <div className="yg-nav-dual-grid">
              <ul className="yg-nav-list">
                <li><Link to="/">{isVi ? 'Trang ch\u1ee7' : 'Home'}</Link></li>
                <li><Link to="/#gioi-thieu">{isVi ? 'Gi\u1edbi thi\u1ec7u' : 'About'}</Link></li>
                <li><Link to="/#gian-hang">{isVi ? 'Gian h\u00e0ng' : 'Bookstalls'}</Link></li>
                <li><Link to="/#su-kien">{isVi ? 'S\u1ef1 ki\u1ec7n' : 'Events'}</Link></li>
                <li><Link to="/di-san">{isVi ? 'Di s\u1ea3n' : 'Heritage'}</Link></li>
              </ul>
              <ul className="yg-nav-list">
                <li><Link to="/#ban-do">{isVi ? 'B\u1ea3n \u0111\u1ed3' : 'Map'}</Link></li>
                <li><Link to="/#gop-y">{isVi ? 'G\u00f3p \u00fd' : 'Feedback'}</Link></li>
                <li><Link to="/login">{isVi ? '\u0110\u0103ng nh\u1eadp' : 'Sign in'}</Link></li>
                <li><Link to="/register">{isVi ? '\u0110\u0103ng k\u00fd' : 'Register'}</Link></li>
                <li><Link to="/partner/login">{isVi ? 'D\u00e0nh cho \u0111\u1ed1i t\u00e1c' : 'Partner Portal'}</Link></li>
              </ul>
            </div>
          </div>

          {/* Col 2: Address & Location Map */}
          <div className="yg-footer-col yg-map-col">
            <span className="yg-section-label">
              {isVi ? 'ĐỊA CHỈ & BẢN ĐỒ' : 'LOCATION & MAP'}
            </span>
            <div className="yg-address-block">
              {siteConfig?.physicalAddress && <p className="yg-address-text">
                <MapPin size={15} className="yg-accent-ico" />
                <span>{siteConfig.physicalAddress}</span>
              </p>}

            </div>

            {/* Google Map Mini Embed */}
            {siteConfig?.physicalAddress && <div className="yg-map-preview-wrap">
              <iframe
                title="Bản đồ vị trí Đường Sách TP.HCM"
                src={`https://www.google.com/maps?q=${encodeURIComponent(siteConfig.physicalAddress)}&output=embed`}
                width="100%"
                height="110"
                style={{ border: 0, borderRadius: '10px' }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(siteConfig.physicalAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="yg-map-direct-link"
              >
                <span>{isVi ? 'Chỉ đường trên Google Maps' : 'Get Directions on Google Maps'}</span>
                <ExternalLink size={13} />
              </a>
            </div>}
          </div>

          <div className="yg-footer-col yg-awards-col">
            <span className="yg-section-label">{isVi ? 'KẾT NỐI' : 'CONNECT'}</span>
            <div className="yg-contact-mini">
              <div className="yg-contact-row">
                {siteConfig?.supportPhone && (
                  <a href={`tel:${siteConfig.supportPhone.replace(/\s/g, '')}`} className="yg-contact-link">
                    <Phone size={13} /> {siteConfig.supportPhone}
                  </a>
                )}
                {siteConfig?.supportEmail && (
                  <a href={`mailto:${siteConfig.supportEmail}`} className="yg-contact-link">
                    <Mail size={13} /> {siteConfig.supportEmail}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="yg-divider" />

        {/* Bottom Meta Row */}
        <div className="yg-bottom-meta">
          <div className="yg-copy">
            © {new Date().getFullYear()} {siteConfig?.systemName || ''}
          </div>
          <div className="yg-legal-links">
            <Link to="/contact">{isVi ? 'Điều khoản & Quy định' : 'Terms & Conditions'}</Link>
            <span className="yg-dot">•</span>
            <Link to="/contact">{isVi ? 'Chính sách bảo mật' : 'Privacy Policy'}</Link>
          </div>
        </div>
      </div>

      {/* Giant Bottom Brand Monument (Full-bleed, Half-clipped like reference) */}
      <div className="yg-brand-monument" aria-hidden="true">
        <span className="yg-monument-text">BOOK STREET</span>
      </div>
    </footer>
  );
};
