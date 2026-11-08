import { clampPage, getPageCount, getPageOffset, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../../components/ui/ListPagination';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  Send,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
import { PartnerFilterSelect } from '../../components/partner/PartnerFilterSelect';
import { SearchFieldLabel } from '../../components/ui/SearchFieldLabel';
import '../../components/partner/PartnerEvents.css';
import { PartnerAvailableEvent, partnerApi } from '../../services/partnerApi';
import { Language, PartnerEventApplication, PartnerOrganization } from '../../types';
import {
  PartnerEventHero,
  PartnerEventLoading,
  PartnerEventMeta,
} from './PartnerEventPageShared';
import {
  formatPartnerEventDateTime,
  PARTNER_APPLICATION_STATUS_LABELS,
  partnerApplicationErrorMessage,
  partnerEventTimestamp,
} from './PartnerEventPageUtils';
import './PartnerPages.css';

interface PartnerEventDiscoveryPageProps {
  language: Language;
  organization: PartnerOrganization | null;
}

type AvailabilityFilter = 'all' | 'open' | 'applied';
type EventTimeFilter = 'all' | 'upcoming' | 'month';
type EventSortOrder = 'nearest' | 'farthest';
const EVENTS_PER_PAGE = LIST_PAGE_SIZE;


export const PartnerEventDiscoveryPage: React.FC<PartnerEventDiscoveryPageProps> = ({ language, organization }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const resultsSectionRef = useRef<HTMLElement>(null);
  const [events, setEvents] = useState<PartnerAvailableEvent[]>([]);
  const [applications, setApplications] = useState<PartnerEventApplication[]>([]);
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [timeFilter, setTimeFilter] = useState<EventTimeFilter>('all');
  const [sortOrder, setSortOrder] = useState<EventSortOrder>('nearest');
  const [eventPage, setEventPage] = useState(1);
  const [filterReferenceTime] = useState(() => Date.now());
  const [applicationNote, setApplicationNote] = useState('');
  const [applicationEvent, setApplicationEvent] = useState<PartnerAvailableEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadDiscovery = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [publishedEvents, ownApplications] = await Promise.all([
        partnerApi.getPublishedEvents(),
        partnerApi.getApplications(),
      ]);
      setEvents(publishedEvents);
      setApplications(ownApplications);
      setEventPage(1);
    } catch (error) {
      setErrorMessage(partnerApplicationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Opening an event from a link only reads data already loaded. Clearing the link when the modal
  // closes must not reload the whole list, so this stays separate from loadDiscovery.
  const requestedEventId = new URLSearchParams(location.search).get('event');
  useEffect(() => {
    if (isLoading || !requestedEventId) return;
    const existingApplication = applications.find(application => application.eventId === requestedEventId);
    if (existingApplication) {
      navigate(`/partner/events?application=${encodeURIComponent(existingApplication.id)}`, { replace: true });
      return;
    }
    // oxlint-disable-next-line react/set-state-in-effect -- The requested link selects which loaded event to show.
    setApplicationEvent(events.find(event => event.id === requestedEventId) || null);
  }, [applications, events, isLoading, navigate, requestedEventId]);

  useEffect(() => {
    // Loading route-owned data is the external synchronization performed by this page.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadDiscovery();
  }, [loadDiscovery]);

  const applicationByEventId = useMemo(
    () => new Map(applications.map(application => [application.eventId, application])),
    [applications],
  );

  const counts = useMemo(() => ({
    all: events.length,
    open: events.filter(event => event.acceptingApplications && !applicationByEventId.has(event.id)).length,
    applied: events.filter(event => applicationByEventId.has(event.id)).length,
  }), [applicationByEventId, events]);

  const keyword = search.trim().toLocaleLowerCase('vi');
  const visibleEvents = useMemo(() => events
    .filter(event => {
      const existingApplication = applicationByEventId.get(event.id);
      if (availabilityFilter === 'open' && (!event.acceptingApplications || existingApplication)) return false;
      if (availabilityFilter === 'applied' && !existingApplication) return false;

      const startTimestamp = partnerEventTimestamp(event.startAt);
      const endTimestamp = partnerEventTimestamp(event.endAt);
      if (timeFilter === 'upcoming' && endTimestamp && endTimestamp < filterReferenceTime) return false;
      if (timeFilter === 'month') {
        const thirtyDaysFromNow = filterReferenceTime + 30 * 24 * 60 * 60 * 1000;
        if (!startTimestamp || startTimestamp < filterReferenceTime || startTimestamp > thirtyDaysFromNow) return false;
      }

      return !keyword || [event.id, event.name, event.description]
        .some(value => value.toLocaleLowerCase('vi').includes(keyword));
    })
    .sort((left, right) => {
      const difference = partnerEventTimestamp(left.startAt) - partnerEventTimestamp(right.startAt);
      return sortOrder === 'nearest' ? difference : -difference;
    }), [applicationByEventId, availabilityFilter, events, filterReferenceTime, keyword, sortOrder, timeFilter]);

  const eventPageCount = getPageCount(visibleEvents.length, EVENTS_PER_PAGE);
  const currentEventPage = clampPage(eventPage, eventPageCount);
  if (eventPage !== currentEventPage) setEventPage(currentEventPage);
  const eventRangeStart = getPageOffset(currentEventPage, EVENTS_PER_PAGE);
  const paginatedEvents = visibleEvents.slice(eventRangeStart, eventRangeStart + EVENTS_PER_PAGE);

  const goToEventPage = (page: number) => {
    setEventPage(page);
    window.requestAnimationFrame(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openApplicationModal = (event: PartnerAvailableEvent) => {
    setApplicationNote('');
    setApplicationEvent(event);
  };

  const closeApplicationModal = () => {
    setApplicationEvent(null);
    if (location.search) navigate('/partner/events/apply', { replace: true });
  };

  const submitApplication = async () => {
    if (!applicationEvent) return;
    const submittedEvent = applicationEvent;
    setProcessingId(submittedEvent.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await partnerApi.submitApplication(submittedEvent.id, applicationNote.trim());
      setApplications(await partnerApi.getApplications());
      setEventPage(1);
      setSuccessMessage(`Gửi hồ sơ đăng ký thành công. Hồ sơ tham gia “${submittedEvent.name}” đã được gửi đến Ban Quản Lý để xem xét.`);
      setApplicationEvent(null);
      setApplicationNote('');
      if (location.search) navigate('/partner/events/apply', { replace: true });
    } catch (error) {
      setErrorMessage(partnerApplicationErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const filters: Array<{ value: AvailabilityFilter; label: string; count: number }> = [
    { value: 'all', label: 'Tất cả sự kiện', count: counts.all },
    { value: 'open', label: 'Đang mở đăng ký', count: counts.open },
    { value: 'applied', label: 'Đã gửi hồ sơ', count: counts.applied },
  ];

  return (
    <div className="partner-page partner-event-hub partner-event-discovery">
      <PartnerEventHero
        title={language === 'vi' ? 'Khám phá và đăng ký sự kiện' : 'Discover & apply for events'}
        breadcrumb="KHÁM PHÁ SỰ KIỆN"
        description="Tìm sự kiện phù hợp, xem thời hạn nhận hồ sơ và đăng ký tham gia tại một nơi riêng biệt."
        isLoading={isLoading}
        onRefresh={() => void loadDiscovery()}
      />

      {errorMessage && <div role="alert" className="partner-form-alert error"><AlertCircle size={18} /><span>{errorMessage}</span></div>}
      {successMessage && <div role="status" className="partner-form-alert success event-discovery-success"><CheckCircle2 size={18} /><span>{successMessage}</span><Link to="/partner/events">Xem hồ sơ của tôi <ArrowRight size={15} /></Link></div>}
      {!organization && <div className="event-hub-profile-warning"><Building2 size={22} /><div><strong>Chưa có hồ sơ tổ chức</strong><p>Hãy <Link to="/partner/profile">hoàn thiện hồ sơ tổ chức</Link> trước khi đăng ký sự kiện.</p></div></div>}

      <section className="event-hub-controls" aria-label="Tìm kiếm và lọc sự kiện công khai">
        <div className="event-hub-application-cta is-return"><div><strong>Hồ sơ đã gửi được quản lý riêng</strong><p>Xem trạng thái xét duyệt, phản hồi và rút hồ sơ tại trang quản lý hồ sơ.</p></div><Link to="/partner/events"><FileText size={18} />Hồ sơ sự kiện của tôi<ArrowRight size={17} /></Link></div>
        <SearchFieldLabel className="event-hub-search-group"><div className="event-hub-search"><Search size={18} /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setEventPage(1); }} placeholder="Tìm theo tên hoặc nội dung sự kiện…" aria-label="Tìm kiếm sự kiện công khai" /></div></SearchFieldLabel>
        <div className="event-hub-control-row">
          <div className="event-hub-status-group"><span className="event-hub-control-label">Tình trạng sự kiện</span><div className="event-hub-filters" role="group" aria-label="Tình trạng sự kiện">{filters.map(filter => <button type="button" aria-pressed={availabilityFilter === filter.value} className={`event-hub-filter is-${filter.value} ${availabilityFilter === filter.value ? 'is-active' : ''}`} key={filter.value} onClick={() => { setAvailabilityFilter(filter.value); setEventPage(1); }}>{filter.value !== 'all' && <i aria-hidden="true" />}{filter.label}<span>{filter.count}</span></button>)}</div></div>
          <div className="event-hub-selectors">
            <PartnerFilterSelect label="Sắp xếp" ariaLabel="Sắp xếp sự kiện" icon={ArrowUpDown} value={sortOrder} options={[{ value: 'nearest', label: 'Gần nhất' }, { value: 'farthest', label: 'Xa nhất' }]} onChange={value => { setSortOrder(value); setEventPage(1); }} />
            <PartnerFilterSelect label="Thời gian tổ chức" ariaLabel="Lọc thời gian sự kiện" icon={CalendarDays} value={timeFilter} options={[{ value: 'all', label: 'Tất cả thời gian' }, { value: 'upcoming', label: 'Sắp/đang diễn ra' }, { value: 'month', label: 'Trong 30 ngày tới' }]} onChange={value => { setTimeFilter(value); setEventPage(1); }} />
          </div>
        </div>
      </section>

      {isLoading ? <PartnerEventLoading label="Đang tải sự kiện công khai…" /> : (
        <section ref={resultsSectionRef} aria-labelledby="available-events-title">
          <div className="event-hub-section-heading"><div><h2 id="available-events-title">Sự kiện dành cho đối tác</h2></div><p>{visibleEvents.length} kết quả phù hợp</p></div>
          <div className="event-hub-grid">
            {paginatedEvents.map(event => {
              const existingApplication = applicationByEventId.get(event.id);
              return (
                <article className="event-discovery-card" key={event.id}>
                  <div className={`event-discovery-cover ${event.bannerUrl ? 'has-image' : ''}`}>
                    {event.bannerUrl && <img src={event.bannerUrl} alt={`Ảnh sự kiện ${event.name}`} />}
                    <div className="event-discovery-cover-shade" />
                    <span className={`event-discovery-state ${existingApplication ? 'is-applied' : event.acceptingApplications ? 'is-open' : 'is-closed'}`}>{existingApplication ? `Bạn đã gửi hồ sơ · ${PARTNER_APPLICATION_STATUS_LABELS[existingApplication.status]}` : event.acceptingApplications ? 'Đang nhận đăng ký' : 'Đã đóng đăng ký'}</span>
                    <CalendarDays size={34} />
                  </div>
                  <div className="event-discovery-content">
                    <h3>{event.name}</h3><p>{event.description || 'Thông tin mô tả sự kiện đang được cập nhật.'}</p>
                    <PartnerEventMeta startAt={event.startAt} endAt={event.endAt} deadline={event.partnerApplicationDeadlineAt} />
                    {existingApplication ? <Link className="event-card-secondary-action" to={`/partner/events?application=${encodeURIComponent(existingApplication.id)}`}><FileText size={16} /> Xem hồ sơ đã gửi <ArrowRight size={15} /></Link> : <button type="button" className="event-card-primary-action" onClick={() => openApplicationModal(event)} disabled={!event.acceptingApplications || !organization || organization.status !== 'ACTIVE'}><Send size={16} />{event.acceptingApplications ? 'Xem & đăng ký' : 'Đã đóng đăng ký'}<ArrowRight size={15} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleEvents.length > 0 && (
            <div className="event-application-pagination">
              <p>Hiển thị <strong>{eventRangeStart + 1}–{Math.min(eventRangeStart + EVENTS_PER_PAGE, visibleEvents.length)}</strong> trong tổng số <strong>{visibleEvents.length}</strong> sự kiện</p>
              <ListPagination page={currentEventPage} pages={eventPageCount} onPage={goToEventPage} />
            </div>
          )}
          {visibleEvents.length === 0 && <div className="event-hub-empty"><Search size={30} /><h2>Không tìm thấy sự kiện phù hợp</h2><p>Hãy thử từ khóa hoặc bộ lọc khác, hoặc quay lại sau khi Ban tổ chức công bố sự kiện mới.</p></div>}
        </section>
      )}

      {applicationEvent && <PartnerDialog title="Đăng ký tham gia sự kiện" onClose={() => !processingId && closeApplicationModal()}><div className="partner-dialog-body event-application-modal"><span className="event-modal-eyebrow"><CalendarDays size={15} /> Sự kiện đang nhận đăng ký</span><h3 className="partner-dialog-event-title">{applicationEvent.name}</h3><p>{applicationEvent.description || 'Thông tin mô tả đang được cập nhật.'}</p><div className="event-modal-meta"><span><CalendarDays size={15} />{formatPartnerEventDateTime(applicationEvent.startAt)} – {formatPartnerEventDateTime(applicationEvent.endAt)}</span><span><Clock3 size={15} />Hạn đăng ký: {formatPartnerEventDateTime(applicationEvent.partnerApplicationDeadlineAt)}</span></div><label htmlFor="event-application-note">Ghi chú đăng ký (không bắt buộc)</label><textarea id="event-application-note" rows={5} value={applicationNote} onChange={event => setApplicationNote(event.target.value)} placeholder="Mô tả nhu cầu trưng bày, thể loại sách và nguyện vọng tham gia sự kiện…" disabled={Boolean(processingId)} /><div className="partner-dialog-actions"><button type="button" className="btn-part-secondary" onClick={closeApplicationModal} disabled={Boolean(processingId)}>Để sau</button><button type="button" className="btn-part-primary" onClick={() => void submitApplication()} disabled={Boolean(processingId) || !applicationEvent.acceptingApplications || !organization || organization.status !== 'ACTIVE'}><Send size={16} />{processingId ? 'Đang gửi…' : 'Gửi hồ sơ đăng ký'}</button></div></div></PartnerDialog>}
    </div>
  );
};
