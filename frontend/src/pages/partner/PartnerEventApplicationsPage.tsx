import { clampPage, getPageCount, getPageOffset, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../../components/ui/ListPagination';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  MessageSquare,
  Search,
  Trash2,
  Undo2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
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
  const [deleteTarget, setDeleteTarget] = useState<PartnerEventApplication | null>(null);
  const [dismissedWithdrawnIds, setDismissedWithdrawnIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bookstreet_partner_dismissed_withdrawn_apps') || '[]');
    } catch {
      return [];
    }
  });
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
      const requestedApplicationId = new URLSearchParams(location.search).get('application');
      if (requestedApplicationId) {
        setDetailApplication(ownApplications.find(application => application.id === requestedApplicationId) || null);
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

  const activeApps = useMemo(() => applications.filter(app => !dismissedWithdrawnIds.includes(app.id)), [applications, dismissedWithdrawnIds]);

  const counts = useMemo(() => ({
    all: activeApps.length,
    pending: activeApps.filter(application => application.status === 'pending').length,
    approved: activeApps.filter(application => application.status === 'approved').length,
    rejected: activeApps.filter(application => application.status === 'rejected').length,
    withdrawn: activeApps.filter(application => application.status === 'withdrawn').length,
  }), [applications]);

  const keyword = search.trim().toLocaleLowerCase('vi');
  const visibleApplications = useMemo(() => activeApps
    .filter(application => {
      if (activeFilter !== 'all' && application.status !== activeFilter) return false;
      if (!matchesTimeFilter(application.endAt, timeFilter, filterReferenceTime)) return false;
      return !keyword || [application.id, application.eventTitle, application.applicationNote, application.reviewNote]
        .some(value => value.toLocaleLowerCase('vi').includes(keyword));
    })
    .sort((left, right) => {
      const difference = partnerEventTimestamp(right.submittedAt) - partnerEventTimestamp(left.submittedAt);
      return sortOrder === 'newest' ? difference : -difference;
    }), [activeFilter, activeApps, filterReferenceTime, keyword, sortOrder, timeFilter]);

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

  const handleDeleteWithdrawn = (id: string) => {
    setDismissedWithdrawnIds(prev => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('bookstreet_partner_dismissed_withdrawn_apps', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
    setDeleteTarget(null);
    setSuccessMessage('Đã xóa hồ sơ đã rút khỏi danh sách.');
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
        <div className="event-hub-search">
          <Search size={18} />
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setApplicationPage(1); }} placeholder="Tìm theo tên sự kiện, mã hồ sơ hoặc nội dung…" aria-label="Tìm kiếm hồ sơ sự kiện" />
        </div>
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
            <label className="event-hub-select-field"><span>Sắp xếp hồ sơ</span><div><ArrowUpDown size={15} /><select value={sortOrder} onChange={event => { setSortOrder(event.target.value as SortOrder); setApplicationPage(1); }} aria-label="Sắp xếp hồ sơ"><option value="newest">Nộp mới nhất</option><option value="oldest">Nộp cũ nhất</option></select><ChevronDown size={15} /></div></label>
            <label className="event-hub-select-field"><span>Thời gian sự kiện</span><div><CalendarDays size={15} /><select value={timeFilter} onChange={event => { setTimeFilter(event.target.value as TimeFilter); setApplicationPage(1); }} aria-label="Lọc theo thời gian sự kiện"><option value="all">Tất cả thời gian</option><option value="active">Sắp/đang diễn ra</option><option value="past">Đã kết thúc</option></select><ChevronDown size={15} /></div></label>
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
                    {application.status === 'withdrawn' && (
                      <button
                        type="button"
                        className="event-card-delete-action"
                        onClick={() => setDeleteTarget(application)}
                        title="Xóa hồ sơ đã rút khỏi danh sách"
                      >
                        <Trash2 size={15} /> Xóa hồ sơ
                      </button>
                    )}
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
        <PartnerDialog title="Rút hồ sơ?" onClose={() => !processingId && setWithdrawTarget(null)}>
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

            <p className="event-withdraw-irrevocable">Không thể đăng ký lại sự kiện này.</p>

            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setWithdrawTarget(null)} disabled={Boolean(processingId)}>Giữ hồ sơ</button>
              <button type="button" className="btn-part-danger" onClick={() => void withdrawApplication()} disabled={Boolean(processingId)}>
                <Undo2 size={16} />{processingId ? 'Đang rút…' : 'Rút hồ sơ'}
              </button>
            </div>
          </div>
        </PartnerDialog>
      )}

      {deleteTarget && (
        <PartnerDialog title="Xác nhận xóa hồ sơ" onClose={() => setDeleteTarget(null)}>
          <div className="partner-dialog-body event-withdraw-dialog">
            <div className="event-withdraw-hero">
              <span className="event-withdraw-icon"><Trash2 size={24} /></span>
              <div className="event-withdraw-hero-text">
                <h4>Xóa hồ sơ đã rút khỏi danh sách?</h4>
                <p>Hồ sơ này đã rút trước đó và sẽ được gỡ bỏ khỏi danh sách theo dõi của bạn.</p>
              </div>
            </div>

            <div className="event-withdraw-summary-card">
              <div className="event-withdraw-summary-top">
                <span className="event-withdraw-summary-kicker">Hồ sơ #{deleteTarget.id}</span>
                <span className="event-status-pill is-withdrawn"><span />Đã rút</span>
              </div>
              <h3>{deleteTarget.eventTitle}</h3>
              <div className="event-withdraw-summary-meta">
                <span><CalendarDays size={14} />{deleteTarget.dateRange || 'Lịch sự kiện đang cập nhật'}</span>
                <span><Clock3 size={14} />Nộp lúc {formatPartnerEventDateTime(deleteTarget.submittedAt)}</span>
              </div>
            </div>

            <div className="partner-dialog-actions">
              <button type="button" className="btn-part-secondary" onClick={() => setDeleteTarget(null)}>Hủy</button>
              <button type="button" className="btn-part-danger" onClick={() => handleDeleteWithdrawn(deleteTarget.id)}>
                <Trash2 size={16} /> Xóa hồ sơ
              </button>
            </div>
          </div>
        </PartnerDialog>
      )}
    </div>
  );
};
