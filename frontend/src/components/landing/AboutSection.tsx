import React from 'react';
import { Language } from '../../types';
import './AboutSection.css';

interface AboutSectionProps {
  language: Language;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ language }) => {
  const coreValues = [
    {
      num: '01',
      titleVi: 'TRI THỨC',
      titleEn: 'KNOWLEDGE',
      descVi: 'Nơi tụ hội của tri thức Việt với hàng ngàn đầu sách chọn lọc, trưng bày trong không gian phố đi bộ rợp bóng mát xanh.',
      descEn: 'A gathering sanctuary of Vietnamese knowledge featuring curated classic and modern titles along the green promenade.',
    },
    {
      num: '02',
      titleVi: 'KẾT NỐI',
      titleEn: 'CONNECTIVITY',
      descVi: 'Giao lưu tác giả, câu lạc bộ đọc sách và cộng đồng độc giả gắn kết trong chuỗi hoạt động văn hóa thường xuyên.',
      descEn: 'Intimate author talks, book clubs, and vibrant reader communities connecting through regular cultural events.',
    },
    {
      num: '03',
      titleVi: 'DI SẢN',
      titleEn: 'HERITAGE',
      descVi: 'Gìn giữ lịch sử và bản sắc tri thức địa phương từ Đường Sách TP.HCM nguyên bản đến mạng lưới di sản văn hóa Thủ Đức.',
      descEn: 'Preserving local history and intellectual identity from the original Book Street to the dynamic heritage network.',
    },
    {
      num: '04',
      titleVi: 'CỘNG ĐỒNG',
      titleEn: 'COMMUNITY',
      descVi: 'Không gian văn hóa mở, thân thiện, bổ ích và miễn phí dành cho mọi lứa tuổi, gia đình và du khách.',
      descEn: 'An open, inclusive, free cultural haven for children, families, scholars, and international visitors.',
    },
  ];

  return (
    <section className="core-values-section" id="gioi-thieu">
      {/* Subtle Gold Divider Line Top */}
      <div className="core-values-top-gold-divider" aria-hidden="true"></div>

      {/* Real Full-Bleed Photo Background (Đường Sách TP.HCM) */}
      <div className="core-values-photo-wrap" aria-hidden="true">
        <img 
          src="/core_values_bg.jpg" 
          alt="Đường Sách TP. Hồ Chí Minh" 
          className="core-values-photo"
          loading="lazy"
        />
        <div className="core-values-overlay-haze"></div>
      </div>

      <div className="container core-values-content">
        {/* Editorial Section Header */}
        <div className="core-values-header">
          <span className="core-values-eyebrow">
            {language === 'vi' ? 'GIÁ TRỊ CỐT LÕI' : 'CORE VALUES'}
          </span>
          <h2 className="core-values-title">
            {language === 'vi' ? 'Không gian văn hóa đọc dành cho mọi người' : 'A Civic Cultural Reading Sanctuary for All'}
          </h2>
        </div>

        {/* 4 Horizontal Value Blocks with Thin Dividers */}
        <div className="core-values-grid">
          {coreValues.map((val, idx) => (
            <div key={idx} className="core-value-block">
              <span className="core-value-num">{val.num}</span>
              <h3 className="core-value-heading">
                {language === 'vi' ? val.titleVi : val.titleEn}
              </h3>
              <p className="core-value-desc">
                {language === 'vi' ? val.descVi : val.descEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

