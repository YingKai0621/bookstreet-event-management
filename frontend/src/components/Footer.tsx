import { Mail, MapPin, Phone } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Language } from '../types';
import './Footer.css';

interface FooterProps {
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({ language }) => {
  return (
    <footer className="figma-footer">
      <div className="container">
        {/* Figma 4-Column Footer Grid */}
        <div className="figma-footer-grid">
          {/* Col 1: Brand & Tagline */}
          <div className="footer-col-brand">
            <div className="footer-brand-logo">
              <div className="footer-icon-gold">
                <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" className="footer-logo-img" />
              </div>
              <div className="footer-name-group">
                <span className="footer-title-serif">ĐƯỜNG SÁCH</span>
                <span className="footer-sub-gold">TRỰC TUYẾN</span>
              </div>
            </div>
            <p className="footer-desc">
              {language === 'vi'
                ? 'Không gian văn hóa đọc đặc trưng giữa lòng Sài Gòn — Nơi hội tụ tri thức, độc giả và di sản đô thị.'
                : 'A signature cultural reading haven in Saigon — uniting knowledge, readers, and urban heritage.'}
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div className="footer-col">
            <h4 className="footer-col-title">
              {language === 'vi' ? 'Khám phá' : 'Explore'}
            </h4>
            <ul className="footer-links">
              <li><a href="#hero">{language === 'vi' ? 'Trang chủ' : 'Home'}</a></li>
              <li><a href="#su-kien">{language === 'vi' ? 'Lịch sự kiện' : 'Events'}</a></li>
              <li><a href="#gian-hang">{language === 'vi' ? 'Gian hàng ki-ốt' : 'Bookstalls'}</a></li>
              <li><a href="#ban-do">{language === 'vi' ? 'Bản đồ phố sách' : 'Street Map'}</a></li>
              <li><Link to="/di-san">{language === 'vi' ? 'Khám phá di sản' : 'Heritage Trail'}</Link></li>
            </ul>
          </div>

          {/* Col 3: Information & Partners */}
          <div className="footer-col">
            <h4 className="footer-col-title">
              {language === 'vi' ? 'Phát triển' : 'Partnership'}
            </h4>
            <div className="footer-partner-box">
              <p className="partner-headline">
                <strong>AIC Lab — Đại học FPT TP.HCM</strong>
              </p>
              <p className="partner-sub">
                {language === 'vi' 
                  ? 'Chủ trì triển khai công nghệ, phối hợp cùng Công ty TNHH Đường Sách TP.HCM.'
                  : 'Leading digital implementation with HCMC Book Street Co., Ltd.'}
              </p>
            </div>
          </div>

          {/* Col 4: Contact info */}
          <div className="footer-col">
            <h4 className="footer-col-title">
              {language === 'vi' ? 'Liên hệ' : 'Contact'}
            </h4>
            <ul className="footer-contact-items">
              <li>
                <MapPin size={15} className="contact-ico" />
                <span>Nguyễn Văn Bình, Q.1, TP.HCM</span>
              </li>
              <li>
                <Phone size={15} className="contact-ico" />
                <span>(028) 3822 5683</span>
              </li>
              <li>
                <Mail size={15} className="contact-ico" />
                <span>contact@duongsachtphcm.vn</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar from Figma */}
        <div className="figma-footer-bottom">
          <p>© 2026 Đường Sách TP.HCM. Bản quyền giao diện thuộc về Ban Quản Lý & AIC Lab.</p>
          <div className="footer-bottom-links">
            <a href="#">{language === 'vi' ? 'Điều khoản sử dụng' : 'Terms of Use'}</a>
            <span className="sep">•</span>
            <a href="#">{language === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy'}</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
