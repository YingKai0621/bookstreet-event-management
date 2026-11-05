import { clampPage, getPageCount, getPageOffset, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../../components/ui/ListPagination';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  Search,
  Undo2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
import { PartnerFilterSelect } from '../../components/partner/PartnerFilterSelect';
import { SearchFieldLabel } from '../../components/ui/SearchFieldLabel';
import '../../components/partner/PartnerEvents.css';
import { partnerApi } from '../../services/partnerApi';
import { Language, PartnerEventApplication } from '../../types';
import {
  PartnerApplicationThumbnail,
  PartnerEventHero,
  PartnerEventLoading,
} from './PartnerEventPageShared';
import {
  formatPartnerEventDateTime,
  PARTNER_APPLICATION_STATUS_LABELS,
  partnerApplicationErrorMessage,
  partnerEventTimestamp,
} from './PartnerEventPageUtils';
import './PartnerPages.css';

interface PartnerEventApplicationsPageProps {
  language: Language;
}

type ApplicationFilter = 'all' | PartnerEventApplication['status'];
type SortOrder = 'newest' | 'oldest';
type TimeFilter = 'all' | 'active' | 'past';
const APPLICATIONS_PER_PAGE = LIST_PAGE_SIZE;


function matchesTimeFilter(endAt: string | undefined, timeFilter: TimeFilter, now: number): boolean {
  if (timeFilter === 'all') return true;
  const endTimestamp = partnerEventTimestamp(endAt);
  if (!endTimestamp) return timeFilter === 'active';
  return timeFilter === 'past' ? endTimestamp < now : endTimestamp >= now;
}


export const PartnerEventApplicationsPage: React.FC<PartnerEventApplicationsPageProps> = ({ language }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<PartnerEventApplication[]>([]);
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [applicationPage, setApplicationPage] = useState(1);
  const [filterReferenceTime] = useState(() => Date.now());
  const [detailApplication, setDetailApplication] = useState<PartnerEventApplication | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<PartnerEventApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadApplications = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const ownApplications = await partnerApi.getApplications();
      setApplications(ownApplications);
      const params = new URLSearchParams(location.search);
      const requestedApplicationId = params.get('application');
      const requestedEventId = params.get('eventId');
      if (requestedApplicationId || requestedEventId) {
        setDetailApplication(ownApplications.find(application =>
          requestedApplicationId
            ? application.id === requestedApplicationId
            : application.eventId === requestedEventId) || null);
      }
    } catch (error) {
      setErrorMessage(partnerApplicationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [location.search]);

  useEffect(() => {
    // Loading route-owned data is the external synchronization performed by this page.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadApplications();
  }, [loadApplications]);

  const counts = useMemo(() => ({
    all: applications.length,
    pending: applications.filter(application => application.status === 'pending').length,
    approved: applications.filter(application => application.status === 'approved').length,
    rejected: applications.filter(application => application.status === 'rejected').length,
    withdrawn: applications.filter(application => application.status === 'withdrawn').length,
  }), [applications]);

  const keyword = search.trim().toLocaleLowerCase('vi');
  const visibleApplications = useMemo(() => applications
    .filter(application => {
      if (activeFilter !== 'all' && application.status !== activeFilter) return false;
      if (!matchesTimeFilter(application.endAt, timeFilter, filterReferenceTime)) return false;
      return !keyword || [application.id, application.eventTitle, application.applicationNote, application.reviewNote]
        .some(value => value.toLocaleLowerCase('vi').includes(keyword));
    })
    .sort((left, right) => {
      const difference = partnerEventTimestamp(right.submittedAt) - partnerEventTimestamp(left.submittedAt);
      return sortOrder === 'newest' ? difference : -difference;
    }), [activeFilter, applications, filterReferenceTime, keyword, sortOrder, timeFilter]);

  const applicationPageCount = getPageCount(visibleApplications.length, APPLICATIONS_PER_PAGE);
  const currentApplicationPage = clampPage(applicationPage, applicationPageCount);
  if (applicationPage !== currentApplicationPage) setApplicationPage(currentApplicationPage);
  const applicationRangeStart = getPageOffset(currentApplicationPage, APPLICATIONS_PER_PAGE);
  const paginatedApplications = visibleApplications.slice(applicationRangeStart, applicationRangeStart + APPLICATIONS_PER_PAGE);

  const filters: Array<{ value: ApplicationFilter; label: string; count: number }> = [
    { value: 'all', label: 'Tất cả hồ sơ', count: counts.all },
    { value: 'approved', label: 'Đã duyệt', count: counts.approved },
    { value: 'pending', label: 'Chờ duyệt', count: counts.pending },
    { value: 'rejected', label: 'Từ chối', count: counts.rejected },
    { value: 'withdrawn', label: 'Đã rút', count: counts.withdrawn },
  ];

  const closeDetail = () => {
    setDetailApplication(null);
    if (location.search) navigate('/partner/events', { replace: true });
  };

  const openWithdrawDialog = (application: PartnerEventApplication) => {
    setDetailApplication(null);
    setWithdrawTarget(application);
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
      setErrorMessage(partnerApplicationErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const filteredHeading = activeFilter === 'all'
    ? 'Hồ sơ sự kiện của bạn'
    : filters.find(item => item.value === activeFilter)?.label;

  return (
    <div className="partner-page partner-event-hub">
      <PartnerEventHero
        title={language === 'vi' ? 'Hồ sơ sự kiện của tôi' : 'My event applications'}
        breadcrumb="HỒ SƠ SỰ KIỆN"
        description="Theo dõi tiến độ xét duyệt, xem phản hồi và quản lý toàn bộ hồ sơ sự kiện đã gửi."
        isLoading={isLoading}
        onRefresh={() => void loadApplications()}
      />

      {errorMessage && <div role="alert" className="partner-form-alert error"><AlertCircle size={18} /><span>{errorMessage}</span></div>}
      {successMessage && <div role="status" className="partner-form-alert success"><CheckCircle2 size={18} /><span>{successMessage}</span></div>}

      <section className="event-hub-controls" aria-label="Tìm kiếm và lọc hồ sơ sự kiện">
        <div className="event-hub-application-cta">
          <div><strong>Bạn muốn tham gia sự kiện mới?</strong><p>Khám phá các sự kiện công khai đang nhận hồ sơ từ đối tác.</p></div>
          <Link to="/partner/events/apply"><BookOpen size={18} />Đăng ký sự kiện mới<ArrowRight size={17} /></Link>
        </div>
        <SearchFieldLabel className="event-hub-search-group"><div className="event-hub-search">
          <Search size={18} />
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setApplicationPage(1); }} placeholder="Tìm theo tên sự kiện, mã hồ sơ hoặc nội dung…" aria-label="Tìm kiếm hồ sơ sự kiện" />
        </div></SearchFieldLabel>
        <div className="event-hub-control-row">
          <div className="event-hub-status-group">
            <span className="event-hub-control-label">Trạng thái hồ sơ</span>
            <div className="event-hub-filters" role="tablist" aria-label="Trạng thái hồ sơ">
              {filters.map(filter => (
                <button type="button" role="tab" aria-selected={activeFilter === filter.value} className={`event-hub-filter is-${filter.value} ${activeFilter === filter.value ? 'is-active' : ''}`} key={filter.value} onClick={() => { setActiveFilter(filter.value); setApplicationPage(1); }}>
                  {filter.value !== 'all' && <i aria-hidden="true" />}{filter.label}<span>{filter.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="event-hub-selectors">
            <PartnerFilterSelect
              label="Sắp xếp"
              ariaLabel="Sắp xếp hồ sơ"
              icon={ArrowUpDown}
              value={sortOrder}
              options={[{ value: 'newest', label: 'Nộp mới nhất' }, { value: 'oldest', label: 'Nộp cũ nhất' }]}
              onChange={value => { setSortOrder(value); setApplicationPage(1); }}
            />
            <PartnerFilterSelect
              label="Thời gian sự kiện"
              ariaLabel="Lọc theo thời gian sự kiện"
              icon={CalendarDays}
              value={timeFilter}
              options={[{ value: 'all', label: 'Tất cả thời gian' }, { value: 'active', label: 'Sắp/đang diễn ra' }, { value: 'past', label: 'Đã kết thúc' }]}
              onChange={value => { setTimeFilter(value); setApplicationPage(1); }}
            />
          </div>
        </div>
      </section>

      {isLoading ? <PartnerEventLoading label="Đang tải hồ sơ sự kiện…" /> : (
        <section aria-labelledby="applications-title">
          <div className="event-hub-section-heading"><div><h2 id="applications-title">{filteredHeading}</h2></div><p>{visibleApplications.length} hồ sơ phù hợp</p></div>
          <div className="event-application-list">
            {paginatedApplications.map(application => {
              const previewNote = application.reviewNote || application.applicationNote;
              const previewLabel = application.reviewNote ? 'Phản hồi từ Ban Quản Lý' : 'Ghi chú của bạn';
              return (
                <article className={`event-application-card is-${application.status}`} key={application.id}>
                  <div className="event-application-status-rail" />
                  <PartnerApplicationThumbnail imageUrl={application.imageUrl} title={application.eventTitle} />
                  <div className="event-application-main">
                    <div className="event-application-heading"><span className="event-application-kicker">Hồ sơ #{application.id}</span><h3>{application.eventTitle}</h3></div>
                    <div className="event-application-timeline"><span><CalendarDays size={16} />{application.dateRange || 'Lịch sự kiện đang cập nhật'}</span><span className="event-application-meta-divider" aria-hidden="true" /><span><Clock3 size={16} />Nộp lúc {formatPartnerEventDateTime(application.submittedAt)}</span></div>
                    {previewNote && <div className={`event-application-preview ${application.reviewNote ? 'is-review' : ''}`}><MessageSquare size={16} /><div><strong>{previewLabel}</strong><p>{previewNote}</p></div></div>}
                  </div>
                  <div className="event-application-actions">
                    <span className={`event-status-pill is-${application.status}`}><span />{PARTNER_APPLICATION_STATUS_LABELS[application.status]}</span>
                    <button type="button" className="event-card-primary-action" onClick={() => setDetailApplication(application)}><FileText size={16} /> Xem hồ sơ <ArrowRight size={16} /></button>
                    {application.status === 'pending' && <button type="button" className="event-card-danger-action" onClick={() => openWithdrawDialog(application)}><Undo2 size={15} /> Rút hồ sơ</button>}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleApplications.length > 0 && (
            <div className="event-application-pagination">
              <p>Hiển thị <strong>{applicationRangeStart + 1}–{Math.min(applicationRangeStart + APPLICATIONS_PER_PAGE, visibleApplications.length)}</strong> trong tổng số <strong>{visibleApplications.length}</strong> hồ sơ</p>
              <ListPagination page={currentApplicationPage} pages={applicationPageCount} onPage={setApplicationPage} />
            </div>
          )}
          {visibleApplications.length === 0 && <div className="event-hub-empty"><FileText size={30} /><h2>{search ? 'Không tìm thấy hồ sơ phù hợp' : 'Chưa có hồ sơ ở trạng thái này'}</h2><p>Khám phá các sự kiện đang mở để bắt đầu hành trình tham gia cùng Đường Sách.</p><Link className="event-hub-empty-link" to="/partner/events/apply">Khám phá sự kiện <ArrowRight size={15} /></Link></div>}
        </section>
      )}

      {detailApplication && <PartnerDialog title="Chi tiết hồ sơ tham gia" onClose={closeDetail}><div className="partner-dialog-body event-application-modal"><span className={`event-status-pill is-${detailApplication.status}`}><span />{PARTNER_APPLICATION_STATUS_LABELS[detailApplication.status]}</span><h3 className="partner-dialog-event-title">{detailApplication.eventTitle}</h3><div className="event-modal-meta"><span><CalendarDays size={15} />{detailApplication.dateRange || 'Lịch sự kiện đang cập nhật'}</span><span><Clock3 size={15} />Nộp lúc: {formatPartnerEventDateTime(detailApplication.submittedAt)}</span></div><div className="event-modal-note"><span>Ghi chú đăng ký</span><p>{detailApplication.applicationNote || 'Không có ghi chú.'}</p></div><div className="event-modal-note is-review"><span>Phản hồi từ Ban Quản Lý</span><p>{detailApplication.reviewNote || 'Chưa có phản hồi.'}</p></div><div className="partner-dialog-actions">{detailApplication.status === 'pending' && <button type="button" className="btn-part-danger" onClick={() => openWithdrawDialog(detailApplication)}><Undo2 size={15} />Rút hồ sơ</button>}<button type="button" className="btn-part-primary" onClick={closeDetail}>Đóng</button></div></div></PartnerDialog>}

      {withdrawTarget && (
        <PartnerDialog title="Xác nhận rút hồ sơ" onClose={() => !processingId && setWithdrawTarget(null)}>
          <div className="partner-dialog-body event-withdraw-dialog">
            <div className="event-withdraw-summary-card">
              <div className="event-withdraw-summary-top">
                <span className="event-status-pill is-pending"><span />Chờ duyệt</span>
              </div>
              <h3>{withdrawTarget.eventTitle}</h3>
              <div className="event-withdraw-summary-meta">
                <span><CalendarDays size={14} />{withdrawTarget.dateRange || 'Lịch sự kiện đang cập nhật'}</span>
              </div>
            </div>

            <p className="event-withdraw-irrevocable">Sau khi rút, hồ sơ sẽ không thể đăng ký lại cho cùng sự kiện.</p>

            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setWithdrawTarget(null)} disabled={Boolean(processingId)}>Giữ hồ sơ</button>
              <button type="button" className="btn-part-danger" onClick={() => void withdrawApplication()} disabled={Boolean(processingId)}>
                <Undo2 size={16} />{processingId ? 'Đang rút…' : 'Xác nhận rút hồ sơ'}
              </button>
            </div>
          </div>
        </PartnerDialog>
      )}

    </div>
  );
};
