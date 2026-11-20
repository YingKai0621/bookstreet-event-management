import { displayDateText } from '../../utils/dateDisplay';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { SearchFieldLabel } from '../../components/ui/SearchFieldLabel';
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { publicApi, type PublicActivity } from '../../services/publicApi';
import { useParticipationRefresh } from '../../hooks/useParticipationRefresh';
import { LeaveEventDialog } from '../../components/participant/LeaveEventDialog';
import type { Language, ParticipantActivity, ParticipantEvent } from '../../types';
import './ParticipantPages.css';

interface EventDetailPageProps {
  language: Language;
  events: ParticipantEvent[];
  activities: ParticipantActivity[];
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onRegisterActivity: (activityId: string) => void | Promise<void>;
  onCancelActivity: (activityId: string) => void | Promise<void>;
  onLeaveEvent: (eventId: string) => void | Promise<void>;
}

type EventSection = 'overview' | 'discover' | 'activities';

function formatActivitySchedule(activity: PublicActivity, language: Language) {
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB';
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(activity.startAt));
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return { date, time: `${time.format(new Date(activity.startAt))} – ${time.format(new Date(activity.endAt))}` };
}

function activityStatus(activity: ParticipantActivity, vi: boolean) {
  if (activity.status === 'attended') return { label: vi ? 'Đã điểm danh' : 'Attended', tone: 'attended', icon: CheckCircle2 };
  if (activity.status === 'cancelled') return { label: vi ? 'Đã hủy đăng ký' : 'Cancelled', tone: 'cancelled', icon: XCircle };
  if (activity.status === 'no_show') return { label: vi ? 'Không tham dự' : 'No-show', tone: 'no-show', icon: XCircle };
  return { label: vi ? 'Đã đăng ký' : 'Registered', tone: 'registered', icon: Calendar };
}

export const EventDetailPage = ({
  language,
  events,
  activities,
  isLoading,
  loadError,
  onRetry,
  onRegisterActivity,
  onCancelActivity,
  onLeaveEvent,
}: EventDetailPageProps) => {
  const vi = language === 'vi';
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancellingId, setCancellingId] = useState('');
  const [registeringId, setRegisteringId] = useState('');
  const [actionError, setActionError] = useState('');
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [catalogActivities, setCatalogActivities] = useState<PublicActivity[]>([]);
  const [catalogEventId, setCatalogEventId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const participationRefresh = useParticipationRefresh();
  const requestedSection = searchParams.get('section');
  const section: EventSection = requestedSection === 'discover' || requestedSection === 'activities'
    ? requestedSection
    : 'overview';
  const search = (searchParams.get('search') || '').trim().toLocaleLowerCase(vi ? 'vi-VN' : 'en-US');
  const currentEvent = events.find(event => event.id === eventId);
  const currentEventId = currentEvent?.id || '';

  useEffect(() => {
    if (isLoading || loadError || !currentEventId) return;
    let active = true;
    // This effect synchronizes route-scoped catalog state from the public Activity API.
    // oxlint-disable-next-line react/set-state-in-effect
    setCatalogLoading(true);
    setCatalogError('');
    publicApi.getActivities(currentEventId)
      .then(rows => {
        if (!active) return;
        setCatalogActivities(rows);
        setCatalogEventId(currentEventId);
      })
      .catch(error => {
        if (!active) return;
        setCatalogActivities([]);
        setCatalogEventId(currentEventId);
        setCatalogError(error instanceof Error ? error.message : 'Không thể tải hoạt động của sự kiện.');
      })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [catalogRevision, participationRefresh, currentEventId, isLoading, loadError]);

  const setSection = (nextSection: EventSection) => {
    const next = new URLSearchParams(searchParams);
    if (nextSection === 'overview') next.delete('section');
    else next.set('section', nextSection);
    if (nextSection !== 'activities') next.delete('search');
    setSearchParams(next);
  };

  if (isLoading) {
    return (
      <div className="participant-data-state participant-detail-state" role="status">
        <span className="participant-state-spinner" aria-hidden="true" />
        <strong>{vi ? 'Đang tải chi tiết sự kiện' : 'Loading event details'}</strong>
        <p>{vi ? 'Danh sách hoạt động đã đăng ký đang được đồng bộ.' : 'Your registered activities are being synchronized.'}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="participant-data-state participant-detail-state is-error" role="alert">
        <strong>{vi ? 'Chưa tải được chi tiết sự kiện' : 'Unable to load event details'}</strong>
        <p>{loadError}</p>
        <button type="button" className="btn-part-secondary" onClick={onRetry}><RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}</button>
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="participant-data-state participant-detail-state">
        <strong>{vi ? 'Không tìm thấy sự kiện trong đăng ký của bạn' : 'Event not found in your registrations'}</strong>
        <p>{vi ? 'Sự kiện có thể đã được rời hoặc đường dẫn không còn hợp lệ.' : 'You may have left this event or the link is no longer valid.'}</p>
        <Link className="btn-part-secondary" to="/participant/events"><ArrowLeft size={16} />{vi ? 'Về sự kiện của tôi' : 'Back to my events'}</Link>
      </div>
    );
  }

  const eventActivities = activities.filter(activity => activity.eventId === currentEvent.id);
  const registeredActivityIds = new Set(eventActivities
    .filter(activity => activity.status !== 'cancelled')
    .map(activity => activity.id));
  const activeRegistrations = eventActivities.filter(activity => activity.status === 'registered').length;
  const attended = eventActivities.filter(activity => activity.status === 'attended').length;
  const filteredActivities = eventActivities.filter(activity => !search
    || activity.title.toLocaleLowerCase(vi ? 'vi-VN' : 'en-US').includes(search)
    || activity.venue.toLocaleLowerCase(vi ? 'vi-VN' : 'en-US').includes(search));
  const eventCatalog = catalogEventId === currentEvent.id ? catalogActivities : [];
  const filteredCatalog = eventCatalog.filter(activity => !search
    || activity.title.toLocaleLowerCase(vi ? 'vi-VN' : 'en-US').includes(search)
    || activity.location.toLocaleLowerCase(vi ? 'vi-VN' : 'en-US').includes(search));

  const cancelActivity = async (activity: ParticipantActivity) => {
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

  const registerActivity = async (activity: PublicActivity) => {
    setRegisteringId(activity.id);
    setActionError('');
    try {
      await onRegisterActivity(activity.id);
      setCatalogRevision(value => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (vi ? 'Không thể đăng ký hoạt động.' : 'Unable to register for the activity.'));
    } finally {
      setRegisteringId('');
    }
  };

  return (
    <div className="event-detail-for-participant">
      {leaveDialogOpen && <LeaveEventDialog eventName={currentEvent.title} language={language} onClose={() => setLeaveDialogOpen(false)} onConfirm={() => onLeaveEvent(currentEvent.id)} />}
      <button type="button" className="btn-part-secondary participant-back-button" onClick={() => navigate('/participant/events')}>
        <ArrowLeft size={15} />{vi ? 'Sự kiện của tôi' : 'My events'}
      </button>

      <section className="participant-event-summary" aria-labelledby="participant-event-title">
        <div className="participant-event-summary-main">
          <span className={`participant-registration-pill ${currentEvent.status}`}>{currentEvent.status === 'ended' ? (vi ? 'Đã kết thúc' : 'Ended') : (vi ? 'Đang tham gia' : 'Joined')}</span>
          <h1 id="participant-event-title">{currentEvent.title}</h1>
          <div className="participant-event-summary-meta">
            <span><Calendar size={17} />{displayDateText(currentEvent.dateRange)}</span>
            <span><MapPin size={17} />{currentEvent.location}</span>
          </div>
        </div>
        <div className="participant-event-summary-counts" aria-label={vi ? 'Tình trạng hoạt động' : 'Activity registration summary'}>
          <div><strong>{eventActivities.length}</strong><span>{vi ? 'Tổng đăng ký' : 'Registrations'}</span></div>
          <div><strong>{activeRegistrations}</strong><span>{vi ? 'Còn hiệu lực' : 'Active'}</span></div>
          <div><strong>{attended}</strong><span>{vi ? 'Đã điểm danh' : 'Attended'}</span></div>
        </div>
      </section>

      <div className="participant-tabs-bar participant-tabs-bar--wrap">
        <button type="button" className={`participant-tab-btn ${section === 'overview' ? 'is-active' : ''}`} onClick={() => setSection('overview')}>{vi ? 'Tổng quan' : 'Overview'}</button>
        <button type="button" className={`participant-tab-btn ${section === 'discover' ? 'is-active' : ''}`} onClick={() => setSection('discover')}>
          {vi ? `Hoạt động sự kiện (${eventCatalog.length})` : `Event activities (${eventCatalog.length})`}
        </button>
        <button type="button" className={`participant-tab-btn ${section === 'activities' ? 'is-active' : ''}`} onClick={() => setSection('activities')}>
          {vi ? `Đã đăng ký (${eventActivities.length})` : `Registered (${eventActivities.length})`}
        </button>
      </div>

      {section === 'overview' ? (
        <section className="participant-event-overview-card">
          <div>
            <h2>{vi ? 'Đăng ký của bạn' : 'Your registration'}</h2>
            <p>{vi
              ? 'Mỗi hoạt động được quản lý riêng. Bạn chỉ có thể điểm danh hoạt động còn đăng ký hợp lệ bằng mã QR do Ban tổ chức hiển thị tại địa điểm diễn ra.'
              : 'Each activity is managed separately. You can check in only to an active registration using the QR displayed by the Organizer at the venue.'}</p>
          </div>
          <button type="button" className="btn-part-primary" onClick={() => setSection('discover')}>
            {vi ? 'Xem hoạt động sự kiện' : 'Explore event activities'}
          </button>
          {currentEvent.isJoined && currentEvent.canLeave && (
            <button type="button" className="btn-part-danger-outline" onClick={() => setLeaveDialogOpen(true)}>{vi ? 'Rời sự kiện' : 'Leave event'}</button>
          )}
        </section>
      ) : section === 'discover' ? (
        <section className="event-activities-tab-content" aria-labelledby="event-activities-title">
          <div className="participant-section-heading participant-section-heading--actions">
            <div>
              <h2 id="event-activities-title" className="section-heading-title">{vi ? 'Hoạt động đã công bố' : 'Published activities'}</h2>
              <p>{vi ? 'Xem lịch, địa điểm và đăng ký những hoạt động còn mở.' : 'Review schedules and register for activities that are still open.'}</p>
            </div>
            {eventCatalog.length > 0 && (
              <SearchFieldLabel className="participant-activity-search"><label className="part-search-input">
                <Search size={17} className="icon" aria-hidden="true" />
                <input aria-label={vi ? 'Tìm hoạt động' : 'Search activities'} type="search" value={searchParams.get('search') || ''} onChange={event => {
                  const next = new URLSearchParams(searchParams);
                  if (event.target.value) next.set('search', event.target.value);
                  else next.delete('search');
                  setSearchParams(next, { replace: true });
                }} placeholder={vi ? 'Tìm theo tên, địa điểm...' : 'Search name or venue...'} />
              </label></SearchFieldLabel>
            )}
          </div>

          {actionError && <p className="participant-inline-error" role="alert">{actionError}</p>}
          {catalogLoading || catalogEventId !== currentEvent.id ? (
            <div className="participant-data-state compact" role="status"><span className="participant-state-spinner" aria-hidden="true" /><strong>{vi ? 'Đang tải hoạt động sự kiện' : 'Loading event activities'}</strong></div>
          ) : catalogError ? (
            <div className="participant-data-state compact is-error" role="alert"><strong>{vi ? 'Chưa tải được hoạt động sự kiện' : 'Unable to load event activities'}</strong><p>{catalogError}</p><button type="button" className="btn-part-secondary" onClick={() => setCatalogRevision(value => value + 1)}><RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}</button></div>
          ) : eventCatalog.length === 0 ? (
            <div className="participant-data-state compact"><strong>{vi ? 'Sự kiện chưa có hoạt động công khai' : 'No public activities yet'}</strong><p>{vi ? 'Hoạt động sẽ xuất hiện tại đây sau khi Ban tổ chức công bố.' : 'Activities will appear here after the Organizer publishes them.'}</p></div>
          ) : filteredCatalog.length === 0 ? (
            <div className="participant-data-state compact"><strong>{vi ? 'Không tìm thấy hoạt động phù hợp' : 'No matching activities'}</strong><p>{vi ? 'Hãy thử một từ khóa khác.' : 'Try another search term.'}</p></div>
          ) : (
            <PaginatedList items={filteredCatalog}>{pageItems => (
              <div className="activities-list-stack">
                {pageItems.map(activity => {
                  const schedule = formatActivitySchedule(activity, language);
                  const isRegistered = registeredActivityIds.has(activity.id);
                  return (
                    <article className="activity-row-card participant-registration-row participant-catalog-row" key={activity.id}>
                      <div className="participant-activity-mark" aria-hidden="true"><Calendar size={22} /></div>
                      <div className="activity-row-info">
                        <div className="activity-badge-group">
                          <span className="activity-tag">{activity.kind}</span>
                          {isRegistered && <span className="participant-activity-status is-registered"><CheckCircle2 size={13} />{vi ? 'Đã đăng ký' : 'Registered'}</span>}
                        </div>
                        <h3 className="activity-row-title">{activity.title}</h3>
                        {activity.description && <p className="participant-catalog-description">{activity.description}</p>}
                        <div className="activity-row-meta"><span><Calendar size={14} />{schedule.date}</span><span><Clock size={14} />{schedule.time}</span><span><MapPin size={14} />{activity.location || '—'}</span>{activity.registrationRequired && <span><Users size={14} />{activity.availableSeats ?? 0}/{activity.capacity} {vi ? 'chỗ còn lại' : 'seats left'}</span>}</div>
                      </div>
                      <div className="activity-row-actions">
                        {isRegistered ? (
                          <Link className="btn-part-secondary" to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`}>{vi ? 'Xem đăng ký' : 'View registration'}</Link>
                        ) : !activity.registrationRequired ? (
                          <span className="participant-catalog-note">{vi ? 'Không cần đăng ký' : 'No registration required'}</span>
                        ) : activity.registrationOpen ? (
                          <button type="button" className="btn-part-primary" disabled={registeringId === activity.id} onClick={() => void registerActivity(activity)}>{registeringId === activity.id ? (vi ? 'Đang đăng ký...' : 'Registering...') : (vi ? 'Đăng ký hoạt động' : 'Register')}</button>
                        ) : (
                          <button type="button" className="btn-part-secondary" disabled>{vi ? 'Đã đóng đăng ký' : 'Registration closed'}</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}</PaginatedList>
          )}
        </section>
      ) : (
        <section className="event-activities-tab-content" aria-labelledby="registered-activities-title">
          <div className="participant-section-heading participant-section-heading--actions">
            <div><h2 id="registered-activities-title" className="section-heading-title">{vi ? 'Hoạt động thuộc sự kiện này' : 'Activities in this event'}</h2><p>{vi ? 'Chỉ hiển thị những đăng ký thuộc tài khoản hiện tại.' : 'Only registrations belonging to the current account are shown.'}</p></div>
            {eventActivities.length > 0 && (
              <SearchFieldLabel className="participant-activity-search"><label className="part-search-input">
                <Search size={17} className="icon" aria-hidden="true" />
                <input aria-label={vi ? 'Tìm hoạt động' : 'Search activities'} type="search" value={searchParams.get('search') || ''} onChange={event => {
                  const next = new URLSearchParams(searchParams);
                  if (event.target.value) next.set('search', event.target.value);
                  else next.delete('search');
                  setSearchParams(next, { replace: true });
                }} placeholder={vi ? 'Tìm theo tên, địa điểm...' : 'Search name or venue...'} />
              </label></SearchFieldLabel>
            )}
          </div>

          {actionError && <p className="participant-inline-error" role="alert">{actionError}</p>}
          {eventActivities.length === 0 ? (
            <div className="participant-data-state compact">
              <strong>{vi ? 'Bạn chưa đăng ký hoạt động nào' : 'No registered activities yet'}</strong>
              <p>{vi ? 'Hãy mở danh sách hoạt động của sự kiện để chọn hoạt động phù hợp.' : 'Open the event activity list to choose an activity.'}</p>
              <button type="button" className="btn-part-primary" onClick={() => setSection('discover')}>{vi ? 'Khám phá hoạt động' : 'Explore activities'}</button>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="participant-data-state compact"><strong>{vi ? 'Không tìm thấy hoạt động phù hợp' : 'No matching activities'}</strong><p>{vi ? 'Hãy thử một từ khóa khác.' : 'Try another search term.'}</p></div>
          ) : (
            <PaginatedList items={filteredActivities}>{pageItems => (
              <div className="activities-list-stack">
                {pageItems.map(activity => {
                  const state = activityStatus(activity, vi);
                  const StatusIcon = state.icon;
                  return (
                    <article className="activity-row-card participant-registration-row" key={activity.registrationId || activity.id}>
                      <div className="participant-activity-mark" aria-hidden="true"><Calendar size={22} /></div>
                      <div className="activity-row-info">
                        <div className="activity-badge-group"><span className="activity-tag">{activity.category}</span><span className={`participant-activity-status is-${state.tone}`}><StatusIcon size={13} />{state.label}</span></div>
                        <h3 className="activity-row-title"><Link to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`}>{activity.title}</Link></h3>
                        <div className="activity-row-meta"><span><Calendar size={14} />{displayDateText(activity.date)}</span><span><Clock size={14} />{activity.time}</span><span><MapPin size={14} />{activity.venue}</span></div>
                      </div>
                      <div className="activity-row-actions">
                        <Link className="btn-part-secondary" to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`}>{vi ? 'Chi tiết' : 'Details'}</Link>
                        {activity.status === 'registered' && (
                          <button type="button" className="btn-part-danger-outline" disabled={cancellingId === activity.id} onClick={() => {
                            if (window.confirm(vi ? 'Bạn có muốn hủy đăng ký hoạt động này?' : 'Cancel this activity registration?')) void cancelActivity(activity);
                          }}>{cancellingId === activity.id ? (vi ? 'Đang hủy...' : 'Cancelling...') : (vi ? 'Hủy đăng ký' : 'Cancel')}</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}</PaginatedList>
          )}
        </section>
      )}
    </div>
  );
};
