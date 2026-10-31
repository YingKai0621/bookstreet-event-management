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
import React, { useCallback, useEffect, useState } from 'react';
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

const STATUS_OPTIONS: Array<{ value: OrganizerFeedbackStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'NEW', label: 'Mới tiếp nhận' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
];

const TARGET_OPTIONS: Array<{ value: OrganizerFeedbackTargetType | ''; label: string }> = [
  { value: '', label: 'Tất cả phạm vi' },
  { value: 'BOOK_STREET', label: 'Toàn Đường Sách' },
  { value: 'EVENT', label: 'Sự kiện' },
];

function statusLabel(status: OrganizerFeedbackStatus): string {
  return {
    NEW: 'Mới tiếp nhận',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Đã xử lý',
  }[status];
}

function targetLabel(feedback: OrganizerFeedbackListItem | OrganizerFeedbackDetail): string {
  return feedback.targetType === 'EVENT' && feedback.event
    ? feedback.event.name
    : 'Đường Sách TP.HCM';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function queueErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản hiện tại không có quyền Organizer để xem hàng đợi góp ý.';
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  return error instanceof Error ? error.message : 'Không tải được hàng đợi góp ý.';
}

export const OrganizerFeedbackView: React.FC<{ language: Language }> = ({ language }) => {
  const [items, setItems] = useState<OrganizerFeedbackListItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<OrganizerFeedbackStatus | ''>('');
  const [targetType, setTargetType] = useState<OrganizerFeedbackTargetType | ''>('');
  const [eventId, setEventId] = useState('');
  const [sort, setSort] = useState<'submittedAt,desc' | 'submittedAt,asc'>('submittedAt,desc');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
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
    setSelectedId(null);
    setDetail(null);
    setActionError('');
    setInternalNote('');
  }, [actionLoading]);
  useModalDismiss(selectedId !== null, closeDetail);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await organizerApi.listFeedbacks({
        page,
        size: PAGE_SIZE,
        sort,
        search: search || undefined,
        status: status || undefined,
        targetType: targetType || undefined,
        eventId: eventId ? Number(eventId) : undefined,
      });
      setItems(response.content);
      setTotalElements(response.totalElements);
      setTotalPages(response.totalPages);
      setQueueError('');
    } catch (error) {
      setItems([]);
      setTotalElements(0);
      setTotalPages(0);
      setQueueError(queueErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [eventId, page, search, sort, status, targetType]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadQueue());
    return () => window.cancelAnimationFrame(frame);
  }, [loadQueue]);

  const openFeedback = async (feedbackId: number) => {
    setSelectedId(feedbackId);
    setDetail(null);
    setDetailLoading(true);
    setActionError('');
    try {
      const response = await organizerApi.getFeedback(feedbackId);
      setDetail(response);
      setInternalNote(response.internalNote || '');
    } catch (error) {
      setActionError(queueErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDurableState = useCallback(async (feedbackId: number) => {
    const refreshed = await organizerApi.getFeedback(feedbackId);
    setDetail(refreshed);
    setInternalNote(refreshed.internalNote || '');
    await loadQueue();
  }, [loadQueue]);

  const runAction = async () => {
    if (!detail) return;
    const normalizedNote = internalNote.trim().replace(/\s+/gu, ' ');
    if (detail.status === 'IN_PROGRESS'
      && (normalizedNote.length < 1 || [...normalizedNote].length > 1000)) {
      setActionError('Ghi chú nội bộ phải có từ 1 đến 1.000 ký tự.');
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
        ? 'Góp ý vừa được Organizer khác cập nhật. Dữ liệu mới nhất đã được tải lại.'
        : queueErrorMessage(error));
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
    ? 'Bắt đầu xử lý'
    : detail?.status === 'IN_PROGRESS'
      ? 'Hoàn tất xử lý'
      : 'Mở lại xử lý';
  const ActionIcon = detail?.status === 'NEW'
    ? PlayCircle
    : detail?.status === 'IN_PROGRESS'
      ? CheckCircle2
      : RotateCcw;

  return <section className="organizer-content organizer-feedback-page">
    <header className="organizer-feedback-heading">
      <div>
        <h1 className="organizer-view-title workspace-page-title">
          {language === 'vi' ? 'Góp ý trải nghiệm' : 'Experience feedback'}
        </h1>
        <p className="organizer-view-sub workspace-page-subtitle">
          Hàng đợi dùng chung cho toàn bộ Ban Tổ chức; ghi chú xử lý chỉ dùng nội bộ.
        </p>
      </div>
      <div className="organizer-feedback-total" aria-label={`${totalElements} góp ý`}>
        <strong>{totalElements}</strong><span>Tổng góp ý</span>
      </div>
    </header>

    <div className="organizer-feedback-toolbar">
      <label className="organizer-feedback-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Tìm góp ý</span>
        <input value={searchInput} maxLength={100} onChange={event => setSearchInput(event.target.value)} placeholder="Tìm nội dung, người gửi, email, sự kiện..." />
      </label>
      <select value={status} onChange={event => { setPage(0); setStatus(event.target.value as OrganizerFeedbackStatus | ''); }} aria-label="Lọc trạng thái">
        {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select value={targetType} onChange={event => {
        const value = event.target.value as OrganizerFeedbackTargetType | '';
        setPage(0);
        setTargetType(value);
        if (value === 'BOOK_STREET') setEventId('');
      }} aria-label="Lọc phạm vi">
        {TARGET_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input className="organizer-feedback-event-filter" type="number" min="1" value={eventId} disabled={targetType === 'BOOK_STREET'} onChange={event => { setPage(0); setEventId(event.target.value); }} placeholder="Mã sự kiện" aria-label="Lọc theo mã sự kiện" />
      <select value={sort} onChange={event => { setPage(0); setSort(event.target.value as typeof sort); }} aria-label="Sắp xếp">
        <option value="submittedAt,desc">Mới nhất trước</option>
        <option value="submittedAt,asc">Cũ nhất trước</option>
      </select>
    </div>

    {loading && <div className="organizer-feedback-state"><LoaderCircle className="is-spinning" /><p>Đang tải góp ý…</p></div>}
    {!loading && queueError && <div className="organizer-feedback-state is-error" role="alert">
      <p>{queueError}</p>
      <button type="button" className="btn-org-secondary" onClick={() => void loadQueue()}><RefreshCw size={16} />Thử lại</button>
    </div>}
    {!loading && !queueError && items.length === 0 && <div className="organizer-feedback-state">
      <MessageSquare size={34} aria-hidden="true" /><p>Chưa có góp ý phù hợp với bộ lọc.</p>
    </div>}
    {!loading && !queueError && items.length > 0 && <div className="organizer-feedback-list">
      {items.map(item => <article className="organizer-feedback-card" key={item.feedbackId}>
        <div className="organizer-feedback-card-main">
          <div className="organizer-feedback-card-title">
            <strong>{targetLabel(item)}</strong>
            <span className={`organizer-feedback-status is-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
          </div>
          <p>{item.messagePreview}</p>
          <small><CalendarClock size={14} />{formatDate(item.submittedAt)}</small>
        </div>
        <button type="button" className="btn-org-secondary" onClick={() => void openFeedback(item.feedbackId)}>Xem chi tiết</button>
      </article>)}
    </div>}

    {!loading && !queueError && totalPages > 0 && <nav className="organizer-feedback-pagination" aria-label="Phân trang góp ý">
      <button type="button" className="btn-org-secondary" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Trang trước</button>
      <span>Trang {page + 1}/{totalPages}</span>
      <button type="button" className="btn-org-secondary" disabled={page + 1 >= totalPages} onClick={() => setPage(current => current + 1)}>Trang sau</button>
    </nav>}

    {selectedId !== null && <div className="org-modal-overlay organizer-feedback-overlay" role="presentation">
      <div className="org-modal-box organizer-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="organizer-feedback-dialog-title">
        <div className="org-modal-header">
          <div><h3 id="organizer-feedback-dialog-title">Chi tiết góp ý</h3><small>{detail ? targetLabel(detail) : `#${selectedId}`}</small></div>
          <button type="button" className="btn-org-secondary" disabled={actionLoading} onClick={closeDetail}>Đóng</button>
        </div>
        <div className="org-modal-body organizer-feedback-detail">
          {detailLoading && <div className="organizer-feedback-state"><LoaderCircle className="is-spinning" /><p>Đang tải chi tiết…</p></div>}
          {!detailLoading && !detail && <div className="organizer-feedback-state is-error" role="alert">
            <p>{actionError || 'Không tải được chi tiết góp ý.'}</p>
            <button type="button" className="btn-org-secondary" onClick={() => void openFeedback(selectedId)}><RefreshCw size={16} />Thử lại</button>
          </div>}
          {detail && <>
            <div className="organizer-feedback-detail-meta">
              <span className={`organizer-feedback-status is-${detail.status.toLowerCase()}`}>{statusLabel(detail.status)}</span>
              <span><CalendarClock size={15} />Gửi lúc {formatDate(detail.submittedAt)}</span>
              <span><UserRound size={15} />{detail.guestName || detail.submitter?.fullName || 'Khách ẩn danh'}</span>
              <span><Mail size={15} />{detail.contactEmail || 'Không cung cấp email'}</span>
            </div>
            <section className="organizer-feedback-message"><h4>Nội dung góp ý</h4><p>{detail.message}</p></section>
            {detail.lastHandledBy && <p className="organizer-feedback-handler">Xử lý gần nhất: <strong>{detail.lastHandledBy.fullName}</strong> · {formatDate(detail.updatedAt)}</p>}
            {detail.status === 'IN_PROGRESS' ? <label className="organizer-feedback-note">
              <span>Ghi chú nội bộ <strong>*</strong></span>
              <small>Chỉ Ban Tổ chức xem được; nội dung này không gửi cho khách.</small>
              <textarea value={internalNote} onChange={event => setInternalNote(event.target.value)} rows={5} maxLength={1100} placeholder="Nhập kết quả hoặc hướng xử lý nội bộ..." />
            </label> : detail.internalNote && <section className="organizer-feedback-message is-note">
              <h4>Ghi chú nội bộ</h4><small>Không gửi cho khách</small><p>{detail.internalNote}</p>
            </section>}
            {actionError && <div className="organizer-feedback-inline-error" role="alert">{actionError}</div>}
          </>}
        </div>
        {detail && <div className="org-modal-footer">
          <button type="button" className="btn-org-secondary" disabled={actionLoading} onClick={closeDetail}>Đóng</button>
          <button type="button" className="btn-org-primary" disabled={actionLoading} onClick={() => void runAction()}>
            {actionLoading ? <LoaderCircle className="is-spinning" size={16} /> : <ActionIcon size={16} />}
            {actionLoading ? 'Đang cập nhật…' : actionLabel}
          </button>
        </div>}
      </div>
    </div>}
  </section>;
};
