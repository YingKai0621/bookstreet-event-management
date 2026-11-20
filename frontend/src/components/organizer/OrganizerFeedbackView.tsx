import {
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import {
  OrganizerFeedbackDetail,
  OrganizerFeedbackListItem,
  OrganizerFeedbackStatus,
  OrganizerFeedbackTargetType,
  organizerApi,
} from '../../services/organizerApi';
import { Language } from '../../types';
import './OrganizerFeedbackView.css';

const PAGE_SIZE = 10;

const COPY = {
  vi: {
    heading: 'Góp ý trải nghiệm',
    subtitle: 'Hàng đợi dùng chung cho toàn bộ Ban Tổ chức. Ghi chú xử lý chỉ dùng nội bộ.',
    total: 'Tổng góp ý', search: 'Tìm theo nội dung góp ý', searchPlaceholder: 'Nhập nội dung cần tìm...',
    senderSearch: 'Người gửi hoặc email', senderPlaceholder: 'Nhập tên người gửi hoặc email...',
    eventNameSearch: 'Tên sự kiện', eventNamePlaceholder: 'Nhập tên sự kiện...',
    allStatuses: 'Tất cả trạng thái', newStatus: 'Mới tiếp nhận', inProgressStatus: 'Đang xử lý', resolvedStatus: 'Đã giải quyết',
    allTargets: 'Tất cả phạm vi', bookStreetTarget: 'Toàn Đường Sách', eventTarget: 'Sự kiện', bookStreetName: 'Đường Sách TP.HCM',
    statusFilter: 'Trạng thái', targetFilter: 'Phạm vi',
    sort: 'Sắp xếp', newest: 'Mới nhất trước', oldest: 'Cũ nhất trước', loadingQueue: 'Đang tải góp ý…', retry: 'Thử lại',
    empty: 'Không tìm thấy góp ý nào. Hãy thử từ khóa hoặc trạng thái khác.', viewDetail: 'Xem chi tiết', previousPage: 'Trang trước', nextPage: 'Trang sau', page: 'Trang',
    detailTitle: 'Chi tiết góp ý', close: 'Đóng', loadingDetail: 'Đang tải chi tiết…', detailFailure: 'Không tải được chi tiết góp ý.',
    sentAt: 'Gửi lúc', anonymous: 'Khách ẩn danh', noEmail: 'Không cung cấp email', messageTitle: 'Nội dung góp ý', handledBy: 'Xử lý gần nhất:',
    noteLabel: 'Ghi chú nội bộ', noteHelp: 'Chỉ Ban Tổ chức xem được. Nội dung này không gửi cho khách.',
    notePlaceholder: 'Nhập kết quả hoặc hướng xử lý nội bộ...', notSent: 'Không gửi cho khách',
    start: 'Xử lý góp ý', resolve: 'Đánh dấu đã giải quyết', reopen: 'Mở lại xử lý', updating: 'Đang cập nhật…',
    noteValidation: 'Ghi chú nội bộ phải có từ 1 đến 1.000 ký tự.',
    conflict: 'Góp ý vừa được Organizer khác cập nhật. Dữ liệu mới nhất đã được tải lại.',
    forbidden: 'Tài khoản hiện tại không có quyền Organizer để xem hàng đợi góp ý.',
    unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    queueFailure: 'Không tải được hàng đợi góp ý.',
  },
  en: {
    heading: 'Experience feedback',
    subtitle: 'A shared queue for the Management Board. Handling notes are for internal use only.',
    total: 'Total feedback', search: 'Search feedback content', searchPlaceholder: 'Enter feedback content...',
    senderSearch: 'Sender or email', senderPlaceholder: 'Enter sender name or email...',
    eventNameSearch: 'Event name', eventNamePlaceholder: 'Enter event name...',
    allStatuses: 'All statuses', newStatus: 'New', inProgressStatus: 'In progress', resolvedStatus: 'Resolved',
    allTargets: 'All scopes', bookStreetTarget: 'Whole Book Street', eventTarget: 'Event', bookStreetName: 'HCMC Book Street',
    statusFilter: 'Status', targetFilter: 'Scope',
    sort: 'Sort', newest: 'Newest first', oldest: 'Oldest first', loadingQueue: 'Loading feedback…', retry: 'Retry',
    empty: 'No feedback matches the current filters.', viewDetail: 'View details', previousPage: 'Previous', nextPage: 'Next', page: 'Page',
    detailTitle: 'Feedback details', close: 'Close', loadingDetail: 'Loading details…', detailFailure: 'Unable to load feedback details.',
    sentAt: 'Submitted', anonymous: 'Anonymous guest', noEmail: 'No contact email', messageTitle: 'Feedback message', handledBy: 'Last handled by:',
    noteLabel: 'Internal note', noteHelp: 'Visible only to the Management Board. This is not sent to the guest.',
    notePlaceholder: 'Enter the internal outcome or handling direction...', notSent: 'Not sent to the guest',
    start: 'Handle feedback', resolve: 'Mark as resolved', reopen: 'Reopen handling', updating: 'Updating…',
    noteValidation: 'The internal note must contain between 1 and 1,000 characters.',
    conflict: 'Another Organizer updated this feedback. The latest durable state has been reloaded.',
    forbidden: 'The current account does not have Organizer access to this feedback queue.',
    unauthorized: 'Your session has expired. Please sign in again.',
    queueFailure: 'Unable to load the feedback queue.',
  },
} as const;

function statusLabel(status: OrganizerFeedbackStatus, language: Language): string {
  const copy = COPY[language];
  return {
    NEW: copy.newStatus,
    IN_PROGRESS: copy.inProgressStatus,
    RESOLVED: copy.resolvedStatus,
  }[status];
}

function targetLabel(feedback: OrganizerFeedbackListItem | OrganizerFeedbackDetail, language: Language): string {
  return feedback.targetType === 'EVENT' && feedback.event
    ? feedback.event.name
    : COPY[language].bookStreetName;
}

function formatDate(value: string | null, language: Language): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
}

function queueErrorMessage(error: unknown, language: Language): string {
  const copy = COPY[language];
  if (error instanceof ApiError && error.status === 403) {
    return copy.forbidden;
  }
  if (error instanceof ApiError && error.status === 401) {
    return copy.unauthorized;
  }
  return error instanceof Error ? error.message : copy.queueFailure;
}

export const OrganizerFeedbackView: React.FC<{ language: Language }> = ({ language }) => {
  const copy = COPY[language];
  const queueRequestSequence = useRef(0);
  const detailRequestSequence = useRef(0);
  const [items, setItems] = useState<OrganizerFeedbackListItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<OrganizerFeedbackStatus | ''>('');
  const [targetType, setTargetType] = useState<OrganizerFeedbackTargetType | ''>('');
  const [sort, setSort] = useState<'submittedAt,desc' | 'submittedAt,asc'>('submittedAt,desc');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [senderSearchInput, setSenderSearchInput] = useState('');
  const [senderSearch, setSenderSearch] = useState('');
  const [eventNameSearchInput, setEventNameSearchInput] = useState('');
  const [eventNameSearch, setEventNameSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrganizerFeedbackDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [internalNote, setInternalNote] = useState('');

  const closeDetail = useCallback(() => {
    if (actionLoading) return;
    detailRequestSequence.current += 1;
    setSelectedId(null);
    setDetail(null);
    setActionError('');
    setInternalNote('');
  }, [actionLoading]);
  useModalDismiss(selectedId !== null, closeDetail);

  useEffect(() => () => {
    queueRequestSequence.current += 1;
    detailRequestSequence.current += 1;
  }, []);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    const nextSenderSearch = senderSearchInput.trim();
    const nextEventNameSearch = eventNameSearchInput.trim();
    if (
      nextSearch === search
      && nextSenderSearch === senderSearch
      && nextEventNameSearch === eventNameSearch
    ) return;

    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(nextSearch);
      setSenderSearch(nextSenderSearch);
      setEventNameSearch(nextEventNameSearch);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [eventNameSearch, eventNameSearchInput, search, searchInput, senderSearch, senderSearchInput]);

  const loadQueue = useCallback(async () => {
    const requestSequence = ++queueRequestSequence.current;
    setLoading(true);
    try {
      const response = await organizerApi.listFeedbacks({
        page,
        size: PAGE_SIZE,
        sort,
        search: search || undefined,
        senderSearch: senderSearch || undefined,
        eventNameSearch: eventNameSearch || undefined,
        status: status || undefined,
        targetType: targetType || undefined,
      });
      if (requestSequence !== queueRequestSequence.current) return;

      const lastPage = Math.max(0, response.totalPages - 1);
      if (page > lastPage) {
        setTotalElements(response.totalElements);
        setTotalPages(response.totalPages);
        setPage(lastPage);
        return;
      }
      setItems(response.content);
      setTotalElements(response.totalElements);
      setTotalPages(response.totalPages);
      setQueueError('');
    } catch (error) {
      if (requestSequence !== queueRequestSequence.current) return;
      setItems([]);
      setTotalElements(0);
      setTotalPages(0);
      setQueueError(queueErrorMessage(error, language));
    } finally {
      if (requestSequence === queueRequestSequence.current) setLoading(false);
    }
  }, [eventNameSearch, language, page, search, senderSearch, sort, status, targetType]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadQueue());
    return () => window.cancelAnimationFrame(frame);
  }, [loadQueue]);

  const openFeedback = useCallback(async (feedbackId: number) => {
    const requestSequence = ++detailRequestSequence.current;
    setSelectedId(feedbackId);
    setDetail(null);
    setDetailLoading(true);
    setActionError('');
    try {
      const response = await organizerApi.getFeedback(feedbackId);
      if (requestSequence !== detailRequestSequence.current) return;
      setDetail(response);
      setInternalNote(response.internalNote || '');
    } catch (error) {
      if (requestSequence !== detailRequestSequence.current) return;
      setActionError(queueErrorMessage(error, language));
    } finally {
      if (requestSequence === detailRequestSequence.current) setDetailLoading(false);
    }
  }, [language]);

  const refreshDurableState = useCallback(async (feedbackId: number) => {
    const requestSequence = ++detailRequestSequence.current;
    const refreshed = await organizerApi.getFeedback(feedbackId);
    if (requestSequence !== detailRequestSequence.current) return;
    setDetail(refreshed);
    setInternalNote(refreshed.internalNote || '');
    await loadQueue();
  }, [loadQueue]);

  const runAction = async () => {
    if (!detail) return;
    const normalizedNote = internalNote.trim().replace(/\s+/gu, ' ');
    if (detail.status === 'IN_PROGRESS'
      && (normalizedNote.length < 1 || [...normalizedNote].length > 1000)) {
      setActionError(copy.noteValidation);
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const updated = detail.status === 'NEW'
        ? await organizerApi.startHandlingFeedback(detail.feedbackId)
        : detail.status === 'IN_PROGRESS'
          ? await organizerApi.resolveFeedback(detail.feedbackId, normalizedNote)
          : await organizerApi.reopenFeedback(detail.feedbackId);
      setDetail(updated);
      setInternalNote(updated.internalNote || '');
      await loadQueue();
    } catch (error) {
      const conflict = error instanceof ApiError && error.status === 409;
      setActionError(conflict
        ? copy.conflict
        : queueErrorMessage(error, language));
      try {
        await refreshDurableState(detail.feedbackId);
      } catch {
        await loadQueue();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const actionLabel = detail?.status === 'NEW'
    ? copy.start
    : detail?.status === 'IN_PROGRESS'
      ? copy.resolve
      : copy.reopen;
  const ActionIcon = detail?.status === 'NEW'
    ? PlayCircle
    : detail?.status === 'IN_PROGRESS'
      ? CheckCircle2
      : RotateCcw;

  return <section className="organizer-content organizer-feedback-page">
    <header className="organizer-feedback-heading">
      <div>
        <h1 className="organizer-view-title workspace-page-title">
          {copy.heading}
        </h1>
        <p className="organizer-view-sub workspace-page-subtitle">
          {copy.subtitle}
        </p>
      </div>
      <div className="organizer-feedback-total" aria-label={`${copy.total}: ${totalElements}`}>
        <strong>{totalElements}</strong><span>{copy.total}</span>
      </div>
    </header>

    <div className="organizer-feedback-toolbar">
      <label className="organizer-feedback-filter-field">
        <span>{copy.search}</span>
        <span className="organizer-feedback-search-control">
          <Search size={17} aria-hidden="true" />
          <input aria-label={copy.search} value={searchInput} maxLength={100} onChange={event => setSearchInput(event.target.value)} placeholder={copy.searchPlaceholder} />
        </span>
      </label>
      <label className="organizer-feedback-filter-field">
        <span>{copy.senderSearch}</span>
        <input aria-label={copy.senderSearch} value={senderSearchInput} maxLength={100} onChange={event => setSenderSearchInput(event.target.value)} placeholder={copy.senderPlaceholder} />
      </label>
      <label className="organizer-feedback-filter-field">
        <span>{copy.eventNameSearch}</span>
        <input aria-label={copy.eventNameSearch} value={eventNameSearchInput} maxLength={100} disabled={targetType === 'BOOK_STREET'} onChange={event => setEventNameSearchInput(event.target.value)} placeholder={copy.eventNamePlaceholder} />
      </label>
      <label className="organizer-feedback-filter-field">
        <span>{copy.statusFilter}</span>
        <select value={status} onChange={event => { setPage(0); setStatus(event.target.value as OrganizerFeedbackStatus | ''); }} aria-label={copy.statusFilter}>
          <option value="">{copy.allStatuses}</option>
          <option value="NEW">{copy.newStatus}</option>
          <option value="IN_PROGRESS">{copy.inProgressStatus}</option>
          <option value="RESOLVED">{copy.resolvedStatus}</option>
        </select>
      </label>
      <label className="organizer-feedback-filter-field">
        <span>{copy.targetFilter}</span>
        <select value={targetType} onChange={event => {
          const value = event.target.value as OrganizerFeedbackTargetType | '';
          setPage(0);
          setTargetType(value);
          if (value === 'BOOK_STREET') {
            setEventNameSearchInput('');
            setEventNameSearch('');
          }
        }} aria-label={copy.targetFilter}>
          <option value="">{copy.allTargets}</option>
          <option value="BOOK_STREET">{copy.bookStreetTarget}</option>
          <option value="EVENT">{copy.eventTarget}</option>
        </select>
      </label>
      <label className="organizer-feedback-filter-field">
        <span>{copy.sort}</span>
        <select value={sort} onChange={event => { setPage(0); setSort(event.target.value as typeof sort); }} aria-label={copy.sort}>
          <option value="submittedAt,desc">{copy.newest}</option>
          <option value="submittedAt,asc">{copy.oldest}</option>
        </select>
      </label>
    </div>

    {loading && <div className="organizer-feedback-state"><LoaderCircle className="is-spinning" /><p>{copy.loadingQueue}</p></div>}
    {!loading && queueError && <div className="organizer-feedback-state is-error" role="alert">
      <p>{queueError}</p>
      <button type="button" className="btn-org-secondary" onClick={() => void loadQueue()}><RefreshCw size={16} />{copy.retry}</button>
    </div>}
    {!loading && !queueError && items.length === 0 && <div className="organizer-feedback-state">
      <MessageSquare size={34} aria-hidden="true" /><p>{copy.empty}</p>
    </div>}
    {!loading && !queueError && items.length > 0 && <div className="organizer-feedback-list">
      {items.map(item => <article className="organizer-feedback-card" key={item.feedbackId}>
        <div className="organizer-feedback-card-main">
          <div className="organizer-feedback-card-title">
            <strong>{targetLabel(item, language)}</strong>
            <span className={`organizer-feedback-status is-${item.status.toLowerCase()}`}>{statusLabel(item.status, language)}</span>
          </div>
          <p>{item.messagePreview}</p>
          <small><CalendarClock size={14} />{formatDate(item.submittedAt, language)}</small>
        </div>
        <button type="button" className="btn-org-secondary" onClick={() => void openFeedback(item.feedbackId)}>{copy.viewDetail}</button>
      </article>)}
    </div>}

    {!loading && !queueError && totalPages > 0 && <nav className="organizer-feedback-pagination" aria-label="Phân trang góp ý">
      <button type="button" className="btn-org-secondary" disabled={page === 0} onClick={() => setPage(current => current - 1)}>{copy.previousPage}</button>
      <span>{copy.page} {page + 1}/{totalPages}</span>
      <button type="button" className="btn-org-secondary" disabled={page + 1 >= totalPages} onClick={() => setPage(current => current + 1)}>{copy.nextPage}</button>
    </nav>}

    {selectedId !== null && <div className="org-modal-backdrop organizer-feedback-overlay" role="presentation">
      <div className="org-modal-box organizer-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="organizer-feedback-dialog-title">
        <div className="org-modal-header">
          <div><h3 id="organizer-feedback-dialog-title">{copy.detailTitle}</h3><small>{detail ? targetLabel(detail, language) : `#${selectedId}`}</small></div>
          <button type="button" className="btn-org-secondary" disabled={actionLoading} onClick={closeDetail}>{copy.close}</button>
        </div>
        <div className="org-modal-body organizer-feedback-detail">
          {detailLoading && <div className="organizer-feedback-state"><LoaderCircle className="is-spinning" /><p>{copy.loadingDetail}</p></div>}
          {!detailLoading && !detail && <div className="organizer-feedback-state is-error" role="alert">
            <p>{actionError || copy.detailFailure}</p>
            <button type="button" className="btn-org-secondary" onClick={() => void openFeedback(selectedId)}><RefreshCw size={16} />{copy.retry}</button>
          </div>}
          {detail && <>
            <div className="organizer-feedback-detail-meta">
              <span className={`organizer-feedback-status is-${detail.status.toLowerCase()}`}>{statusLabel(detail.status, language)}</span>
              <span><CalendarClock size={15} />{copy.sentAt} {formatDate(detail.submittedAt, language)}</span>
              <span><UserRound size={15} />{detail.guestName || detail.submitter?.fullName || copy.anonymous}</span>
              <span><Mail size={15} />{detail.contactEmail || copy.noEmail}</span>
            </div>
            <section className="organizer-feedback-message"><h4>{copy.messageTitle}</h4><p>{detail.message}</p></section>
            {detail.lastHandledBy && <p className="organizer-feedback-handler">{copy.handledBy} <strong>{detail.lastHandledBy.fullName}</strong> · {formatDate(detail.updatedAt, language)}</p>}
            {detail.status === 'IN_PROGRESS' ? <label className="organizer-feedback-note">
              <span>{copy.noteLabel} <strong>*</strong></span>
              <small>{copy.noteHelp}</small>
              <textarea value={internalNote} onChange={event => setInternalNote(event.target.value)} rows={5} maxLength={1100} placeholder={copy.notePlaceholder} />
            </label> : detail.internalNote && <section className="organizer-feedback-message is-note">
              <h4>{copy.noteLabel}</h4><small>{copy.notSent}</small><p>{detail.internalNote}</p>
            </section>}
            {actionError && <div className="organizer-feedback-inline-error" role="alert">{actionError}</div>}
          </>}
        </div>
        {detail && <div className="org-modal-footer">
          <button type="button" className="btn-org-secondary" disabled={actionLoading} onClick={closeDetail}>{copy.close}</button>
          <button type="button" className="btn-org-primary" disabled={actionLoading} onClick={() => void runAction()}>
            {actionLoading ? <LoaderCircle className="is-spinning" size={16} /> : <ActionIcon size={16} />}
            {actionLoading ? copy.updating : actionLabel}
          </button>
        </div>}
      </div>
    </div>}
  </section>;
};
