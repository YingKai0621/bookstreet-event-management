import { displayDateText } from '../../utils/dateDisplay';
import { ArrowLeft, Award, Calendar, CheckCircle2, Clock, MapPin, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Language, ParticipantActivity } from '../../types';
import './ParticipantPages.css';

interface ActivityDetailPageProps {
  language: Language;
  activities: ParticipantActivity[];
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onCancelActivity: (activityId: string) => void | Promise<void>;
}

const ACTIVITY_STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  DRAFT: { vi: 'Đang chuẩn bị', en: 'In preparation' },
  PUBLISHED: { vi: 'Sắp diễn ra', en: 'Upcoming' },
  ONGOING: { vi: 'Đang diễn ra', en: 'In progress' },
  COMPLETED: { vi: 'Đã kết thúc', en: 'Ended' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
};

function activityStatusLabel(status: string | undefined, language: Language): string {
  if (!status) return '—';
  return ACTIVITY_STATUS_LABELS[status]?.[language === 'vi' ? 'vi' : 'en'] ?? '—';
}

function formatRegisteredAt(value: string | undefined, language: Language): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export const ActivityDetailPage = ({
  language,
  activities,
  isLoading,
  loadError,
  onRetry,
  onCancelActivity,
}: ActivityDetailPageProps) => {
  const vi = language === 'vi';
  const { activityId } = useParams<{ activityId: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  if (isLoading) {
    return (
      <div className="participant-data-state participant-detail-state" role="status">
        <span className="participant-state-spinner" aria-hidden="true" />
        <strong>{vi ? 'Đang tải đăng ký hoạt động' : 'Loading activity registration'}</strong>
        <p>{vi ? 'Hệ thống đang kiểm tra trạng thái đăng ký và điểm danh.' : 'The registration and attendance state is being checked.'}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="participant-data-state participant-detail-state is-error" role="alert">
        <strong>{vi ? 'Chưa tải được hoạt động' : 'Unable to load activity'}</strong>
        <p>{loadError}</p>
        <button type="button" className="btn-part-secondary" onClick={onRetry}><RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}</button>
      </div>
    );
  }

  const activity = activities.find(item => item.id === activityId);
  if (!activity) {
    return (
      <div className="participant-data-state participant-detail-state">
        <strong>{vi ? 'Không tìm thấy đăng ký hoạt động' : 'Activity registration not found'}</strong>
        <p>{vi ? 'Hoạt động không thuộc tài khoản hiện tại hoặc đường dẫn không còn hợp lệ.' : 'This activity does not belong to the current account or the link is no longer valid.'}</p>
        <Link className="btn-part-secondary" to="/participant/activities"><ArrowLeft size={16} />{vi ? 'Về hoạt động của tôi' : 'Back to my activities'}</Link>
      </div>
    );
  }

  const status = activity.status === 'attended'
    ? { label: vi ? 'Đã điểm danh' : 'Attended', tone: 'attended', icon: CheckCircle2 }
    : activity.status === 'cancelled'
      ? { label: vi ? 'Đã hủy đăng ký' : 'Cancelled', tone: 'cancelled', icon: XCircle }
      : activity.status === 'no_show'
        ? { label: vi ? 'Không tham dự' : 'No-show', tone: 'no-show', icon: XCircle }
        : { label: vi ? 'Đăng ký còn hiệu lực' : 'Active registration', tone: 'registered', icon: Calendar };
  const StatusIcon = status.icon;

  const cancelRegistration = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      await onCancelActivity(activity.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (vi ? 'Không thể hủy đăng ký hoạt động.' : 'Unable to cancel the activity registration.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="participant-activity-detail-page">
      <div className="participant-detail-breadcrumbs">
        <Link className="btn-part-secondary" to={`/participant/events/${encodeURIComponent(activity.eventId)}?section=activities`}><ArrowLeft size={15} />{activity.eventName}</Link>
        <Link to="/participant/activities">{vi ? 'Tất cả hoạt động của tôi' : 'All my activities'}</Link>
      </div>

      <article className="participant-registration-detail">
        <header>
          <div>
            <span className="participant-detail-eyebrow">{activity.category}</span>
            <h1>{activity.title}</h1>
            <p>{activity.eventName}</p>
          </div>
          <span className={`participant-activity-status is-${status.tone}`}><StatusIcon size={16} />{status.label}</span>
        </header>

        <dl className="participant-registration-facts">
          <div><dt><Calendar size={17} />{vi ? 'Ngày' : 'Date'}</dt><dd>{displayDateText(activity.date)}</dd></div>
          <div><dt><Clock size={17} />{vi ? 'Thời gian' : 'Time'}</dt><dd>{activity.time}</dd></div>
          <div><dt><MapPin size={17} />{vi ? 'Địa điểm' : 'Venue'}</dt><dd>{activity.venue || '—'}</dd></div>
          <div><dt>{vi ? 'Đăng ký lúc' : 'Registered at'}</dt><dd>{formatRegisteredAt(activity.registeredAt, language)}</dd></div>
          <div><dt>{vi ? 'Trạng thái hoạt động' : 'Activity status'}</dt><dd>{activityStatusLabel(activity.activityStatus, language)}</dd></div>
          <div><dt>{vi ? 'Kết quả điểm danh' : 'Attendance outcome'}</dt><dd>{activity.attendanceStatus === 'VALID' || activity.status === 'attended' ? (vi ? 'Đã ghi nhận hợp lệ' : 'Valid attendance recorded') : (vi ? 'Chưa có điểm danh hợp lệ' : 'No valid attendance recorded')}</dd></div>
        </dl>

        {activity.status === 'registered' && (
          <div className="participant-attendance-guidance">
            <div><strong>{vi ? 'Cách điểm danh' : 'How to check in'}</strong><p>{vi ? 'Khi đến địa điểm, hãy quét mã QR của hoạt động do Ban tổ chức hiển thị. Tài khoản này phải còn đăng ký hợp lệ.' : 'At the venue, scan the Activity QR displayed by the Organizer. This account must still have an active registration.'}</p></div>
          </div>
        )}

        {activity.status === 'attended' && (
          <div className="participant-attendance-guidance is-success">
            <CheckCircle2 size={22} />
            <div><strong>{vi ? 'Điểm danh đã được ghi nhận' : 'Attendance recorded'}</strong><p>{vi ? 'Sau khi hoạt động hoàn tất và đủ điều kiện, chứng nhận sẽ xuất hiện trong mục Chứng nhận.' : 'After the activity is completed and eligibility is confirmed, the certificate will appear in Certificates.'}</p></div>
          </div>
        )}

        {actionError && <p className="participant-inline-error" role="alert">{actionError}</p>}

        <footer>
          {activity.status === 'registered' && (
            <button type="button" className="btn-part-danger-outline" disabled={submitting} onClick={() => {
              if (window.confirm(vi ? 'Bạn có chắc muốn hủy đăng ký hoạt động này?' : 'Are you sure you want to cancel this activity registration?')) void cancelRegistration();
            }}><XCircle size={16} />{submitting ? (vi ? 'Đang hủy...' : 'Cancelling...') : (vi ? 'Hủy đăng ký' : 'Cancel registration')}</button>
          )}
          {activity.status === 'attended' && <Link className="btn-part-primary" to="/participant/certificates"><Award size={17} />{vi ? 'Xem chứng nhận' : 'View certificates'}</Link>}
        </footer>
      </article>
    </div>
  );
};
