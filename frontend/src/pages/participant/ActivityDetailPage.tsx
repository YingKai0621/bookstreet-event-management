import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  QrCode, 
  CalendarPlus, 
  UserCheck, 
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Language, ParticipantActivity } from '../../types';
import './ParticipantPages.css';

interface ActivityDetailPageProps {
  language: Language;
  activities: ParticipantActivity[];
  onRegisterActivity: (activityId: string) => void;
  onCancelActivity: (activityId: string) => void;
}

export const ActivityDetailPage: React.FC<ActivityDetailPageProps> = ({
  language,
  activities,
  onRegisterActivity,
  onCancelActivity,
}) => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();

  const activity = activities.find(a => a.id === activityId) || activities[0];

  if (!activity) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{language === 'vi' ? 'Không tìm thấy thông tin hoạt động.' : 'Activity not found.'}</p>
        <button 
          type="button" 
          className="btn-part-primary" 
          onClick={() => navigate('/participant/activities')}
        >
          {language === 'vi' ? 'Quay lại danh sách hoạt động' : 'Back to activities'}
        </button>
      </div>
    );
  }

  const isRegistered = activity.status === 'registered';
  const isAttended = activity.status === 'attended';
  const isCancelled = activity.status === 'cancelled';
  const isFull = activity.status === 'full' || activity.registeredCount >= activity.capacity;
  const seatsLeft = Math.max(0, activity.capacity - activity.registeredCount);

  const handleDownloadCalendar = () => {
    // Generate an .ics calendar file download
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Duong Sach TP.HCM//Participant//VI',
      'BEGIN:VEVENT',
      `SUMMARY:${activity.title}`,
      `DESCRIPTION:${(activity.description || '').replace(/\n/g, ' ')}`,
      `LOCATION:${activity.venue}, Đường Sách TP.HCM`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activity.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="activity-detail-page">
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

      {/* Main Container */}
      <div className="activity-detail-view">
        {/* Banner Media */}
        <div className="activity-detail-hero-media">
          <img src={activity.imageUrl || undefined} alt={activity.title} />
          <div className="event-detail-overlay"></div>
          <div style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '2rem',
            right: '2rem',
            zIndex: 2,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="activity-tag" style={{ background: 'rgba(255,255,255,0.9)', color: '#17382E' }}>
                  {activity.category}
                </span>
                <span className="activity-tag" style={{ background: 'rgba(255,255,255,0.9)', color: '#17382E' }}>
                  {activity.eventName}
                </span>
              </div>
              <h1 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.9rem',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: 0,
                lineHeight: 1.2
              }}>
                {activity.title}
              </h1>
            </div>

            {/* Status indicator pill */}
            <div>
              {isRegistered && (
                <span className="activity-capacity-badge registered" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                  ✓ {language === 'vi' ? 'Đã đăng ký thành công' : 'Registered'}
                </span>
              )}
              {isAttended && (
                <span className="activity-capacity-badge available" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                  ✓ {language === 'vi' ? 'Đã tham gia' : 'Attended'}
                </span>
              )}
              {!isRegistered && !isAttended && isFull && (
                <span className="activity-capacity-badge full" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                  {language === 'vi' ? `Hết chỗ: ${activity.capacity}/${activity.capacity}` : `Full: ${activity.capacity}/${activity.capacity}`}
                </span>
              )}
              {!isRegistered && !isAttended && !isFull && (
                <span className="activity-capacity-badge available" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                  {language === 'vi' ? `Còn chỗ: ${seatsLeft}/${activity.capacity}` : `Available: ${seatsLeft}/${activity.capacity}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="activity-detail-content">
          {/* Meta Information Bar */}
          <div className="activity-detail-meta-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} color="#B3862A" />
              <strong>{language === 'vi' ? 'Ngày:' : 'Date:'}</strong> {activity.date}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="#B3862A" />
              <strong>{language === 'vi' ? 'Thời gian:' : 'Time:'}</strong> {activity.time}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={16} color="#B3862A" />
              <strong>{language === 'vi' ? 'Địa điểm:' : 'Venue:'}</strong> {activity.venue}
            </span>
          </div>

          {/* 2-Column Grid matching Screen 4 Sketch */}
          <div className="activity-body-grid">
            {/* Left Column: Description + Speaker */}
            <div>
              <div className="detail-section-block">
                <h3>{language === 'vi' ? 'Giới thiệu hoạt động' : 'About the Activity'}</h3>
                <p>{activity.description}</p>
              </div>

              {activity.speaker && (
                <div className="detail-section-block">
                  <h3>{language === 'vi' ? 'Diễn giả / Khách mời' : 'Speaker / Host'}</h3>
                  <div className="speaker-card-mini">
                    <div className="speaker-avatar-circle">
                      {activity.speaker.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                        {activity.speaker.name}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#637771' }}>
                        {activity.speaker.title}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Important Notes matching Sketch Screen 4 */}
            <div>
              <div className="detail-notes-card">
                <h4>{language === 'vi' ? 'Lưu ý khi tham gia' : 'Important Notes'}</h4>
                <ul>
                  {activity.extraNotes && activity.extraNotes.length > 0 ? (
                    activity.extraNotes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))
                  ) : (
                    <>
                      <li>{language === 'vi' ? 'Phù hợp cho người mới bắt đầu' : 'Suitable for beginners'}</li>
                      <li>{language === 'vi' ? 'Mang theo sổ tay (nếu có)' : 'Bring a notebook if possible'}</li>
                      <li>{language === 'vi' ? 'Có chứng nhận tham gia sau khi check-in' : 'Certificate provided after check-in'}</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar matching Sketch Screen 4 */}
          <div className="activity-detail-cta-bar">
            {isRegistered ? (
              <>
                <Link
                  to={`/participant/activities/qr/${activity.id}`}
                  className="btn-part-primary"
                  style={{ height: '42px', padding: '0 1.35rem', fontSize: '0.9rem' }}
                >
                  <QrCode size={18} />
                  <span>{language === 'vi' ? 'Xem mã QR check-in' : 'View Check-in QR'}</span>
                </Link>

                <button
                  type="button"
                  className="btn-part-danger-outline"
                  style={{ height: '42px', padding: '0 1.15rem' }}
                  onClick={() => {
                    if (window.confirm(language === 'vi' ? 'Bạn có chắc muốn hủy đăng ký hoạt động này?' : 'Are you sure you want to cancel registration?')) {
                      onCancelActivity(activity.id);
                    }
                  }}
                >
                  <XCircle size={16} />
                  <span>{language === 'vi' ? 'Hủy đăng ký' : 'Cancel Registration'}</span>
                </button>

                <button
                  type="button"
                  className="btn-part-secondary"
                  style={{ height: '42px', padding: '0 1.15rem' }}
                  onClick={handleDownloadCalendar}
                >
                  <CalendarPlus size={16} />
                  <span>{language === 'vi' ? 'Thêm vào lịch' : 'Add to Calendar'}</span>
                </button>
              </>
            ) : isAttended ? (
              <>
                <Link
                  to="/participant/certificates"
                  className="btn-part-primary"
                  style={{ height: '42px', padding: '0 1.35rem' }}
                >
                  <CheckCircle2 size={18} />
                  <span>{language === 'vi' ? 'Xem chứng nhận' : 'View Certificate'}</span>
                </Link>

                <button
                  type="button"
                  className="btn-part-secondary"
                  style={{ height: '42px', padding: '0 1.15rem' }}
                  onClick={handleDownloadCalendar}
                >
                  <CalendarPlus size={16} />
                  <span>{language === 'vi' ? 'Lưu sự kiện' : 'Save Event'}</span>
                </button>
              </>
            ) : isFull ? (
              <>
                <button
                  type="button"
                  className="btn-part-primary"
                  disabled
                  style={{ height: '42px', padding: '0 1.35rem' }}
                >
                  <AlertCircle size={18} />
                  <span>{language === 'vi' ? 'Hoạt động đã hết chỗ' : 'Full Capacity'}</span>
                </button>

                <button
                  type="button"
                  className="btn-part-secondary"
                  style={{ height: '42px', padding: '0 1.15rem' }}
                  onClick={handleDownloadCalendar}
                >
                  <CalendarPlus size={16} />
                  <span>{language === 'vi' ? 'Thêm vào lịch' : 'Add to Calendar'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-part-primary"
                  style={{ height: '42px', padding: '0 1.5rem', fontSize: '0.9rem' }}
                  onClick={() => onRegisterActivity(activity.id)}
                >
                  <UserCheck size={18} />
                  <span>{language === 'vi' ? 'Đăng ký tham gia' : 'Register Now'}</span>
                </button>

                <button
                  type="button"
                  className="btn-part-secondary"
                  style={{ height: '42px', padding: '0 1.15rem' }}
                  onClick={handleDownloadCalendar}
                >
                  <CalendarPlus size={16} />
                  <span>{language === 'vi' ? 'Thêm vào lịch' : 'Add to Calendar'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

