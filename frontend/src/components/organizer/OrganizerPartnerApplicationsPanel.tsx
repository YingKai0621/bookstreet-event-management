import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import type { OrganizerPartnerApplication } from '../../services/organizerApi';
import type { Language } from '../../types';

type PartnerApplicationStatus = OrganizerPartnerApplication['status'];
type StatusFilter = 'all' | PartnerApplicationStatus;
type ReviewMode = 'approve' | 'reject' | null;

interface OrganizerPartnerApplicationsPanelProps {
  language: Language;
  applications: OrganizerPartnerApplication[];
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  onApprove?: (applicationId: string, reviewNote?: string) => Promise<void>;
  onReject?: (applicationId: string, reviewNote: string) => Promise<void>;
}

const PAGE_SIZE = 5;

const CATEGORY_LABELS: Record<string, { vi: string; en: string }> = {
  PUBLISHER: { vi: 'Nhà xuất bản', en: 'Publisher' },
  BOOKSTORE: { vi: 'Nhà sách', en: 'Bookstore' },
  DISTRIBUTOR: { vi: 'Đơn vị phát hành', en: 'Distributor' },
  ORGANIZATION: { vi: 'Tổ chức', en: 'Organization' },
  COMMUNITY: { vi: 'Tổ chức cộng đồng', en: 'Community organization' },
  OTHER: { vi: 'Khác', en: 'Other' },
};

const STATUS_LABELS: Record<PartnerApplicationStatus, { vi: string; en: string }> = {
  pending: { vi: 'Chờ duyệt', en: 'Pending' },
  approved: { vi: 'Đã duyệt', en: 'Approved' },
  rejected: { vi: 'Từ chối', en: 'Rejected' },
  withdrawn: { vi: 'Đã rút', en: 'Withdrawn' },
};

function categoryLabel(code: string, language: Language): string {
  return CATEGORY_LABELS[code]?.[language] || code.replaceAll('_', ' ');
}

function statusLabel(status: PartnerApplicationStatus, language: Language): string {
  return STATUS_LABELS[status][language];
}

export const OrganizerPartnerApplicationsPanel: React.FC<OrganizerPartnerApplicationsPanelProps> = ({
  language,
  applications,
  isLoading,
  error,
  onRetry,
  onApprove,
  onReject,
}) => {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [page, setPage] = React.useState(1);
  const [selectedApplicationId, setSelectedApplicationId] = React.useState<string | null>(null);
  const [reviewMode, setReviewMode] = React.useState<ReviewMode>(null);
  const [reviewNote, setReviewNote] = React.useState('');
  const [reviewError, setReviewError] = React.useState('');
  const [reviewSuccess, setReviewSuccess] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const drawerRef = React.useRef<HTMLElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const lastTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  const selectedApplication = applications.find(application => application.id === selectedApplicationId) || null;
  const selectedOrganizationLocked = selectedApplication?.partnerOrganizationStatus === 'INACTIVE';
  const pendingCount = applications.filter(application => application.status === 'pending').length;
  const normalizedQuery = query.trim().toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US');
  const filteredApplications = React.useMemo(() => applications.filter(application => {
    const matchesStatus = statusFilter === 'all' || application.status === statusFilter;
    const matchesQuery = normalizedQuery.length === 0
      || application.orgName.toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US').includes(normalizedQuery)
      || categoryLabel(application.categoryCode, language).toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US').includes(normalizedQuery)
      || application.categoryCode.toLocaleLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  }), [applications, language, normalizedQuery, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageApplications = filteredApplications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstVisible = filteredApplications.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastVisible = Math.min(currentPage * PAGE_SIZE, filteredApplications.length);

  const closePanel = React.useCallback(() => {
    setSelectedApplicationId(null);
    setReviewMode(null);
    setReviewNote('');
    setReviewError('');
    setReviewSuccess('');
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    if (!selectedApplicationId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) closePanel();
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePanel, isSubmitting, selectedApplicationId]);

  const openApplication = (applicationId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setSelectedApplicationId(applicationId);
    setReviewMode(null);
    setReviewNote('');
    setReviewError('');
    setReviewSuccess('');
  };

  const applyStatusFilter = (nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setPage(1);
  };

  const beginReview = (mode: Exclude<ReviewMode, null>) => {
    setReviewMode(mode);
    setReviewNote('');
    setReviewError('');
    setReviewSuccess('');
  };

  const submitReview = async () => {
    if (!selectedApplication || !reviewMode || isSubmitting) return;
    if (reviewMode === 'approve' && selectedApplication.partnerOrganizationStatus === 'INACTIVE') return;
    const note = reviewNote.trim();
    if (reviewMode === 'reject' && !note) {
      setReviewError(language === 'vi' ? 'Vui lòng nhập lý do từ chối.' : 'A rejection reason is required.');
      return;
    }

    setIsSubmitting(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      if (reviewMode === 'approve') {
        if (!onApprove) throw new Error(language === 'vi' ? 'Chức năng duyệt chưa sẵn sàng.' : 'Approval is unavailable.');
        await onApprove(selectedApplication.id, note);
        setReviewSuccess(language === 'vi' ? 'Đã duyệt hồ sơ thành công.' : 'Application approved.');
      } else {
        if (!onReject) throw new Error(language === 'vi' ? 'Chức năng từ chối chưa sẵn sàng.' : 'Rejection is unavailable.');
        await onReject(selectedApplication.id, note);
        setReviewSuccess(language === 'vi' ? 'Đã từ chối hồ sơ.' : 'Application rejected.');
      }
      setReviewMode(null);
      setReviewNote('');
    } catch (caught) {
      setReviewError(caught instanceof Error
        ? caught.message
        : (language === 'vi' ? 'Không thể cập nhật hồ sơ.' : 'Could not update the application.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const detailPanel = selectedApplication && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="org-partner-drawer-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) closePanel();
        }}
      >
        <aside
          ref={drawerRef}
          className="org-partner-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="partner-application-title"
        >
          <header className="org-partner-drawer-header">
            <div>
              <span>{language === 'vi' ? 'Hồ sơ đối tác' : 'Partner application'}</span>
              <h2 id="partner-application-title">{selectedApplication.orgName}</h2>
              <p>{categoryLabel(selectedApplication.categoryCode, language)}</p>
              {selectedOrganizationLocked && <p role="status" className="org-partner-review-message is-error">{language === 'vi' ? 'Tổ chức đang bị khóa; không thể duyệt hồ sơ.' : 'Organization is locked; this application cannot be approved.'}</p>}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="org-partner-drawer-close"
              onClick={closePanel}
              disabled={isSubmitting}
              aria-label={language === 'vi' ? 'Đóng chi tiết hồ sơ' : 'Close application details'}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="org-partner-drawer-body">
            <section className="org-partner-detail-section">
              <h3>{language === 'vi' ? 'Thông tin hồ sơ' : 'Application information'}</h3>
              <dl className="org-partner-detail-list">
                <div>
                  <dt>{language === 'vi' ? 'Tổ chức' : 'Organization'}</dt>
                  <dd>{selectedApplication.orgName}{selectedOrganizationLocked && <span className="org-partner-status is-rejected" style={{ marginLeft: '.5rem' }}>{language === 'vi' ? 'Tổ chức bị khóa' : 'Organization locked'}</span>}</dd>
                </div>
                <div>
                  <dt>{language === 'vi' ? 'Loại hình' : 'Category'}</dt>
                  <dd>{categoryLabel(selectedApplication.categoryCode, language)}</dd>
                </div>
                <div>
                  <dt>{language === 'vi' ? 'Ngày nộp' : 'Submitted'}</dt>
                  <dd>{selectedApplication.date}</dd>
                </div>
                <div>
                  <dt>{language === 'vi' ? 'Trạng thái' : 'Status'}</dt>
                  <dd><span className={`org-partner-status is-${selectedApplication.status}`}>{statusLabel(selectedApplication.status, language)}</span></dd>
                </div>
              </dl>
            </section>

            <section className="org-partner-detail-section">
              <h3>{language === 'vi' ? 'Nội dung đăng ký' : 'Application content'}</h3>
              <p className={selectedApplication.applicationNote ? '' : 'is-muted'}>
                {selectedApplication.applicationNote
                  || (language === 'vi' ? 'Đối tác không gửi kèm ghi chú đăng ký.' : 'No application note was provided.')}
              </p>
            </section>

            <section className="org-partner-detail-section">
              <h3>{language === 'vi' ? 'Kết quả xét duyệt' : 'Review result'}</h3>
              {selectedApplication.reviewNote ? (
                <div className="org-partner-review-result">
                  <p>{selectedApplication.reviewNote}</p>
                  {selectedApplication.reviewedAt && <small>{selectedApplication.reviewedAt}</small>}
                </div>
              ) : selectedApplication.status === 'withdrawn' ? (
                <div className="org-partner-review-result">
                  <p>{language === 'vi' ? 'Đối tác đã rút hồ sơ.' : 'The partner withdrew this application.'}</p>
                  {selectedApplication.withdrawnAt && <small>{selectedApplication.withdrawnAt}</small>}
                </div>
              ) : (
                <p className="is-muted">
                  {selectedApplication.status === 'pending'
                    ? (language === 'vi' ? 'Hồ sơ đang chờ Ban Quản Lý xét duyệt.' : 'This application is awaiting review.')
                    : (language === 'vi' ? 'Không có ghi chú xét duyệt.' : 'No review note was provided.')}
                </p>
              )}
            </section>

            {reviewSuccess && (
              <div className="org-partner-review-message is-success" role="status">
                <Check size={17} aria-hidden="true" />
                {reviewSuccess}
              </div>
            )}

            {selectedApplication.status === 'pending' && reviewMode && (
              <section className={`org-partner-review-form is-${reviewMode}`} aria-label={language === 'vi' ? 'Biểu mẫu xét duyệt' : 'Review form'}>
                <label htmlFor="partner-review-note">
                  {reviewMode === 'reject'
                    ? (language === 'vi' ? 'Lý do từ chối *' : 'Rejection reason *')
                    : (language === 'vi' ? 'Ghi chú xét duyệt' : 'Review note')}
                </label>
                <textarea
                  id="partner-review-note"
                  value={reviewNote}
                  onChange={(event) => {
                    setReviewNote(event.target.value);
                    if (reviewError) setReviewError('');
                  }}
                  rows={4}
                  maxLength={1000}
                  placeholder={reviewMode === 'reject'
                    ? (language === 'vi' ? 'Nêu rõ lý do để đối tác biết cần điều chỉnh gì' : 'Explain why the application is rejected')
                    : (language === 'vi' ? 'Không bắt buộc' : 'Optional')}
                  disabled={isSubmitting}
                  aria-describedby={reviewError ? 'partner-review-error' : undefined}
                />
                <div className="org-partner-review-form-meta">
                  <span>{reviewNote.length}/1000</span>
                </div>
                {reviewError && <p id="partner-review-error" className="org-partner-review-error" role="alert">{reviewError}</p>}
                <div className="org-partner-review-form-actions">
                  <button
                    type="button"
                    className="btn-org-secondary"
                    onClick={() => {
                      setReviewMode(null);
                      setReviewNote('');
                      setReviewError('');
                    }}
                    disabled={isSubmitting}
                  >
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className={reviewMode === 'approve' ? 'btn-org-primary' : 'org-partner-reject-confirm'}
                    onClick={() => void submitReview()}
                    disabled={isSubmitting || (reviewMode === 'approve' && selectedOrganizationLocked)}
                  >
                    {isSubmitting
                      ? (language === 'vi' ? 'Đang xử lý…' : 'Submitting…')
                      : reviewMode === 'approve'
                        ? (language === 'vi' ? 'Xác nhận duyệt' : 'Confirm approval')
                        : (language === 'vi' ? 'Xác nhận từ chối' : 'Confirm rejection')}
                  </button>
                </div>
              </section>
            )}
          </div>

          {selectedApplication.status === 'pending' && !reviewMode && (
            <footer className="org-partner-drawer-footer">
              <button type="button" className="org-partner-reject-action" onClick={() => beginReview('reject')}>
                {language === 'vi' ? 'Từ chối' : 'Reject'}
              </button>
              <button type="button" className="btn-org-primary" onClick={() => beginReview('approve')} disabled={selectedOrganizationLocked}>
                <Check size={16} aria-hidden="true" />
                {language === 'vi' ? 'Duyệt hồ sơ' : 'Approve'}
              </button>
            </footer>
          )}
        </aside>
      </div>,
      document.body,
    )
    : null;

  return (
    <section className="org-partner-applications" aria-labelledby="partner-applications-heading">
      <header className="org-partner-applications-heading">
        <div>
          <h2 id="partner-applications-heading">{language === 'vi' ? 'Hồ sơ đăng ký' : 'Partner applications'}</h2>
          <p>{language === 'vi' ? 'Xem nội dung và xét duyệt hồ sơ tham gia sự kiện.' : 'Review applications submitted for this event.'}</p>
        </div>
        {!isLoading && !error && pendingCount > 0 && (
          <button
            type="button"
            className={`org-partner-pending-filter ${statusFilter === 'pending' ? 'is-active' : ''}`}
            onClick={() => applyStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
            aria-pressed={statusFilter === 'pending'}
          >
            <span>{pendingCount}</span>
            {language === 'vi' ? 'chờ duyệt' : 'pending'}
          </button>
        )}
      </header>

      {!isLoading && !error && applications.length > 0 && (
        <div className="org-partner-toolbar">
          <label className="org-partner-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">{language === 'vi' ? 'Tìm tên tổ chức' : 'Search organizations'}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={language === 'vi' ? 'Tìm tên tổ chức…' : 'Search organization…'}
            />
          </label>
          <label className="org-partner-status-filter">
            <span>{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
            <select aria-label={language === 'vi' ? 'Lọc trạng thái hồ sơ' : 'Filter application status'} value={statusFilter} onChange={(event) => applyStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
              <option value="pending">{statusLabel('pending', language)}</option>
              <option value="approved">{statusLabel('approved', language)}</option>
              <option value="rejected">{statusLabel('rejected', language)}</option>
              <option value="withdrawn">{statusLabel('withdrawn', language)}</option>
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="org-partner-table-shell" aria-label={language === 'vi' ? 'Đang tải hồ sơ đối tác' : 'Loading partner applications'}>
          {Array.from({ length: 4 }, (_, index) => <div className="org-partner-row-skeleton" key={index} />)}
        </div>
      ) : error ? (
        <div className="org-partner-state is-error" role="alert">
          <AlertCircle size={25} aria-hidden="true" />
          <div>
            <strong>{language === 'vi' ? 'Không thể tải hồ sơ đối tác' : 'Could not load applications'}</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn-org-secondary" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden="true" />
            {language === 'vi' ? 'Thử lại' : 'Retry'}
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="org-partner-state is-empty">
          <Eye size={27} aria-hidden="true" />
          <strong>{language === 'vi' ? 'Chưa có hồ sơ đăng ký' : 'No applications yet'}</strong>
          <p>{language === 'vi' ? 'Chưa có đối tác nào gửi hồ sơ cho sự kiện này.' : 'No partner has applied to this event.'}</p>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="org-partner-state is-empty">
          <Search size={27} aria-hidden="true" />
          <strong>{language === 'vi' ? 'Không tìm thấy hồ sơ phù hợp' : 'No matching applications'}</strong>
          <p>{language === 'vi' ? 'Hãy thử từ khóa khác hoặc xóa bộ lọc trạng thái.' : 'Try another search term or clear the status filter.'}</p>
          <button type="button" className="btn-org-secondary" onClick={clearFilters}>
            {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <>
          <div className="org-partner-table-shell">
            <table className="org-partner-table">
              <thead>
                <tr>
                  <th>{language === 'vi' ? 'Tổ chức / Loại hình' : 'Organization / Category'}</th>
                  <th>{language === 'vi' ? 'Ngày nộp' : 'Submitted'}</th>
                  <th>{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                  <th>{language === 'vi' ? 'Thao tác' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {pageApplications.map(application => (
                  <tr key={application.id}>
                    <td>
                      <strong>{application.orgName}</strong>
                      {application.partnerOrganizationStatus === 'INACTIVE' && <span className="org-partner-status is-rejected" style={{ marginLeft: '.5rem' }}>{language === 'vi' ? 'Tổ chức bị khóa' : 'Organization locked'}</span>}
                      <span>{categoryLabel(application.categoryCode, language)}</span>
                    </td>
                    <td><span className="org-partner-date">{application.date}</span></td>
                    <td><span className={`org-partner-status is-${application.status}`}>{statusLabel(application.status, language)}</span></td>
                    <td>
                      <button
                        type="button"
                        className="org-partner-view-action"
                        onClick={(event) => openApplication(application.id, event.currentTarget)}
                        aria-label={`${language === 'vi' ? 'Xem hồ sơ' : 'View application'}: ${application.orgName}`}
                      >
                        <Eye size={16} aria-hidden="true" />
                        {language === 'vi' ? 'Xem hồ sơ' : 'View'}
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="org-partner-pagination">
            <p>
              {language === 'vi'
                ? `Hiển thị ${firstVisible}–${lastVisible} trong ${filteredApplications.length} hồ sơ`
                : `Showing ${firstVisible}–${lastVisible} of ${filteredApplications.length} applications`}
            </p>
            <div>
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                aria-label={language === 'vi' ? 'Trang trước' : 'Previous page'}
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <span>{language === 'vi' ? `Trang ${currentPage} / ${totalPages}` : `Page ${currentPage} / ${totalPages}`}</span>
              <button
                type="button"
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                aria-label={language === 'vi' ? 'Trang sau' : 'Next page'}
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </>
      )}

      {detailPanel}
    </section>
  );
};
