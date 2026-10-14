import {
  AlertCircle,
  ArrowUpDown,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Undo2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
import '../../components/partner/PartnerEvents.css';
import { ApiError } from '../../services/apiClient';
import { PartnerAvailableEvent, partnerApi } from '../../services/partnerApi';
import { Language, PartnerEventApplication, PartnerOrganization } from '../../types';
import './PartnerPages.css';

interface EventApplicationPageProps {
  language: Language;
  organization: PartnerOrganization | null;
}

type EventView = 'applications' | 'available' | PartnerEventApplication['status'];
type SortOrder = 'newest' | 'oldest';
type TimeFilter = 'all' | 'active' | 'past';
const APPLICATIONS_PER_PAGE = 10;

const STATUS_LABELS: Record<PartnerEventApplication['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  withdrawn: 'Đã rút',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Đang cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function matchesTimeFilter(endAt: string | undefined, timeFilter: TimeFilter, now: number): boolean {
  if (timeFilter === 'all') return true;
  const endTimestamp = toTimestamp(endAt);
  if (!endTimestamp) return timeFilter === 'active';
  return timeFilter === 'past' ? endTimestamp < now : endTimestamp >= now;
}

function paginationItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter(page => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const items: Array<number | 'ellipsis'> = [];
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) items.push('ellipsis');
    items.push(page);
  });
  return items;
}

function EventThumbnail({ imageUrl, title }: { imageUrl: string; title: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(imageUrl) && !imageFailed;

  return (
    <div className={`event-application-thumbnail ${hasImage ? 'has-image' : 'is-fallback'}`}>
      {hasImage ? (
        <img src={imageUrl} alt={`Ảnh sự kiện ${title}`} onError={() => setImageFailed(true)} />
      ) : (
        <div className="event-application-placeholder" aria-label="Sự kiện Đường Sách chưa có ảnh">
          <BookOpen size={30} />
        </div>
      )}
    </div>
  );
}

function applicationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Không thể xử lý hồ sơ đăng ký.';
  }

  switch (error.code) {
    case 'PARTNER_ORGANIZATION_REQUIRED':
      return 'Bạn cần hoàn thiện một hồ sơ tổ chức đang hoạt động trước khi đăng ký.';
    case 'EVENT_NOT_ACCEPTING_APPLICATIONS':
      return 'Sự kiện này hiện không nhận hồ sơ đối tác.';
    case 'APPLICATION_DEADLINE_PASSED':
      return 'Đã hết hạn đăng ký đối tác cho sự kiện này.';
    case 'APPLICATION_ALREADY_EXISTS':
      return 'Tổ chức đã có hồ sơ cho sự kiện này và không thể đăng ký lần hai.';
    case 'APPLICATION_NOT_PENDING':
      return 'Chỉ hồ sơ đang chờ duyệt mới có thể rút.';
    default:
      return error.message;
  }
}

export const EventApplicationPage: React.FC<EventApplicationPageProps> = ({ language, organization }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isApplyRoute = location.pathname.endsWith('/apply');
  const [activeView, setActiveView] = useState<EventView>(isApplyRoute ? 'available' : 'applications');
  const [events, setEvents] = useState<PartnerAvailableEvent[]>([]);
  const [applications, setApplications] = useState<PartnerEventApplication[]>([]);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [applicationPage, setApplicationPage] = useState(1);
  const [filterReferenceTime] = useState(() => Date.now());
  const [applicationNote, setApplicationNote] = useState('');
  const [applicationEvent, setApplicationEvent] = useState<PartnerAvailableEvent | null>(null);
  const [detailApplication, setDetailApplication] = useState<PartnerEventApplication | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<PartnerEventApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [publishedEvents, ownApplications] = await Promise.all([
        partnerApi.getPublishedEvents(),
        partnerApi.getApplications(),
      ]);
      setEvents(publishedEvents);
      setApplications(ownApplications);
      const requestedEventId = new URLSearchParams(location.search).get('event');
      if (isApplyRoute && requestedEventId) {
        const existingApplication = ownApplications.find(application => application.eventId === requestedEventId);
        if (existingApplication) setDetailApplication(existingApplication);
        else setApplicationEvent(publishedEvents.find(event => event.id === requestedEventId) || null);
      }
    } catch (error) {
      setErrorMessage(applicationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [isApplyRoute, location.search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const applicationByEventId = useMemo(
    () => new Map(applications.map(application => [application.eventId, application])),
    [applications],
  );

  const counts = useMemo(() => ({
    applications: applications.length,
    available: events.filter(event => event.acceptingApplications && !applicationByEventId.has(event.id)).length,
    pending: applications.filter(application => application.status === 'pending').length,
    approved: applications.filter(application => application.status === 'approved').length,
    rejected: applications.filter(application => application.status === 'rejected').length,
    withdrawn: applications.filter(application => application.status === 'withdrawn').length,
  }), [applicationByEventId, applications, events]);

  const currentView: EventView = isApplyRoute
    ? 'available'
    : activeView === 'available' ? 'applications' : activeView;
  const keyword = search.trim().toLocaleLowerCase('vi');
  const visibleApplications = useMemo(() => applications
    .filter(application => {
      if (currentView !== 'applications' && currentView !== 'available' && application.status !== currentView) return false;
      if (!matchesTimeFilter(application.endAt, timeFilter, filterReferenceTime)) return false;
      return !keyword || [application.id, application.eventTitle, application.applicationNote, application.reviewNote]
        .some(value => value.toLocaleLowerCase('vi').includes(keyword));
    })
    .sort((left, right) => {
      const difference = toTimestamp(right.submittedAt) - toTimestamp(left.submittedAt);
      return sortOrder === 'newest' ? difference : -difference;
    }), [applications, currentView, filterReferenceTime, keyword, sortOrder, timeFilter]);
  const visibleEvents = useMemo(() => events
    .filter(event => event.acceptingApplications
      && !applicationByEventId.has(event.id)
      && matchesTimeFilter(event.endAt, timeFilter, filterReferenceTime)
      && (!keyword || [event.id, event.name, event.description]
        .some(value => value.toLocaleLowerCase('vi').includes(keyword))))
    .sort((left, right) => {
      const difference = toTimestamp(right.startAt) - toTimestamp(left.startAt);
      return sortOrder === 'newest' ? difference : -difference;
    }), [applicationByEventId, events, filterReferenceTime, keyword, sortOrder, timeFilter]);
  const applicationPageCount = Math.ceil(visibleApplications.length / APPLICATIONS_PER_PAGE);
  const currentApplicationPage = Math.min(applicationPage, Math.max(applicationPageCount, 1));
  const applicationRangeStart = (currentApplicationPage - 1) * APPLICATIONS_PER_PAGE;
  const paginatedApplications = visibleApplications.slice(
    applicationRangeStart,
    applicationRangeStart + APPLICATIONS_PER_PAGE,
  );

  const openApplicationModal = (event: PartnerAvailableEvent) => {
    setApplicationNote('');
    setApplicationEvent(event);
  };

  const submitApplication = async () => {
    if (!applicationEvent) return;
    setProcessingId(applicationEvent.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await partnerApi.submitApplication(applicationEvent.id, applicationNote.trim());
      setSuccessMessage(`Đã gửi hồ sơ tham gia “${applicationEvent.name}”.`);
      setApplications(await partnerApi.getApplications());
      setApplicationEvent(null);
      setApplicationNote('');
      setActiveView('applications');
      navigate('/partner/events');
    } catch (error) {
      setErrorMessage(applicationErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const withdrawApplication = async () => {
    if (!withdrawTarget) return;
    const target = withdrawTarget;
    setProcessingId(target.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await partnerApi.withdrawApplication(target.id);
      setSuccessMessage(`Đã rút hồ sơ tham gia “${target.eventTitle}”.`);
      setApplications(await partnerApi.getApplications());
      setWithdrawTarget(null);
      setDetailApplication(null);
    } catch (error) {
      setErrorMessage(applicationErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const openWithdrawDialog = (application: PartnerEventApplication) => {
    setDetailApplication(null);
    setWithdrawTarget(application);
  };

  const filters: Array<{ value: Exclude<EventView, 'available'>; label: string; count: number }> = [
    { value: 'applications', label: 'Tất cả hồ sơ', count: counts.applications },
    { value: 'approved', label: 'Đã duyệt', count: counts.approved },
    { value: 'pending', label: 'Chờ duyệt', count: counts.pending },
    { value: 'rejected', label: 'Từ chối', count: counts.rejected },
    { value: 'withdrawn', label: 'Đã rút', count: counts.withdrawn },
  ];

  const selectApplicationView = (view: Exclude<EventView, 'available'>) => {
    setActiveView(view);
    setApplicationPage(1);
    if (isApplyRoute) navigate('/partner/events');
  };

  return (
    <div className="partner-page partner-event-hub">
      <header className="event-hub-hero">
        <div className="event-hub-hero-copy">
          <span className="event-hub-eyebrow">ĐỐI TÁC <ChevronRight size={13} /> SỰ KIỆN & ĐĂNG KÝ</span>
          <h1>{language === 'vi' ? 'Sự kiện & đăng ký' : 'Events & applications'}</h1>
          <p>Theo dõi hồ sơ đã gửi, tìm sự kiện phù hợp và đăng ký tham gia trong cùng một nơi.</p>
        </div>
        <div className="event-hub-hero-visual" aria-hidden="true" />
        <button type="button" className="event-hub-refresh" onClick={() => void loadData()} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'event-hub-spin' : ''} />
          {isLoading ? 'Đang cập nhật…' : 'Làm mới dữ liệu'}
        </button>
      </header>

      {errorMessage && <div role="alert" className="partner-form-alert error"><AlertCircle size={18} /><span>{errorMessage}</span></div>}
      {successMessage && <div role="status" className="partner-form-alert success"><CheckCircle2 size={18} /><span>{successMessage}</span></div>}
      {!organization && (
        <div className="event-hub-profile-warning">
          <Building2 size={22} />
          <div><strong>Chưa có hồ sơ tổ chức</strong><p>Hãy <Link to="/partner/profile">hoàn thiện hồ sơ tổ chức</Link> trước khi đăng ký sự kiện.</p></div>
        </div>
      )}

      <section className="event-hub-controls" aria-label="Tìm kiếm và lọc sự kiện">
        <div className={`event-hub-application-cta ${currentView === 'available' ? 'is-return' : ''}`}>
          <div>
            <strong>{currentView === 'available' ? 'Đang khám phá sự kiện mở' : 'Bạn muốn tham gia sự kiện mới?'}</strong>
            <p>{currentView === 'available'
              ? 'Chọn sự kiện phù hợp bên dưới để xem thông tin và gửi hồ sơ tham gia.'
              : 'Khám phá các sự kiện đang mở đăng ký và gửi hồ sơ tham gia.'}</p>
          </div>
          <Link
            to={currentView === 'available' ? '/partner/events' : '/partner/events/apply'}
            onClick={() => setApplicationPage(1)}
          >
            <BookOpen size={18} />
            {currentView === 'available' ? 'Quay lại hồ sơ của tôi' : 'Đăng ký sự kiện mới'}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="event-hub-search">
          <Search size={18} />
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setApplicationPage(1); }} placeholder="Tìm nhanh theo tên sự kiện, mã hồ sơ hoặc nội dung…" aria-label="Tìm kiếm sự kiện" />
        </div>
        <div className="event-hub-control-row">
          <div className="event-hub-status-group">
            <span className="event-hub-control-label">Trạng thái hồ sơ</span>
            <div className="event-hub-filters" role="tablist" aria-label="Trạng thái hồ sơ">
              {filters.map(filter => (
                <button type="button" role="tab" aria-selected={currentView === filter.value} className={`event-hub-filter is-${filter.value} ${currentView === filter.value ? 'is-active' : ''}`} key={filter.value} onClick={() => selectApplicationView(filter.value)}>
                  {filter.value !== 'applications' && <i aria-hidden="true" />}
                  {filter.label}<span>{filter.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="event-hub-selectors">
            <label className="event-hub-select-field">
              <span>Sắp xếp theo</span>
              <div><ArrowUpDown size={15} /><select value={sortOrder} onChange={event => { setSortOrder(event.target.value as SortOrder); setApplicationPage(1); }} aria-label="Sắp xếp hồ sơ"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select><ChevronDown size={15} /></div>
            </label>
            <label className="event-hub-select-field">
              <span>Thời gian</span>
              <div><CalendarDays size={15} /><select value={timeFilter} onChange={event => { setTimeFilter(event.target.value as TimeFilter); setApplicationPage(1); }} aria-label="Lọc theo thời gian"><option value="all">Tất cả thời gian</option><option value="active">Sắp/đang diễn ra</option><option value="past">Đã kết thúc</option></select><ChevronDown size={15} /></div>
            </label>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="event-hub-loading" role="status"><RefreshCw size={26} className="event-hub-spin" /><strong>Đang chuẩn bị không gian sự kiện…</strong></div>
      ) : currentView === 'available' ? (
        <section aria-labelledby="available-events-title">
          <div className="event-hub-section-heading">
            <div><span>SỰ KIỆN CÔNG KHAI</span><h2 id="available-events-title">Khám phá sự kiện đang công bố</h2></div>
            <p>{visibleEvents.length} kết quả phù hợp</p>
          </div>
          <div className="event-hub-grid">
            {visibleEvents.map(event => {
              const existingApplication = applicationByEventId.get(event.id);
              return (
                <article className="event-discovery-card" key={event.id}>
                  <div className={`event-discovery-cover ${event.bannerUrl ? 'has-image' : ''}`}>
                    {event.bannerUrl && <img src={event.bannerUrl} alt="" />}
                    <div className="event-discovery-cover-shade" />
                    <span className={`event-discovery-state ${event.acceptingApplications ? 'is-open' : 'is-closed'}`}>
                      {existingApplication ? STATUS_LABELS[existingApplication.status] : event.acceptingApplications ? 'Đang nhận đăng ký' : 'Đã đóng đăng ký'}
                    </span>
                    <CalendarDays size={34} />
                  </div>
                  <div className="event-discovery-content">
                    <h3>{event.name}</h3>
                    <p>{event.description || 'Thông tin mô tả sự kiện đang được cập nhật.'}</p>
                    <div className="event-discovery-meta">
                      <span><CalendarDays size={15} /><strong>{formatDateTime(event.startAt)}</strong> – {formatDateTime(event.endAt)}</span>
                      <span><Clock3 size={15} />Hạn đăng ký: <strong>{formatDateTime(event.partnerApplicationDeadlineAt)}</strong></span>
                    </div>
                    {existingApplication ? (
                      <button type="button" className="event-card-secondary-action" onClick={() => setDetailApplication(existingApplication)}><FileText size={16} /> Xem hồ sơ <ArrowRight size={15} /></button>
                    ) : (
                      <button type="button" className="event-card-primary-action" onClick={() => openApplicationModal(event)} disabled={!event.acceptingApplications || !organization || organization.status !== 'ACTIVE'}>
                        <Send size={16} /> Xem & đăng ký <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleEvents.length === 0 && <div className="event-hub-empty"><Search size={30} /><h2>Không tìm thấy sự kiện phù hợp</h2><p>Hãy thử từ khóa khác hoặc quay lại sau khi Ban tổ chức công bố sự kiện mới.</p></div>}
        </section>
      ) : (
        <section aria-labelledby="applications-title">
          <div className="event-hub-section-heading">
            <div><span>HỒ SƠ THAM GIA</span><h2 id="applications-title">{currentView === 'applications' ? 'Sự kiện của bạn' : filters.find(item => item.value === currentView)?.label}</h2></div>
            <p>{visibleApplications.length} hồ sơ phù hợp</p>
          </div>
          <div className="event-application-list">
            {paginatedApplications.map(application => {
              const previewNote = application.reviewNote || application.applicationNote;
              const previewLabel = application.reviewNote ? 'Phản hồi từ Ban Quản Lý' : 'Ghi chú của bạn';
              return (
                <article className={`event-application-card is-${application.status}`} key={application.id}>
                  <div className="event-application-status-rail" />
                  <EventThumbnail imageUrl={application.imageUrl} title={application.eventTitle} />
                  <div className="event-application-main">
                    <div className="event-application-heading">
                      <span className="event-application-kicker">Hồ sơ #{application.id}</span>
                      <h3>{application.eventTitle}</h3>
                    </div>
                    <div className="event-application-timeline">
                      <span><CalendarDays size={16} />{application.dateRange || 'Lịch sự kiện đang cập nhật'}</span>
                      <span className="event-application-meta-divider" aria-hidden="true" />
                      <span><Clock3 size={16} />Nộp lúc {formatDateTime(application.submittedAt)}</span>
                    </div>
                    {previewNote && <div className={`event-application-preview ${application.reviewNote ? 'is-review' : ''}`}><MessageSquare size={16} /><div><strong>{previewLabel}</strong><p>{previewNote}</p></div></div>}
                  </div>
                  <div className="event-application-actions">
                    <span className={`event-status-pill is-${application.status}`}><span />{STATUS_LABELS[application.status]}</span>
                    <button type="button" className="event-card-primary-action" onClick={() => setDetailApplication(application)}><FileText size={16} /> Xem hồ sơ <ArrowRight size={16} /></button>
                    {application.status === 'pending' && <button type="button" className="event-card-danger-action" onClick={() => openWithdrawDialog(application)}><Undo2 size={15} /> Rút hồ sơ</button>}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleApplications.length > 0 && (
            <nav className="event-application-pagination" aria-label="Phân trang hồ sơ tham gia">
              <p>
                Hiển thị <strong>{applicationRangeStart + 1}–{Math.min(applicationRangeStart + APPLICATIONS_PER_PAGE, visibleApplications.length)}</strong>
                {' '}trong tổng số <strong>{visibleApplications.length}</strong> hồ sơ
              </p>
              {applicationPageCount > 1 && (
                <div className="event-pagination-controls">
                  <button type="button" onClick={() => setApplicationPage(currentApplicationPage - 1)} disabled={currentApplicationPage === 1} aria-label="Trang hồ sơ trước">Trước</button>
                  {paginationItems(currentApplicationPage, applicationPageCount).map((item, index) => item === 'ellipsis'
                    ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
                    : <button type="button" key={item} onClick={() => setApplicationPage(item)} className={item === currentApplicationPage ? 'is-active' : ''} aria-current={item === currentApplicationPage ? 'page' : undefined} aria-label={`Trang hồ sơ ${item}`}>{item}</button>)}
                  <button type="button" onClick={() => setApplicationPage(currentApplicationPage + 1)} disabled={currentApplicationPage === applicationPageCount} aria-label="Trang hồ sơ tiếp theo">Tiếp</button>
                </div>
              )}
            </nav>
          )}
          {visibleApplications.length === 0 && (
            <div className="event-hub-empty">
              <FileText size={30} /><h2>{search ? 'Không tìm thấy hồ sơ phù hợp' : 'Chưa có hồ sơ ở trạng thái này'}</h2>
              <p>Khám phá các sự kiện đang mở để bắt đầu hành trình tham gia cùng Đường Sách.</p>
              <button type="button" onClick={() => { setSearch(''); navigate('/partner/events/apply'); }}>Xem sự kiện đang mở <ArrowRight size={15} /></button>
            </div>
          )}
        </section>
      )}

      {applicationEvent && (
        <PartnerDialog title="Đăng ký tham gia sự kiện" onClose={() => !processingId && setApplicationEvent(null)}>
          <div className="partner-dialog-body event-application-modal">
            <span className="event-modal-eyebrow"><CalendarDays size={15} /> Sự kiện đang nhận đăng ký</span>
            <h3 className="partner-dialog-event-title">{applicationEvent.name}</h3>
            <p>{applicationEvent.description || 'Thông tin mô tả đang được cập nhật.'}</p>
            <div className="event-modal-meta">
              <span><CalendarDays size={15} />{formatDateTime(applicationEvent.startAt)} – {formatDateTime(applicationEvent.endAt)}</span>
              <span><Clock3 size={15} />Hạn đăng ký: {formatDateTime(applicationEvent.partnerApplicationDeadlineAt)}</span>
            </div>
            <label htmlFor="event-application-note">Ghi chú đăng ký (không bắt buộc)</label>
            <textarea id="event-application-note" rows={5} value={applicationNote} onChange={event => setApplicationNote(event.target.value)} placeholder="Mô tả nhu cầu trưng bày, thể loại sách và nguyện vọng tham gia sự kiện…" disabled={Boolean(processingId)} />
            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setApplicationEvent(null)} disabled={Boolean(processingId)}>Để sau</button>
              <button
                type="button"
                className="btn-part-primary"
                onClick={() => void submitApplication()}
                disabled={Boolean(processingId) || !applicationEvent.acceptingApplications || !organization || organization.status !== 'ACTIVE'}
              >
                <Send size={16} />{processingId ? 'Đang gửi…' : 'Gửi hồ sơ đăng ký'}
              </button>
            </div>
          </div>
        </PartnerDialog>
      )}

      {detailApplication && (
        <PartnerDialog title="Chi tiết hồ sơ tham gia" onClose={() => setDetailApplication(null)}>
          <div className="partner-dialog-body event-application-modal">
            <span className={`event-status-pill is-${detailApplication.status}`}><span />{STATUS_LABELS[detailApplication.status]}</span>
            <h3 className="partner-dialog-event-title">{detailApplication.eventTitle}</h3>
            <div className="event-modal-meta">
              <span><CalendarDays size={15} />{detailApplication.dateRange || 'Lịch sự kiện đang cập nhật'}</span>
              <span><Clock3 size={15} />Nộp lúc: {formatDateTime(detailApplication.submittedAt)}</span>
            </div>
            <div className="event-modal-note"><span>Ghi chú đăng ký</span><p>{detailApplication.applicationNote || 'Không có ghi chú.'}</p></div>
            <div className="event-modal-note is-review"><span>Phản hồi từ Ban Quản Lý</span><p>{detailApplication.reviewNote || 'Chưa có phản hồi.'}</p></div>
            <div className="partner-dialog-actions">
              {detailApplication.status === 'pending' && <button type="button" className="btn-part-danger" onClick={() => openWithdrawDialog(detailApplication)}><Undo2 size={15} />Rút hồ sơ</button>}
              <button type="button" className="btn-part-primary" onClick={() => setDetailApplication(null)}>Đóng</button>
            </div>
          </div>
        </PartnerDialog>
      )}

      {withdrawTarget && (
        <PartnerDialog title="Xác nhận rút hồ sơ" onClose={() => !processingId && setWithdrawTarget(null)}>
          <div className="partner-dialog-body event-withdraw-dialog">
            <span className="event-withdraw-icon"><AlertCircle size={25} /></span>
            <h3>{withdrawTarget.eventTitle}</h3>
            <p>Sau khi rút, hồ sơ sẽ không thể đăng ký lại cho cùng sự kiện. Bạn có chắc muốn tiếp tục?</p>
            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setWithdrawTarget(null)} disabled={Boolean(processingId)}>Giữ hồ sơ</button>
              <button type="button" className="btn-part-danger" onClick={() => void withdrawApplication()} disabled={Boolean(processingId)}><Undo2 size={15} />{processingId ? 'Đang rút…' : 'Xác nhận rút hồ sơ'}</button>
            </div>
          </div>
        </PartnerDialog>
      )}
    </div>
  );
};
