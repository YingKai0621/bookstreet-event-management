import React, { useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Download, CheckCircle, Calendar, Clock, MapPin } from 'lucide-react';
import { Language, ParticipantActivity } from '../../types';
import './ParticipantPages.css';

interface ActivityQrPageProps {
  language: Language;
  activities: ParticipantActivity[];
}

export const ActivityQrPage: React.FC<ActivityQrPageProps> = ({
  language,
  activities,
}) => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const qrRef = useRef<HTMLDivElement>(null);

  const activity = activities.find(a => a.id === activityId);
  const qrValue = activity?.qrCodeValue;

  if (!activity || activity.status !== 'registered' || !qrValue) {
    return (
      <div className="app-loading-state">
        <p>{language === 'vi' ? 'Không tìm thấy mã QR hợp lệ cho đăng ký này.' : 'No valid QR code was found for this registration.'}</p>
        <Link to="/participant/activities" className="btn-part-secondary">{language === 'vi' ? 'Về hoạt động của tôi' : 'Back to my activities'}</Link>
      </div>
    );
  }

  const handleDownloadQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 50, 50, 300, 300);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `QR-${activity?.registrationCode || 'CheckIn'}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="activity-qr-page">
      {/* Back button */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          className="btn-part-secondary"
          onClick={() => navigate(-1)}
          style={{ gap: '0.4rem', padding: '0.35rem 0.85rem', height: '34px' }}
        >
          <ArrowLeft size={14} />
          <span>{language === 'vi' ? 'Quay lại' : 'Back'}</span>
        </button>
      </div>

      {/* Screen 6 Sketch Card */}
      <div className="qr-screen-card">
        <div className="qr-eyebrow">
          {language === 'vi' ? 'Mã Check-in Hoạt Động' : 'Activity Check-in Pass'}
        </div>

        <h1 className="qr-activity-name">{activity?.title}</h1>
        <p className="qr-event-name">{activity?.eventName}</p>

        {/* Schedule & Location summary */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          fontSize: '0.8rem',
          color: '#556B65',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <span>📅 {activity?.date}</span>
          <span>⏰ {activity?.time}</span>
          <span>📍 {activity?.venue}</span>
        </div>

        {/* QR Canvas Box */}
        <div className="qr-canvas-wrapper" ref={qrRef}>
          <QRCodeSVG 
            value={qrValue}
            size={180}
            bgColor="#FFFFFF"
            fgColor="#17382E"
            level="H"
          />
        </div>

        <div className="qr-code-text">
          {language === 'vi' ? 'MÃ: ' : 'CODE: '}
          <span style={{ color: '#B3862A' }}>{activity.registrationCode}</span>
        </div>

        <p className="qr-instruction-note">
          {language === 'vi'
            ? 'Vui lòng xuất trình mã QR này tại quầy tiếp đón hoặc điểm check-in trước giờ bắt đầu hoạt động 10–15 phút.'
            : 'Please present this QR code at the check-in desk 10–15 minutes prior to the start time.'}
        </p>

        {/* Actions matching Sketch Screen 6 */}
        <div className="qr-actions-row">
          <button
            type="button"
            className="btn-part-primary"
            style={{ width: '100%', height: '42px' }}
            onClick={handleDownloadQr}
          >
            <Download size={16} />
            <span>{language === 'vi' ? 'Tải QR về máy' : 'Download QR Image'}</span>
          </button>

          <Link
            to="/participant/activities"
            className="btn-part-secondary"
            style={{ width: '100%', height: '40px' }}
          >
            <span>{language === 'vi' ? 'Về danh sách hoạt động' : 'Back to My Activities'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

