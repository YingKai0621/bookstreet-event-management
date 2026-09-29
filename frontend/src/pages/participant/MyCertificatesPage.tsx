import React, { useState } from 'react';
import { Award, Download, Eye, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { Language, ParticipantCertificate } from '../../types';
import './ParticipantPages.css';

interface MyCertificatesPageProps {
  language: Language;
  certificates: ParticipantCertificate[];
  participantName: string;
}

export const MyCertificatesPage: React.FC<MyCertificatesPageProps> = ({
  language,
  certificates,
  participantName,
}) => {
  const [selectedCert, setSelectedCert] = useState<ParticipantCertificate | null>(null);

  const handleDownloadCertificate = (cert: ParticipantCertificate) => {
    // Generate a printable certificate HTML in a new popup or trigger print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(language === 'vi' ? 'Vui lòng cho phép popup để xem và in chứng nhận.' : 'Please allow popups to view and print certificate.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${cert.title} - ${participantName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
          body {
            margin: 0;
            padding: 40px;
            background: #f0f4f2;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: #172421;
          }
          .cert-frame {
            width: 800px;
            background: #FFFDF9;
            border: 12px double #C89D3C;
            border-radius: 8px;
            padding: 50px 60px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            position: relative;
          }
          .cert-tag {
            font-size: 13px;
            letter-spacing: 3px;
            color: #8C6519;
            font-weight: 700;
            text-transform: uppercase;
          }
          .cert-title {
            font-family: 'Playfair Display', serif;
            font-size: 34px;
            font-weight: 700;
            color: #14241F;
            margin: 15px 0 25px 0;
          }
          .cert-awarded-to {
            font-size: 15px;
            color: #556B65;
            margin-bottom: 8px;
          }
          .cert-name {
            font-family: 'Playfair Display', serif;
            font-size: 30px;
            font-weight: 700;
            color: #C84C32;
            border-bottom: 2px solid #E2EAE5;
            display: inline-block;
            padding-bottom: 6px;
            margin-bottom: 25px;
          }
          .cert-desc {
            font-size: 15px;
            color: #495D57;
            line-height: 1.6;
            max-width: 600px;
            margin: 0 auto 30px auto;
          }
          .cert-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #E2EAE5;
          }
          .sign-col {
            text-align: center;
          }
          .sign-title {
            font-size: 12px;
            color: #7B8F89;
            margin-bottom: 40px;
          }
          .sign-name {
            font-weight: 700;
            font-size: 14px;
            color: #172421;
          }
        </style>
      </head>
      <body>
        <div class="cert-frame">
          <div class="cert-tag">ĐƯỜNG SÁCH THÀNH PHỐ HỒ CHÍ MINH</div>
          <h1 class="cert-title">CHỨNG NHẬN THAM GIA</h1>
          <div class="cert-awarded-to">Chứng nhận được trao tặng cho:</div>
          <div class="cert-name">${participantName}</div>
          <div class="cert-desc">
            Đã tích cực tham gia hoạt động <strong>"${cert.activityTitle}"</strong><br/>
            trong khuôn khổ chương trình <em>${cert.eventTitle}</em>.
          </div>
          <div style="font-size: 12px; color: #8C9F9A;">Mã số xác thực: ${cert.certificateCode} • ${cert.issueDate}</div>
          <div class="cert-footer">
            <div class="sign-col">
              <div class="sign-title">BAN TỔ CHỨC ĐƯỜNG SÁCH TP.HCM</div>
              <div class="sign-name">Ban Quản Lý & Vận Hành</div>
            </div>
            <div class="sign-col">
              <div class="sign-title">ĐƠN VỊ ĐIỀU PHỐI</div>
              <div class="sign-name">Hội Đồng Văn Hóa Đọc</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="certificates-page">
      {/* 1. Header */}
      <div className="participant-page-header">
        <h1 className="participant-page-title">
          {language === 'vi' ? 'Chứng nhận của tôi' : 'My Certificates'}
        </h1>
        <p className="participant-page-sub">
          {language === 'vi' 
            ? 'Danh sách chứng chỉ tham gia hoạt động và sự kiện văn hóa tại Đường Sách TP.HCM.' 
            : 'Verified certificates earned from attended activities and cultural workshops.'}
        </p>
      </div>

      {/* 2. Certificate Rows List matching Sketch Screen 8 */}
      <div className="certificates-list-container">
        {certificates.map((cert) => (
          <div key={cert.id} className="certificate-card-row">
            {/* Mini preview frame with gold border */}
            <div className="certificate-mini-preview" title="Chứng nhận số">
              <Award size={26} />
            </div>

            {/* Certificate information */}
            <div className="certificate-info-col">
              <h3 className="certificate-title">{cert.title}</h3>
              <div className="certificate-activity-name">{cert.activityTitle}</div>
              <div className="certificate-meta-line">
                <div className="cert-meta-item">
                  <span>{cert.eventTitle}</span>
                </div>
                <div className="cert-meta-item">
                  <span>{cert.issueDate}</span>
                </div>
                <div className="cert-meta-item">
                  <span className="cert-meta-code">
                    {cert.certificateCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn-part-secondary"
                style={{ height: '36px', padding: '0 0.95rem' }}
                onClick={() => setSelectedCert(cert)}
              >
                <Eye size={15} />
                <span>{language === 'vi' ? 'Xem trước' : 'Preview'}</span>
              </button>

              <button
                type="button"
                className="btn-part-primary"
                style={{ height: '36px', padding: '0 1.1rem' }}
                onClick={() => handleDownloadCertificate(cert)}
              >
                <Download size={15} />
                <span>{language === 'vi' ? 'Tải xuống' : 'Download'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal preview when user clicks 'Xem trước' */}
      {selectedCert && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(14, 28, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#FFFDF9',
            border: '6px double #C89D3C',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '620px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setSelectedCert(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#637771'
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: '0.75rem', letterSpacing: '2px', color: '#8C6519', fontWeight: 700, marginBottom: '0.5rem' }}>
              ĐƯỜNG SÁCH THÀNH PHỐ HỒ CHÍ MINH
            </div>

            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: '#14241F', margin: '0.5rem 0 1rem 0' }}>
              {selectedCert.title}
            </h2>

            <p style={{ fontSize: '0.85rem', color: '#637771', margin: '0 0 0.25rem 0' }}>
              Trao tặng cho:
            </p>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.6rem',
              fontWeight: 700,
              color: '#C84C32',
              marginBottom: '1rem'
            }}>
              {participantName}
            </div>

            <p style={{ fontSize: '0.88rem', color: '#495D57', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Đã tích cực tham gia hoạt động <strong>"{selectedCert.activityTitle}"</strong> thuộc sự kiện <em>{selectedCert.eventTitle}</em>.
            </p>

            <div style={{
              fontSize: '0.78rem',
              color: '#7B8F89',
              padding: '0.75rem',
              background: '#F7F3EC',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              {selectedCert.issueDate} • Mã chứng nhận: <strong style={{ color: '#17382E' }}>{selectedCert.certificateCode}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                type="button"
                className="btn-part-primary"
                onClick={() => {
                  handleDownloadCertificate(selectedCert);
                }}
              >
                <Download size={15} />
                <span>{language === 'vi' ? 'In / Lưu chứng nhận' : 'Print / Save'}</span>
              </button>

              <button
                type="button"
                className="btn-part-secondary"
                onClick={() => setSelectedCert(null)}
              >
                <span>{language === 'vi' ? 'Đóng' : 'Close'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

