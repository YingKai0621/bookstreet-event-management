import { displayDateText } from '../../utils/dateDisplay';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { ArrowRight, Calendar, CheckCircle2, Clock, MapPin, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Language, ParticipantActivity } from '../../types';
import './ParticipantPages.css';

interface MyActivitiesPageProps {
  language: Language;
  activities: ParticipantActivity[];
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onCancelActivity: (activityId: string) => void | Promise<void>;
}

type RegistrationStatus = 'upcoming' | 'attended' | 'no_show' | 'cancelled';

export const MyActivitiesPage = ({
  language,
  activities,
  isLoading,
  loadError,
  onRetry,
  onCancelActivity,
}: MyActivitiesPageProps) => {
  const vi = language === 'vi';
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancellingId, setCancellingId] = useState('');
  const [actionError, setActionError] = useState('');
  const statusCandidate = searchParams.get('status');
  const activeTab: RegistrationStatus = ['upcoming', 'attended', 'no_show', 'cancelled'].includes(statusCandidate || '')
    ? statusCandidate as RegistrationStatus
    : 'upcoming';
  const searchQuery = (searchParams.get('search') || '').trim().toLocaleLowerCase(vi ? 'vi-VN' : 'en-US');

  const selectStatus = (status: RegistrationStatus) => {
    const next = new URLSearchParams(searchParams);
    if (status === 'upcoming') next.delete('status');
    else next.set('status', status);
    setSearchParams(next);
  };

  const groups: Record<RegistrationStatus, ParticipantActivity[]> = {
    upcoming: activities.filter(activity => activity.status === 'registered'),
    attended: activities.filter(activity => activity.status === 'attended'),
    no_show: activities.filter(activity => activity.status === 'no_show'),
    cancelled: activities.filter(activity => activity.status === 'cancelled'),
  };
  const displayedList = groups[activeTab].filter(activity => !searchQuery
    || activity.title.toLocaleLowerCase(vi ? 'vi-VN' : 'en-US').includes(searchQuery)
    || activity.eventName.toLocaleLowerCase(vi ? 'vi-VN' : 'en-US').includes(searchQuery));

  const cancel = async (activity: ParticipantActivity) => {
    setCancellingId(activity.id);
    setActionError('');
    try {
      await onCancelActivity(activity.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (vi ? 'Không thể hủy đăng ký hoạt động.' : 'Unable to cancel the activity registration.'));
    } finally {
      setCancellingId('');
    }
  };

  return (
    <div className="my-activities-page">
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">{vi ? 'Hoạt động của tôi' : 'My Activities'}</h1>
        <p className="participant-page-sub workspace-page-subtitle">{vi ? 'Theo dõi đăng ký, lịch tham gia và kết quả điểm danh của bạn.' : 'Track your registrations, schedule, and attendance outcomes.'}</p>
      </div>

      <div className="participant-tabs-bar participant-tabs-bar--wrap">
        <button type="button" className={`participant-tab-btn ${activeTab === 'upcoming' ? 'is-active' : ''}`} onClick={() => selectStatus('upcoming')}>{vi ? `Sắp diễn ra (${groups.upcoming.length})` : `Upcoming (${groups.upcoming.length})`}</button>
        <button type="button" className={`participant-tab-btn ${activeTab === 'attended' ? 'is-active' : ''}`} onClick={() => selectStatus('attended')}>{vi ? `Đã điểm danh (${groups.attended.length})` : `Attended (${groups.attended.length})`}</button>
        <button type="button" className={`participant-tab-btn ${activeTab === 'no_show' ? 'is-active' : ''}`} onClick={() => selectStatus('no_show')}>{vi ? `Không tham dự (${groups.no_show.length})` : `No-show (${groups.no_show.length})`}</button>
        <button type="button" className={`participant-tab-btn ${activeTab === 'cancelled' ? 'is-active' : ''}`} onClick={() => selectStatus('cancelled')}>{vi ? `Đã hủy (${groups.cancelled.length})` : `Cancelled (${groups.cancelled.length})`}</button>
      </div>

      {actionError && <p className="participant-inline-error" role="alert">{actionError}</p>}

      {isLoading ? (
        <div className="participant-data-state" role="status"><span className="participant-state-spinner" aria-hidden="true" /><strong>{vi ? 'Đang tải hoạt động của bạn' : 'Loading your activities'}</strong><p>{vi ? 'Hệ thống đang đồng bộ trạng thái đăng ký và điểm danh.' : 'Registration and attendance states are being synchronized.'}</p></div>
      ) : loadError ? (
        <div className="participant-data-state is-error" role="alert"><strong>{vi ? 'Chưa tải được hoạt động' : 'Unable to load activities'}</strong><p>{loadError}</p><button type="button" className="btn-part-secondary" onClick={onRetry}><RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}</button></div>
      ) : displayedList.length === 0 ? (
        <div className="participant-data-state"><strong>{vi ? 'Không có hoạt động trong mục này' : 'No activities in this section'}</strong><p>{vi ? 'Các đăng ký phù hợp sẽ được hiển thị tại đây.' : 'Matching registrations will appear here.'}</p><Link to="/su-kien" className="btn-part-primary">{vi ? 'Khám phá sự kiện' : 'Explore events'}<ArrowRight size={15} /></Link></div>
      ) : (
        <PaginatedList items={displayedList}>{pageItems => (
          <div className="activities-list-stack">
            {pageItems.map(activity => (
              <article key={activity.registrationId || activity.id} className="activity-row-card participant-registration-row">
                <div className="participant-activity-mark" aria-hidden="true">{activeTab === 'attended' ? <CheckCircle2 size={22} /> : activeTab === 'upcoming' ? <Calendar size={22} /> : <XCircle size={22} />}</div>
                <div className="activity-row-info">
                  <div className="activity-badge-group"><Link className="activity-tag" to={`/participant/events/${encodeURIComponent(activity.eventId)}?section=activities`}>{activity.eventName}</Link><span className="activity-tag">{activity.category}</span></div>
                  <h2 className="activity-row-title"><Link to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`}>{activity.title}</Link></h2>
                  <div className="activity-row-meta"><span><Calendar size={14} />{displayDateText(activity.date)}</span><span><Clock size={14} />{activity.time}</span><span><MapPin size={14} />{activity.venue}</span></div>
                </div>
                <div className="activity-row-actions">
                  <Link to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`} className="btn-part-secondary">{vi ? 'Chi tiết' : 'Details'}</Link>
                  {activeTab === 'upcoming' && <button type="button" className="btn-part-danger-outline" disabled={cancellingId === activity.id} onClick={() => {
                    if (window.confirm(vi ? 'Bạn có muốn hủy đăng ký hoạt động này?' : 'Cancel this activity registration?')) void cancel(activity);
                  }}><XCircle size={15} />{cancellingId === activity.id ? (vi ? 'Đang hủy...' : 'Cancelling...') : (vi ? 'Hủy' : 'Cancel')}</button>}
                  {activeTab === 'attended' && <Link to="/participant/certificates" className="btn-part-primary"><CheckCircle2 size={15} />{vi ? 'Chứng nhận' : 'Certificate'}</Link>}
                </div>
              </article>
            ))}
          </div>
        )}</PaginatedList>
      )}
    </div>
  );
};
