import { BarChart3, Download, MessageSquare, QrCode, Star, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { organizerApi } from '../../services/organizerApi';
import { Language } from '../../types';
import { OrganizerEvent } from '../../types/organizer';

interface OrganizerReportsViewProps {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
}

interface OrganizerReport {
  eventId: string;
  eventName: string;
  totalParticipants: number;
  attended: number;
  pending: number;
  cancelled: number;
  totalBooths: number;
  totalActivities: number;
  attendanceRate: number;
  averageRating: number;
  ratingCount: number;
  activityStats: Array<{ name: string; count: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
}

export const OrganizerReportsView: React.FC<OrganizerReportsViewProps> = ({
  language,
  events,
  selectedEventId,
  onSelectEventId,
}) => {
  const [loadedReport, setLoadedReport] = useState<{
    eventId: string;
    report: OrganizerReport | null;
  }>({ eventId: '', report: null });
  const report = loadedReport.eventId === selectedEventId ? loadedReport.report : null;
  const isLoading = Boolean(selectedEventId && loadedReport.eventId !== selectedEventId);

  useEffect(() => {
    if (!selectedEventId) return;
    let active = true;
    const requestedEventId = selectedEventId;
    organizerApi
      .getReport(requestedEventId)
      .then(nextReport => {
        if (active) setLoadedReport({ eventId: requestedEventId, report: nextReport });
      })
      .catch(() => {
        if (active) setLoadedReport({ eventId: requestedEventId, report: null });
      });
    return () => { active = false; };
  }, [selectedEventId]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Sự kiện', report.eventName],
      ['Tổng lượt đăng ký', report.totalParticipants],
      ['Đã tham gia', report.attended],
      ['Chưa tham gia', report.pending],
      ['Đã hủy', report.cancelled],
      ['Gian hàng', report.totalBooths],
      ['Hoạt động', report.totalActivities],
      ['Tỷ lệ tham dự', `${report.attendanceRate}%`],
      ['Đánh giá trung bình', report.averageRating],
      [],
      ['Hoạt động', 'Lượt đăng ký'],
      ...report.activityStats.map(item => [item.name, item.count]),
    ];
    const csv =
      '\uFEFF' +
      rows
        .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bao-cao-${report.eventId || 'su-kien'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="organizer-content">
      {/* 1. Top Header & Event Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.75rem' }}>
        <div>
          <h1 className="organizer-view-title workspace-page-title">
            {language === 'vi' ? 'Báo cáo sự kiện' : 'Event Reports'}
          </h1>
          <p className="organizer-view-sub workspace-page-subtitle">
            {language === 'vi'
              ? 'Số liệu được tổng hợp trực tiếp từ đăng ký, điểm danh và đánh giá.'
              : 'Live registration, attendance and rating data.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {events.length > 0 && (
            <select
              value={selectedEventId}
              onChange={event => onSelectEventId(event.target.value)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid #D5DFDC',
                backgroundColor: '#FFFFFF',
                color: '#172421',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn-org-secondary"
            onClick={exportCsv}
            disabled={!report || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: (!report || isLoading) ? 'not-allowed' : 'pointer',
              opacity: (!report || isLoading) ? 0.6 : 1
            }}
          >
            <Download size={15} />
            <span>{language === 'vi' ? 'Xuất CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* 2. Loading Skeleton State */}
      {isLoading ? (
        <div>
          <div className="org-metric-grid" style={{ marginBottom: '1.5rem' }}>
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="org-metric-card skeleton-card" style={{ padding: '1.25rem' }}>
                <div className="skeleton-box" style={{ width: '60%', height: '0.85rem', borderRadius: 4, marginBottom: '0.6rem' }} />
                <div className="skeleton-box" style={{ width: '40%', height: '2rem', borderRadius: 4, marginBottom: '0.5rem' }} />
                <div className="skeleton-box" style={{ width: '70%', height: '0.75rem', borderRadius: 4 }} />
              </div>
            ))}
          </div>
          <div className="organizer-card skeleton-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div className="skeleton-box" style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 1rem' }} />
            <div className="skeleton-box" style={{ width: '40%', height: '1.25rem', borderRadius: 4, margin: '0 auto 0.75rem' }} />
            <div className="skeleton-box" style={{ width: '60%', height: '0.9rem', borderRadius: 4, margin: '0 auto' }} />
          </div>
        </div>
      ) : report ? (
        /* 3. Real Report Data */
        <>
          <div className="org-metric-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="org-metric-card">
              <p>{language === 'vi' ? 'Tổng lượt đăng ký' : 'Total Registrations'}</p>
              <strong>{report.totalParticipants}</strong>
              <span>{report.attended} {language === 'vi' ? 'đã tham gia' : 'attended'}</span>
            </div>

            <div className="org-metric-card gold">
              <p>{language === 'vi' ? 'Gian hàng' : 'Booths'}</p>
              <strong>{report.totalBooths}</strong>
              <span>{language === 'vi' ? 'Phân bổ đang hoạt động' : 'Active allocations'}</span>
            </div>

            <div className="org-metric-card">
              <p>{language === 'vi' ? 'Hoạt động' : 'Activities'}</p>
              <strong>{report.totalActivities}</strong>
              <span>{report.attendanceRate}% {language === 'vi' ? 'tỷ lệ tham dự' : 'attendance rate'}</span>
            </div>

            <div className="org-metric-card blue">
              <p>{language === 'vi' ? 'Đánh giá trung bình' : 'Average Rating'}</p>
              <strong>{report.averageRating ? report.averageRating.toFixed(1) : '—'}</strong>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Star size={13} fill="#E9BC63" color="#E9BC63" />
                {report.ratingCount} {language === 'vi' ? 'đánh giá' : 'reviews'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <section className="organizer-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                {language === 'vi' ? 'Trạng thái tham gia' : 'Attendance Breakdown'}
              </h2>
              <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #EEF2F0' }}>
                  <span style={{ color: '#267A58', fontWeight: 600 }}>{language === 'vi' ? 'Đã tham gia:' : 'Attended:'}</span>
                  <strong>{report.attended}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #EEF2F0' }}>
                  <span style={{ color: '#8C6519', fontWeight: 600 }}>{language === 'vi' ? 'Chưa tham gia:' : 'Pending:'}</span>
                  <strong>{report.pending}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <span style={{ color: '#C84C32', fontWeight: 600 }}>{language === 'vi' ? 'Đã hủy:' : 'Cancelled:'}</span>
                  <strong>{report.cancelled}</strong>
                </div>
              </div>
            </section>

            <section className="organizer-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                {language === 'vi' ? 'Lượt đăng ký theo hoạt động' : 'Registrations by Activity'}
              </h2>
              {report.activityStats.length === 0 ? (
                <p style={{ color: '#7A8E87', margin: 0, fontSize: '0.88rem' }}>
                  {language === 'vi' ? 'Chưa có hoạt động nào.' : 'No activities recorded.'}
                </p>
              ) : (
                report.activityStats.map(item => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid #EEF2F0', fontSize: '0.88rem' }}>
                    <span style={{ color: '#334943' }}>{item.name}</span>
                    <strong style={{ color: '#172421' }}>{item.count} {language === 'vi' ? 'lượt' : 'regs'}</strong>
                  </div>
                ))
              )}
            </section>

            <section className="organizer-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                {language === 'vi' ? 'Phân bố đánh giá' : 'Rating Distribution'}
              </h2>
              {report.ratingDistribution.length === 0 ? (
                <p style={{ color: '#7A8E87', margin: 0, fontSize: '0.88rem' }}>
                  {language === 'vi' ? 'Chưa có đánh giá nào.' : 'No ratings received yet.'}
                </p>
              ) : (
                report.ratingDistribution.map(item => (
                  <div key={item.stars} style={{ display: 'flex', justifyContent: 'space-between', padding: '.45rem 0', fontSize: '0.88rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#495D57' }}>
                      <Star size={13} fill="#E9BC63" color="#E9BC63" />
                      {item.stars} {language === 'vi' ? 'sao' : 'stars'}
                    </span>
                    <strong style={{ color: '#172421' }}>{item.count}</strong>
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      ) : (
        /* 4. Elegant Waiting / Empty State when No Report Data Yet */
        <div>
          {/* 4 Default Metric Cards */}
          <div className="org-metric-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="org-metric-card">
              <p>{language === 'vi' ? 'Tổng lượt đăng ký' : 'Total Registrations'}</p>
              <strong>0</strong>
              <span>{language === 'vi' ? 'Chờ dữ liệu điểm danh' : 'Awaiting check-in data'}</span>
            </div>

            <div className="org-metric-card gold">
              <p>{language === 'vi' ? 'Gian hàng' : 'Booths'}</p>
              <strong>0</strong>
              <span>{language === 'vi' ? 'Chờ phân bổ vị trí' : 'Awaiting allocation'}</span>
            </div>

            <div className="org-metric-card">
              <p>{language === 'vi' ? 'Hoạt động' : 'Activities'}</p>
              <strong>0</strong>
              <span>{language === 'vi' ? 'Chờ duyệt chương trình' : 'Awaiting proposals'}</span>
            </div>

            <div className="org-metric-card blue">
              <p>{language === 'vi' ? 'Đánh giá trung bình' : 'Average Rating'}</p>
              <strong>—</strong>
              <span>{language === 'vi' ? '0 lượt đánh giá' : '0 reviews'}</span>
            </div>
          </div>

          {/* Structured Waiting Card */}
          <div
            className="organizer-card"
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              background: '#FAF8F5',
              border: '1px solid #EAE5DC',
              marginBottom: '1.5rem'
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(212, 163, 89, 0.14)',
                border: '2px dashed #D4A359',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 1.25rem',
                color: '#B3862A'
              }}
            >
              <BarChart3 size={36} />
            </div>

            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '1.5px',
                color: '#8C6519',
                textTransform: 'uppercase',
                marginBottom: '0.4rem'
              }}
            >
              {language === 'vi' ? 'TRẠNG THÁI BÁO CÁO' : 'REPORT STATUS'}
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.45rem',
                color: '#172421',
                margin: '0 0 0.5rem 0'
              }}
            >
              {language === 'vi'
                ? `Chưa có dữ liệu thống kê cho "${selectedEvent?.title || 'Sự kiện'}"`
                : `No report data recorded for "${selectedEvent?.title || 'Event'}"`}
            </h2>

            <p
              style={{
                fontSize: '0.92rem',
                color: '#556B65',
                maxWidth: '620px',
                margin: '0 auto 2.25rem',
                lineHeight: 1.6
              }}
            >
              {language === 'vi'
                ? 'Số liệu về lượt đăng ký tham gia, điểm danh check-in tại các gian hàng & sân khấu, cùng các phản hồi đánh giá của bạn đọc sẽ được hệ thống tự động tổng hợp theo thời gian thực khi sự kiện diễn ra.'
                : 'Participant registrations, on-site check-in attendance at booths and stages, along with reader survey feedback, will be aggregated in real-time once the event is underway.'}
            </p>

            {/* 3 Capabilities Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
                textAlign: 'left',
                maxWidth: '820px',
                margin: '0 auto'
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2EAE5',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  boxShadow: '0 2px 6px rgba(24, 41, 36, 0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#17382E', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                  <TrendingUp size={16} color="#B3862A" />
                  <span>{language === 'vi' ? 'Tổng hợp tức thì' : 'Real-time Metrics'}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#637771', lineHeight: 1.48 }}>
                  {language === 'vi'
                    ? 'Tự động tính toán tỷ lệ tham gia, hoạt động thu hút nhất và số lượng độc giả.'
                    : 'Automatically calculates attendance rates and most engaging activities.'}
                </p>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2EAE5',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  boxShadow: '0 2px 6px rgba(24, 41, 36, 0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#17382E', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                  <QrCode size={16} color="#10B981" />
                  <span>{language === 'vi' ? 'Điểm danh QR' : 'QR Check-in'}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#637771', lineHeight: 1.48 }}>
                  {language === 'vi'
                    ? 'Ghi nhận lưu lượng bạn đọc đến từng gian hàng và sân khấu sự kiện chính xác.'
                    : 'Accurately records attendee presence at each booth and stage location.'}
                </p>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2EAE5',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  boxShadow: '0 2px 6px rgba(24, 41, 36, 0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#17382E', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                  <MessageSquare size={16} color="#0284C7" />
                  <span>{language === 'vi' ? 'Khảo sát ý kiến' : 'Reader Feedback'}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#637771', lineHeight: 1.48 }}>
                  {language === 'vi'
                    ? 'Đo lường mức độ hài lòng của độc giả và xuất báo cáo CSV phục vụ lưu trữ.'
                    : 'Measures attendee satisfaction ratings and enables CSV report export.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
