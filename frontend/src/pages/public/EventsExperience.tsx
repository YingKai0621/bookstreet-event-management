import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  MapPin,
  Search,
  Ticket,
  X
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { EventItem, Language, ParticipantProfile } from '../../types';
import './EventsExperience.css';

interface EventsExperienceProps {
  language: Language;
  open: boolean;
  events: EventItem[];
  isLoading?: boolean;
  onOpenRegisterModal?: (event: EventItem) => void;
  isParticipantAuthenticated?: boolean;
  participantProfile?: ParticipantProfile;
  onJoinEvent?: (eventId: string) => void | Promise<void>;
}

function decodePathIdentifier(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export const EventsExperience: React.FC<EventsExperienceProps> = ({
  language,
  open,
  events,
  isLoading = false,
  isParticipantAuthenticated = false,
  participantProfile: _participantProfile,
  onJoinEvent,
}) => {
  const vi = language === 'vi';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const eventPathMatch = location.pathname.match(/^\/su-kien\/([^/]+)\/?$/);
  const hasEventDetailPath = eventPathMatch !== null;
  const routeEventId = decodePathIdentifier(eventPathMatch?.[1]);
  const activeModalEvent = eventPathMatch
    ? events.find(event => event.id === routeEventId) || null
    : null;
  const [registeredEvent, setRegisteredEvent] = useState<EventItem | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  useModalDismiss(open && !activeModalEvent && !registeredEvent, () => navigate('/'));
  useModalDismiss(Boolean(activeModalEvent), () => navigate('/su-kien'));
  useModalDismiss(Boolean(registeredEvent), () => setRegisteredEvent(null));

  const eventTypes = [
    { id: 'all', labelVi: 'Tất cả sự kiện', labelEn: 'All Events', count: events.length },
    { id: 'talkshow', labelVi: 'Tọa đàm & Giao lưu', labelEn: 'Talkshows & Panels', count: events.filter(e => e.type === 'talkshow').length },
    { id: 'launch', labelVi: 'Ra mắt sách mới', labelEn: 'Book Launches', count: events.filter(e => e.type === 'launch').length },
    { id: 'workshop', labelVi: 'Workshop & Lễ hội', labelEn: 'Workshops & Festivals', count: events.filter(e => e.type === 'workshop').length },
  ];

  const featuredEvent = events[0];

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchType = selectedType === 'all' || evt.type === selectedType;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        evt.title.toLowerCase().includes(q) ||
        (evt.titleEn && evt.titleEn.toLowerCase().includes(q)) ||
        evt.summary.toLowerCase().includes(q) ||
        (evt.speaker && evt.speaker.toLowerCase().includes(q)) ||
        (evt.boothName && evt.boothName.toLowerCase().includes(q));

      return matchType && matchSearch;
    });
  }, [events, searchQuery, selectedType]);

  const handleClose = () => {
    navigate('/');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isParticipantAuthenticated) {
      navigate('/login', { state: { from: registeredEvent ? `/su-kien/${registeredEvent.id}` : '/su-kien' } });
      return;
    }
    if (!registeredEvent || !onJoinEvent) return;
    try {
      setRegistrationError(null);
      await onJoinEvent(registeredEvent.id);
      setRegisterSuccess(true);
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : 'Không thể đăng ký sự kiện');
    }
  };

  return (
    <div
      id="events-page-panel"
      className={`heritage-sheet ${open ? 'is-open' : ''}`}
      inert={!open}
      aria-hidden={!open || undefined}
    >
      <main className="heritage-document">
        {/* Editorial Collection Hero */}
        <section className="heritage-collection-hero">
          <div className="heritage-inner heritage-hero-grid">
            <div className="heritage-introduction">
              <button
                type="button"
                className="exp-btn-return-frameless"
                onClick={handleClose}
                aria-label={vi ? 'Trở về trang chủ Đường Sách' : 'Return to Book Street home'}
              >
                <ArrowLeft size={16} />
                <span>{vi ? 'Trở về trang chủ' : 'Back to Home'}</span>
              </button>

              <span className="heritage-kicker">
                <span />
                {vi ? 'Lịch hoạt động & Sự kiện' : 'Events Calendar & Activities'}
              </span>
              <h1 tabIndex={-1}>
                {vi ? (
                  <>
                    Hội ngộ tác giả.
                    <br />
                    Lắng nghe chuyện đời.
                  </>
                ) : (
                  <>
                    Meet inspiring authors.
                    <br />
                    Hear living stories.
                  </>
                )}
              </h1>
              <p>
                {vi
                  ? 'Tổng hợp đầy đủ các buổi giao lưu tác giả danh tiếng, ra mắt sách mới, đêm nhạc thơ acoustic và các workshop trải nghiệm nghệ thuật tại Đường Sách.'
                  : 'Complete program of author panel talks, book launches, acoustic poetry recitals and artisan workshops across Book Street stages.'}
              </p>

              <div className="heritage-hero-footnote">
                <strong>{events.length}</strong>
                <span>{vi ? 'hoạt động nổi bật' : 'upcoming events'}</span>
                <i />
                <Ticket size={17} />
                <span>{vi ? 'Tham gia sự kiện' : 'Join Event'}</span>
              </div>
            </div>

            {/* Featured Showcase Card on the right */}
            {featuredEvent && (
              <div
                className="heritage-featured"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/su-kien/${encodeURIComponent(featuredEvent.id)}`)}
                role="button"
                tabIndex={0}
                aria-label={`Khám phá ${featuredEvent.title}`}
              >
                <img
                  src={featuredEvent.image.url || undefined}
                  alt={featuredEvent.image.alt}
                  fetchPriority="high"
                />
                <span className="heritage-image-ribbon">★</span>
                <div>
                  <span>{vi ? 'Sự kiện tâm điểm' : 'Spotlight Event'}</span>
                  <h2>{vi ? featuredEvent.title : featuredEvent.titleEn}</h2>
                  <span>{featuredEvent.dayOfWeek}, {featuredEvent.scheduleStr || `${featuredEvent.dateStr} (${featuredEvent.timeStr})`}</span>
                </div>
                <ArrowRight className="heritage-featured-arrow" size={24} />
              </div>
            )}
          </div>
        </section>

        {/* Events Collection Grid Section */}
        <section className="heritage-inner heritage-collection" id="events-collection">
          {hasEventDetailPath && !isLoading && !activeModalEvent && (
            <p role="alert">{vi ? 'Không tìm thấy sự kiện được yêu cầu.' : 'The requested event was not found.'}</p>
          )}
          <div className="heritage-collection-title">
            <div>
              <span className="heritage-section-marker">
                {vi ? 'Lịch trình văn hóa' : 'Cultural Schedule'}
              </span>
              <h2>{vi ? 'Danh mục các sự kiện' : 'All Events & Talks'}</h2>
            </div>
            <div className="heritage-search">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={vi ? 'Tìm sự kiện, diễn giả, tọa đàm...' : 'Search event, speaker, launch...'}
                aria-label={vi ? 'Tìm kiếm sự kiện' : 'Search events'}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#66735e' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="heritage-filter-row">
            <div className="heritage-filters">
              {eventTypes.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={selectedType === cat.id}
                  onClick={() => setSelectedType(cat.id)}
                >
                  {vi ? cat.labelVi : cat.labelEn} ({cat.count})
                </button>
              ))}
            </div>
            <span>{vi ? `${filteredEvents.length} sự kiện` : `${filteredEvents.length} events`}</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="heritage-empty-result">
              <p>{vi ? 'Không tìm thấy sự kiện phù hợp với từ khóa.' : 'No events matched your query.'}</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                }}
              >
                {vi ? 'Xem lại tất cả sự kiện' : 'Reset search & filters'}
              </button>
            </div>
          ) : (
            <PaginatedList items={filteredEvents}>{pageItems => (<div className="events-collection-grid">
              {pageItems.map((evt) => (
                <article 
                  key={evt.id} 
                  className="event-card-item"
                  onClick={() => navigate(`/su-kien/${encodeURIComponent(evt.id)}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="event-card-image">
                    {evt.image.url && <img src={evt.image.url} alt={evt.title} />}
                    <span className="event-datetime-badge">{evt.dateStr}</span>
                  </div>
                  <div className="event-card-body">
                    <div className="event-badge-row">
                      <span className="heritage-card-cat">
                        {vi ? evt.typeLabelVi : evt.typeLabelEn}
                      </span>
                      {evt.boothName && (
                        <span className="event-booth-pill">{evt.boothName}</span>
                      )}
                    </div>
                    <h3 className="event-card-title">{vi ? evt.title : evt.titleEn}</h3>
                    <p className="heritage-card-loc">📍 {vi ? evt.location : evt.locationEn}</p>
                    <p className="heritage-card-summary">{vi ? evt.summary : evt.summaryEn}</p>
                    <div className="event-card-footer">
                      <span className="heritage-card-arrow-text">
                        {vi ? 'Đăng ký & Xem chi tiết' : 'Register & Details'}
                      </span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </article>
              ))}
            </div>)}</PaginatedList>
          )}
        </section>

        {/* Footer */}
        <footer className="heritage-sheet-footer">
          <span>
            ĐƯỜNG SÁCH <span> / </span>
            {vi ? 'Lịch sự kiện & Tọa đàm' : 'Events & Activities Calendar'}
          </span>
        </footer>

        {/* Event Detail Modal — rendered via Portal */}
        {activeModalEvent && createPortal(
          <div className="modal-overlay" onClick={() => navigate('/su-kien')} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => navigate('/su-kien')} aria-label="Đóng">
                <X size={20} />
              </button>
              <div className="modal-booth-header-img">
                {activeModalEvent.image.url && (
                  <img src={activeModalEvent.image.url} alt={activeModalEvent.image.alt} className="modal-top-img" />
                )}
                <div className="modal-img-caption">
                  <span className="kiosk-number-badge">{activeModalEvent.dayOfWeek}</span>
                  <span className="photo-source-cite">{activeModalEvent.dateStr}</span>
                </div>
              </div>
              <h3 className="modal-heading-title">
                {vi ? activeModalEvent.title : activeModalEvent.titleEn}
              </h3>
              <div className="modal-meta-box">
                <p>⏰ <strong>{vi ? 'Thời gian:' : 'Time:'}</strong> {activeModalEvent.dayOfWeek}, {activeModalEvent.scheduleStr || `${activeModalEvent.dateStr} (${activeModalEvent.timeStr})`}</p>
                <p>📍 <strong>{vi ? 'Địa điểm:' : 'Location:'}</strong> {vi ? activeModalEvent.location : activeModalEvent.locationEn}</p>
                {activeModalEvent.speaker && (
                  <p>🎙️ <strong>{vi ? 'Diễn giả / Chủ trì:' : 'Speaker:'}</strong> {activeModalEvent.speaker}</p>
                )}
                {activeModalEvent.boothName && (
                  <p>🏛️ <strong>{vi ? 'Đơn vị tổ chức:' : 'Organizer:'}</strong> {activeModalEvent.boothName}</p>
                )}
              </div>
              <p className="modal-body-desc">
                {vi ? activeModalEvent.summary : activeModalEvent.summaryEn}
              </p>
              <button
                type="button"
                className="btn-figma-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  const ev = activeModalEvent;
                  navigate('/su-kien');
                  setRegisteredEvent(ev);
                  setRegisterSuccess(false);
                }}
              >
                <CheckCircle size={16} />
                <span>{vi ? 'Tham gia sự kiện' : 'Join Event'}</span>
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Event Registration Modal — rendered via Portal */}
        {registeredEvent && createPortal(
          <div className="modal-overlay registration-modal-overlay" onClick={() => setRegisteredEvent(null)} role="dialog" aria-modal="true" aria-labelledby="reg-modal-heading">
            <div className="modal-content modal-register-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setRegisteredEvent(null)} aria-label="Đóng">
                <X size={20} />
              </button>

              {registerSuccess ? (
                <div className="success-box-center" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <CheckCircle size={58} color="#15803D" style={{ margin: '0 auto 1rem' }} />
                  <span className="reg-badge-tag" style={{ background: '#DCFCE7', color: '#15803D', marginBottom: '0.65rem' }}>
                    {vi ? 'ĐÃ THAM GIA SỰ KIỆN' : 'EVENT JOINED'}
                  </span>
                  <h3 id="reg-modal-heading" className="modal-heading-title" style={{ color: '#1A2823', marginTop: '0.25rem' }}>
                    {vi ? 'Đăng ký tham dự thành công!' : 'Registration Successful!'}
                  </h3>
                  <div className="success-event-badge" style={{ margin: '0.85rem auto 1rem' }}>
                    {registeredEvent.title}
                  </div>
                  <p className="modal-body-desc" style={{ maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
                    {vi
                      ? 'Tài khoản của bạn đã được ghi nhận tham gia sự kiện. Hãy đăng ký hoạt động phù hợp; khi đến nơi, quét mã QR hoạt động do Ban tổ chức hiển thị để điểm danh.'
                      : 'Your account has joined this event. Register for an activity, then scan the Activity QR displayed by the Organizer at the venue to check in.'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem', alignItems: 'center' }}>
                    {isParticipantAuthenticated && (
                      <button
                        type="button"
                        className="btn-figma-primary"
                        style={{ minWidth: '220px', padding: '0.75rem 1.5rem' }}
                        onClick={() => {
                          setRegisteredEvent(null);
                          navigate('/participant/events');
                        }}
                      >
                        {vi ? 'Xem sự kiện của tôi' : 'View My Events'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={isParticipantAuthenticated ? 'btn-figma-secondary' : 'btn-figma-primary'}
                      style={{ minWidth: '180px', padding: '0.75rem 2rem' }}
                      onClick={() => setRegisteredEvent(null)}
                    >
                      {vi ? 'Hoàn tất' : 'Done'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="reg-modal-header">
                    <span className="reg-badge-tag">
                      {vi ? 'ĐĂNG KÝ THAM GIA' : 'EVENT REGISTRATION'}
                    </span>
                    <h3 id="reg-modal-heading" className="modal-heading-title reg-modal-title">
                      {vi ? 'Đăng ký tham dự sự kiện' : 'Event Registration'}
                    </h3>
                  </div>

                  {/* Selected Event Context Card Preview */}
                  <div className="reg-event-card-preview">
                    <div className="reg-event-thumb-wrap">
                      <img 
                        src={registeredEvent.image.url || undefined}
                        alt={registeredEvent.image.alt} 
                        className="reg-event-thumb" 
                      />
                      <span className="reg-event-type-badge">
                        {vi ? registeredEvent.typeLabelVi : registeredEvent.typeLabelEn}
                      </span>
                    </div>
                    <div className="reg-event-info">
                      <h4 className="reg-event-title">
                        {vi ? registeredEvent.title : registeredEvent.titleEn}
                      </h4>
                      <div className="reg-event-meta-list">
                        <span className="reg-meta-item">
                          <Clock size={14} />
                          {registeredEvent.dayOfWeek ? `${registeredEvent.dayOfWeek}, ` : ''}{registeredEvent.scheduleStr || `${registeredEvent.dateStr} • ${registeredEvent.timeStr}`}
                        </span>
                        <span className="reg-meta-item">
                          <MapPin size={14} />
                          {vi ? registeredEvent.location : registeredEvent.locationEn}
                        </span>
                        {registeredEvent.speaker && (
                          <span className="reg-meta-item reg-speaker-line">
                            <strong>{vi ? 'Diễn giả:' : 'Speaker:'}</strong> {registeredEvent.speaker}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isParticipantAuthenticated && (
                    <div style={{
                      padding: '0.65rem 0.85rem',
                      background: '#FAF8F3',
                      border: '1px solid #E9BC63',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontSize: '0.82rem',
                      color: '#8C6519',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem'
                    }}>
                      <span>{vi ? 'Đăng nhập để tham gia sự kiện bằng tài khoản của bạn.' : 'Sign in to join the event with your account.'}</span>
                      <Link
                        to="/login"
                        state={{ from: registeredEvent ? `/su-kien/${registeredEvent.id}` : '/su-kien' }}
                        style={{ fontWeight: 700, color: '#17382E', textDecoration: 'underline' }}
                      >
                        {vi ? 'Đăng nhập' : 'Sign in'}
                      </Link>
                    </div>
                  )}

                  <form onSubmit={handleRegisterSubmit} className="figma-reg-form">
                    {registrationError && <p role="alert" className="app-loading-state">{registrationError}</p>}
                    <p className="modal-body-desc">{vi ? 'Mỗi tài khoản chỉ ghi danh cho chính mình. Việc tham gia sự kiện không tự giữ chỗ cho từng hoạt động.' : 'Each account joins for itself. Joining the event does not reserve a place in any activity.'}</p>

                    <div className="modal-actions-row" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                      <button type="button" className="btn-figma-secondary" onClick={() => setRegisteredEvent(null)}>
                        {vi ? 'Hủy' : 'Cancel'}
                      </button>
                      <button type="submit" className="btn-figma-primary reg-submit-button" style={{ flex: 1 }}>
                        <CheckCircle size={17} />
                        <span>{vi ? 'Xác nhận Đăng ký Tham dự' : 'Confirm Registration'}</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
      </main>
    </div>
  );
};
