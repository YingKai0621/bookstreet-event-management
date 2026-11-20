import { PaginatedList } from '../ui/PaginatedList';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Hourglass,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { BoothRequest } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import './Sprint2Booth.css';
import './OrganizerBoothRequestsView.css';

interface Props {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
}

const requestStatusLabel: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt',
  SELECTED: 'Đã chọn / Giữ chỗ',
  COMPLETED: 'Đã hoàn tất',
  PAYMENT_EXPIRED: 'Hết hạn giữ chỗ',
  NOT_SELECTED: 'Không được chọn',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
  CANCELLED: 'Sự kiện đã hủy',
};

const QUICK_REJECTION_REASONS = [
  'Gian hàng đã có đơn vị khác được duyệt và giữ chỗ.',
  'Hồ sơ đăng ký và mặt hàng trưng bày chưa phù hợp tiêu chí sự kiện.',
  'Thời gian chuẩn bị của đơn vị chưa đảm bảo tiến độ khai mạc.',
  'Đã hết hạn tiếp nhận và sắp xếp vị trí cho khu vực này.',
];

const HOLD_STATUS_LABELS: Record<NonNullable<BoothRequest['hold']>['status'], string> = {
  ACTIVE: 'Đang giữ chỗ',
  CONSUMED: 'Đã cấp gian',
  EXPIRED: 'Đã hết hạn',
  RELEASED: 'Đã trả chỗ',
};

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'BOOTH_REQUEST_DEADLINE_PASSED') {
      return 'Đã hết hạn xét duyệt yêu cầu thuê gian hàng cho sự kiện này.';
    }
    return error.fieldErrors.map(item => item.message).filter(Boolean).join(' ') || error.message;
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';
}

function money(value: number | null): string {
  if (value === null) return 'Chưa cấu hình';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export const OrganizerBoothRequestsView: React.FC<Props> = ({ events, selectedEventId, onSelectEventId }) => {
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'SELECTED' | 'COMPLETED' | 'OTHER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [boothFilter, setBoothFilter] = useState('ALL');
  const [approvingRequest, setApprovingRequest] = useState<BoothRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<BoothRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyKey, setBusyKey] = useState('');
  useModalDismiss(Boolean(approvingRequest || rejectingRequest), () => {
    if (busyKey) return;
    setApprovingRequest(null);
    setRejectingRequest(null);
  });
  const rejectBackdropHandlers = useBackdropClick(() => { if (!busyKey) setRejectingRequest(null); });

  const eventId = selectedEventId !== 'all' ? selectedEventId : events[0]?.id || '';
  const selectedEvent = events.find(event => event.id === eventId);
  const loadGenerationRef = useRef(0);
  const currentEventIdRef = useRef(eventId);

  useEffect(() => {
    currentEventIdRef.current = eventId;
  }, [eventId]);

  const loadData = useCallback(async (clearCurrent = false) => {
    const requestedEventId = eventId;
    if (currentEventIdRef.current !== requestedEventId) return;
    const generation = ++loadGenerationRef.current;

    if (clearCurrent) {
      setRequests([]);
      setApprovingRequest(null);
      setRejectingRequest(null);
      setReviewNote('');
      setSuccess('');
    }
    setLoading(true);
    setError('');

    if (!requestedEventId) {
      setLoading(false);
      return;
    }

    try {
      const eventRequests = await boothApi.listAllOrganizerRequests(requestedEventId);
      if (generation !== loadGenerationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setRequests(eventRequests);
    } catch (caughtError) {
      if (generation !== loadGenerationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setRequests([]);
      setError(apiMessage(caughtError));
    } finally {
      if (generation === loadGenerationRef.current && currentEventIdRef.current === requestedEventId) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The generation-guarded loader resets and fetches requests for the selected event.
    void loadData(true);
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const pendingRequests = useMemo(() => requests.filter(request => request.status === 'PENDING'), [requests]);
  const selectedRequests = useMemo(() => requests.filter(request => request.status === 'SELECTED'), [requests]);
  const completedRequests = useMemo(() => requests.filter(request => request.status === 'COMPLETED'), [requests]);
  const otherRequests = useMemo(
    () => requests.filter(request => request.status !== 'PENDING' && request.status !== 'SELECTED' && request.status !== 'COMPLETED'),
    [requests],
  );

  const availableBooths = useMemo(() => {
    const codes = Array.from(new Set(requests.map(r => r.boothCode))).filter(Boolean);
    return codes.sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let result = requests;
    if (requestFilter === 'PENDING') result = pendingRequests;
    else if (requestFilter === 'SELECTED') result = selectedRequests;
    else if (requestFilter === 'COMPLETED') result = completedRequests;
    else if (requestFilter === 'OTHER') result = otherRequests;

    if (boothFilter !== 'ALL') {
      result = result.filter(request => request.boothCode === boothFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        request =>
          request.partnerOrganizationName.toLowerCase().includes(term) ||
          request.boothCode.toLowerCase().includes(term) ||
          (request.requestNote && request.requestNote.toLowerCase().includes(term)),
      );
    }

    return result;
  }, [boothFilter, completedRequests, otherRequests, pendingRequests, requestFilter, requests, searchTerm, selectedRequests]);

  const handleSelectRequest = async (request: BoothRequest) => {
    if (request.partnerOrganizationStatus === 'INACTIVE') return;
    if (!eventId) return;
    const requestedEventId = eventId;
    setBusyKey(`request-${request.boothRequestId}`);
    setError('');
    try {
      await boothApi.selectRequest(requestedEventId, request.boothRequestId);
      if (currentEventIdRef.current !== requestedEventId) return;
      setApprovingRequest(null);
      setSuccess(`Đã duyệt chọn gian "${request.boothCode}" cho "${request.partnerOrganizationName}".`);
      await loadData();
    } catch (caughtError) {
      if (currentEventIdRef.current === requestedEventId) {
        setApprovingRequest(null);
        setError(apiMessage(caughtError));
      }
    } finally {
      setBusyKey('');
    }
  };

  const handleRejectRequest = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!eventId || !rejectingRequest || !reviewNote.trim()) return;
    const requestedEventId = eventId;
    setBusyKey(`request-${rejectingRequest.boothRequestId}`);
    setError('');
    try {
      await boothApi.rejectRequest(requestedEventId, rejectingRequest.boothRequestId, reviewNote.trim());
      if (currentEventIdRef.current !== requestedEventId) return;
      setRejectingRequest(null);
      setReviewNote('');
      setSuccess('Đã từ chối yêu cầu thuê gian hàng.');
      await loadData();
    } catch (caughtError) {
      if (currentEventIdRef.current === requestedEventId) setError(apiMessage(caughtError));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <section className="obr-page" aria-labelledby="organizer-booth-request-title">
      {/* 1. Header */}
      <header className="obr-header">
        <div className="obr-title-group">
          <h1 id="organizer-booth-request-title" className="organizer-view-title workspace-page-title">
            Yêu cầu cho thuê gian hàng theo sự kiện
          </h1>
          <p className="organizer-view-sub workspace-page-subtitle">
            Xét duyệt yêu cầu thuê, khóa giá và theo dõi thời hạn thanh toán giữ chỗ của đối tác.
          </p>
        </div>
        <button
          type="button"
          className="obr-refresh-btn btn-org-secondary"
          onClick={() => void loadData()}
          disabled={loading || !eventId}
        >
          <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* 2. Event Context Selector */}
      <div className="obr-event-bar s2-event-context">
        <div className="obr-event-icon-box s2-event-context-icon" aria-hidden="true">
          <CalendarDays size={22} />
        </div>
        <div className="obr-event-copy s2-event-context-copy">
          <span className="obr-event-eyebrow">Phạm vi xét duyệt</span>
          <label htmlFor="organizer-booth-event" className="obr-event-label">
            Sự kiện đang duyệt
          </label>
        </div>
        <div className="obr-event-select-wrap s2-event-context-control">
          <select
            id="organizer-booth-event"
            className="obr-event-select"
            value={eventId}
            disabled={!events.length}
            onChange={event => {
              currentEventIdRef.current = event.target.value;
              onSelectEventId(event.target.value);
            }}
          >
            {!events.length && <option value="">Chưa có sự kiện</option>}
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>
        {selectedEvent && (
          <div className="obr-event-dates s2-event-context-date">
            <CalendarDays size={15} />
            <span>{selectedEvent.dateRange}</span>
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="s2-alert s2-alert-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="s2-alert s2-alert-success" role="status">
          <Check size={18} />
          {success}
        </div>
      )}

      {/* 3. KPI Summary Stats */}
      <div className="obr-kpi-grid">
        <button
          type="button"
          className={`obr-kpi-card ${requestFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setRequestFilter('ALL')}
        >
          <div className="obr-kpi-icon-box total">
            <Store size={22} />
          </div>
          <div className="obr-kpi-info">
            <span className="kpi-label">Tổng yêu cầu</span>
            <strong className="kpi-num">{requests.length}</strong>
            <span className="kpi-hint">Tất cả đơn đăng ký</span>
          </div>
        </button>

        <button
          type="button"
          className={`obr-kpi-card ${requestFilter === 'PENDING' ? 'is-active' : ''}`}
          onClick={() => setRequestFilter('PENDING')}
        >
          <div className="obr-kpi-icon-box pending">
            <Hourglass size={22} />
          </div>
          <div className="obr-kpi-info">
            <span className="kpi-label">Chờ duyệt</span>
            <strong className="kpi-num">{pendingRequests.length}</strong>
            <span className="kpi-hint">Cần BQL phản hồi</span>
          </div>
        </button>

        <button
          type="button"
          className={`obr-kpi-card ${requestFilter === 'SELECTED' ? 'is-active' : ''}`}
          onClick={() => setRequestFilter('SELECTED')}
        >
          <div className="obr-kpi-icon-box hold">
            <Lock size={22} />
          </div>
          <div className="obr-kpi-info">
            <span className="kpi-label">Đang giữ chỗ</span>
            <strong className="kpi-num">{selectedRequests.length}</strong>
            <span className="kpi-hint">Chờ đối tác thanh toán</span>
          </div>
        </button>

        <button
          type="button"
          className={`obr-kpi-card ${requestFilter === 'COMPLETED' ? 'is-active' : ''}`}
          onClick={() => setRequestFilter('COMPLETED')}
        >
          <div className="obr-kpi-icon-box completed">
            <CheckCircle2 size={22} />
          </div>
          <div className="obr-kpi-info">
            <span className="kpi-label">Đã hoàn tất</span>
            <strong className="kpi-num">{completedRequests.length}</strong>
            <span className="kpi-hint">Đã thanh toán & cấp gian</span>
          </div>
        </button>
      </div>

      {/* 4. Toolbar: Search + Booth Filter + Tabs */}
      <div className="obr-toolbar">
        <div className="obr-toolbar-row-top">
          <div className="obr-search-box">
            <Search size={16} className="obr-search-icon" />
            <input
              type="text"
              className="obr-search-input"
              placeholder="Tìm kiếm theo tên đối tác, mã gian, ghi chú..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="obr-booth-filter">
            <label htmlFor="obr-filter-booth-code">Lọc theo gian:</label>
            <select
              id="obr-filter-booth-code"
              className="obr-booth-select"
              value={boothFilter}
              onChange={e => setBoothFilter(e.target.value)}
            >
              <option value="ALL">Tất cả gian hàng ({availableBooths.length})</option>
              {availableBooths.map(code => (
                <option key={code} value={code}>
                  Gian {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="obr-filter-tabs s2-filter-tabs">
          <button
            type="button"
            className={`obr-filter-tab s2-filter-tab ${requestFilter === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setRequestFilter('ALL')}
          >
            <span>Tất cả</span>
            <span className="obr-tab-badge">{requests.length}</span>
          </button>
          <button
            type="button"
            className={`obr-filter-tab s2-filter-tab ${requestFilter === 'PENDING' ? 'is-active' : ''}`}
            onClick={() => setRequestFilter('PENDING')}
          >
            <span>Chờ duyệt</span>
            <span className={`obr-tab-badge ${pendingRequests.length > 0 ? 'obr-badge-pending-alert' : ''}`}>
              {pendingRequests.length}
            </span>
          </button>
          <button
            type="button"
            className={`obr-filter-tab s2-filter-tab ${requestFilter === 'SELECTED' ? 'is-active' : ''}`}
            onClick={() => setRequestFilter('SELECTED')}
          >
            <span>Đã cấp giữ chỗ</span>
            <span className="obr-tab-badge">{selectedRequests.length}</span>
          </button>
          <button
            type="button"
            className={`obr-filter-tab s2-filter-tab ${requestFilter === 'COMPLETED' ? 'is-active' : ''}`}
            onClick={() => setRequestFilter('COMPLETED')}
          >
            <span>Đã hoàn tất</span>
            <span className="obr-tab-badge">{completedRequests.length}</span>
          </button>
          <button
            type="button"
            className={`obr-filter-tab s2-filter-tab ${requestFilter === 'OTHER' ? 'is-active' : ''}`}
            onClick={() => setRequestFilter('OTHER')}
          >
            <span>Khác</span>
            <span className="obr-tab-badge">{otherRequests.length}</span>
          </button>
        </div>
      </div>

      {/* 5. Request List */}
      {loading ? (
        <div className="s2-loading">
          <Loader2 className="s2-spin" size={24} />
          Đang tải yêu cầu thuê gian hàng...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="s2-empty">
          <Store size={40} />
          <p>
            {searchTerm || boothFilter !== 'ALL'
              ? 'Không tìm thấy yêu cầu thuê gian hàng nào. Hãy thử từ khóa hoặc gian hàng khác.'
              : 'Không có yêu cầu thuê gian hàng trong danh mục này.'}
          </p>
        </div>
      ) : (
        <PaginatedList items={filteredRequests}>{pageItems => (<div className="obr-request-list s2-request-list">
          {pageItems.map(request => (
            <article
              className={`obr-request-card s2-request-card status-${request.status.toLowerCase()} ${
                request.status === 'PENDING' ? 'is-pending' : ''
              }`}
              key={request.boothRequestId}
            >
              {/* Card Header */}
              <div className="obr-card-header">
                <div className="obr-card-partner-block">
                  <div className="obr-partner-icon-avatar">
                    <Building2 size={20} />
                  </div>
                  <div className="obr-partner-info">
                    <div className="obr-partner-name-row">
                      <span className="obr-partner-title s2-request-partner-name">
                        {request.partnerOrganizationName}
                      </span>
                      <span className="obr-booth-badge s2-request-booth-tag">
                        <Store size={14} />
                        Gian {request.boothCode}
                      </span>
                      {request.partnerOrganizationStatus === 'INACTIVE' && <span className="obr-organization-locked">Tổ chức bị khóa</span>}
                    </div>
                    <div className="obr-submitted-time">
                      <Clock3 size={13} />
                      <span>Nộp lúc: {dateTime(request.submittedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="obr-card-badge-wrap">
                  <span
                    className={`obr-card-status-badge s2-status request-${request.status.toLowerCase()} status-${request.status.toLowerCase()}`}
                  >
                    {request.status === 'PENDING' && <Hourglass size={13} />}
                    {request.status === 'SELECTED' && <Lock size={13} />}
                    {request.status === 'COMPLETED' && <CheckCircle2 size={13} />}
                    {requestStatusLabel[request.status]}
                  </span>
                </div>
              </div>

              {/* Card Body: Notes on left, Financials/Hold on right */}
              <div className={`obr-card-body${request.hold ? '' : ' is-notes-only'}`}>
                <div className="obr-card-notes-col">
                  {request.requestNote ? (
                    <div className="obr-note-box partner-note s2-request-note-box">
                      <div className="obr-note-label s2-note-header">
                        <MessageSquare size={13} />
                        <strong>Ghi chú đăng ký từ đối tác:</strong>
                      </div>
                      <p className="obr-note-text s2-note-text">{request.requestNote}</p>
                    </div>
                  ) : (
                    <div className="obr-note-box partner-note" style={{ opacity: 0.7 }}>
                      <div className="obr-note-label">
                        <MessageSquare size={13} />
                        <span>Ghi chú đăng ký:</span>
                      </div>
                      <p className="obr-note-text" style={{ fontStyle: 'italic' }}>
                        Đối tác không kèm ghi chú bổ sung.
                      </p>
                    </div>
                  )}

                  {request.reviewNote && (
                    <div className="obr-note-box review-note s2-request-review-box">
                      <div className="obr-note-label s2-review-header">
                        <ShieldCheck size={13} />
                        <strong>Phản hồi từ BQL:</strong>
                      </div>
                      <p className="obr-note-text s2-review-text">{request.reviewNote}</p>
                    </div>
                  )}
                </div>

                {request.hold && (
                  <div className="obr-card-hold-col s2-hold-card">
                  <div className="obr-hold-pricing">
                    <span className="obr-price-label s2-hold-price-label">Giá giữ chỗ:</span>
                    <strong className="obr-price-val s2-hold-price-val">
                      {money(request.hold.lockedRentalPrice)}
                    </strong>
                  </div>
                  <div className="obr-hold-meta-list">
                    <div className="obr-hold-meta-item">
                      <span className="meta-key">
                        <Info size={13} />
                        Trạng thái giữ chỗ:
                      </span>
                      <span
                        className={`obr-hold-status-chip s2-hold-status-badge status-${request.hold.status.toLowerCase()}`}
                      >
                        {HOLD_STATUS_LABELS[request.hold.status]}
                      </span>
                    </div>
                    <div className="obr-hold-meta-item">
                      <span className="meta-key">
                        <Clock3 size={13} />
                        Tạo giữ chỗ:
                      </span>
                      <span className="meta-val">{dateTime(request.hold.createdAt)}</span>
                    </div>
                    <div className="obr-hold-meta-item is-expiry">
                      <span className="meta-key">
                        <Hourglass size={13} />
                        Hạn thanh toán:
                      </span>
                      <span className="meta-val">{dateTime(request.hold.expiresAt)}</span>
                    </div>
                    {request.hold.releasedAt && (
                      <div className="obr-hold-meta-item">
                        <span className="meta-key">
                          <Check size={13} />
                          Trả chỗ lúc:
                        </span>
                        <span className="meta-val">{dateTime(request.hold.releasedAt)}</span>
                      </div>
                    )}
                  </div>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="obr-card-footer">
                {request.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      className="obr-btn-reject btn-request-reject"
                      onClick={() => {
                        setRejectingRequest(request);
                        setReviewNote('');
                      }}
                    >
                      <X size={15} />
                      <span>Từ chối</span>
                    </button>
                    <button
                      type="button"
                      className="obr-btn-approve btn-request-approve"
                      onClick={() => setApprovingRequest(request)}
                      disabled={busyKey === `request-${request.boothRequestId}` || request.partnerOrganizationStatus === 'INACTIVE'}
                    >
                      {busyKey === `request-${request.boothRequestId}` ? (
                        <Loader2 size={15} className="s2-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                      <span>Duyệt & Cấp giữ chỗ</span>
                    </button>
                  </>
                )}

                {request.status === 'SELECTED' && (
                  <div className="obr-status-banner banner-selected">
                    <Lock size={15} />
                    <span>
                      Đơn vị đã được cấp giữ chỗ. Đang chờ đối tác thanh toán trước hạn{' '}
                      <strong>{request.hold ? dateTime(request.hold.expiresAt) : 'đã định'}</strong>.
                    </span>
                  </div>
                )}

                {request.status === 'COMPLETED' && (
                  <div className="obr-status-banner banner-completed">
                    <CheckCircle2 size={15} />
                    <span>
                      Đối tác đã hoàn tất thanh toán. Gian hàng <strong>{request.boothCode}</strong> đã được gán chính thức!
                    </span>
                  </div>
                )}

                {request.status === 'PAYMENT_EXPIRED' && (
                  <div className="obr-status-banner banner-expired">
                    <AlertCircle size={15} />
                    <span>
                      Yêu cầu đã hết hạn thanh toán giữ chỗ. Gian hàng đã tự động giải phóng để nhận đăng ký mới.
                    </span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>)}</PaginatedList>
      )}

      {/* Modal: Approve Request */}
      {approvingRequest && (
        <div
          className="s2-modal-backdrop"
          onClick={() => { if (!busyKey) setApprovingRequest(null); }}
        >
          <div
            className="s2-modal s2-modal-small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-booth-request-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="s2-modal-header">
              <h2 id="approve-booth-request-title">Xác nhận duyệt yêu cầu</h2>
              <button
                type="button"
                aria-label="Đóng"
                disabled={Boolean(busyKey)}
                onClick={() => setApprovingRequest(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="s2-stack-form">
              <p>
                Bạn sắp duyệt và cấp giữ chỗ cho đối tác{' '}
                <strong>{approvingRequest.partnerOrganizationName}</strong> tại gian{' '}
                <strong>{approvingRequest.boothCode}</strong>.
              </p>
              {approvingRequest.partnerOrganizationStatus === 'INACTIVE' && <p role="status">Tổ chức đang bị khóa; không thể duyệt yêu cầu này.</p>}
              <p className="s2-modal-supporting-copy">
                Giá thuê hiện tại của gian hàng sẽ được khóa cho yêu cầu này. Với gian hàng miễn phí,
                hệ thống sẽ cấp gian ngay sau khi xác nhận.
              </p>
              <div className="s2-modal-actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-org-secondary"
                  disabled={Boolean(busyKey)}
                  onClick={() => setApprovingRequest(null)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-org-primary"
                  disabled={Boolean(busyKey) || approvingRequest.partnerOrganizationStatus === 'INACTIVE'}
                  onClick={() => void handleSelectRequest(approvingRequest)}
                >
                  {busyKey === `request-${approvingRequest.boothRequestId}` && (
                    <Loader2 size={15} className="s2-spin" />
                  )}
                  Xác nhận duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Request */}
      {rejectingRequest && (
        <div className="s2-modal-backdrop" {...rejectBackdropHandlers}>
          <div className="s2-modal s2-modal-small" onClick={event => event.stopPropagation()}>
            <div className="s2-modal-header">
              <h2>Từ chối yêu cầu thuê gian hàng</h2>
              <button type="button" onClick={() => setRejectingRequest(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRejectRequest} className="s2-stack-form">
              <p>
                Bạn sắp từ chối yêu cầu của <strong>{rejectingRequest.partnerOrganizationName}</strong> cho vị trí gian{' '}
                <strong>{rejectingRequest.boothCode}</strong>.
              </p>

              <label>
                Lý do từ chối *
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={event => setReviewNote(event.target.value)}
                  placeholder="Nhập lý do từ chối để phản hồi cho đối tác..."
                  required
                />
              </label>

              {/* Quick suggestions */}
              <div className="obr-quick-reasons">
                <span className="obr-quick-reasons-title">Gợi ý lý do nhanh:</span>
                <div className="obr-reason-chips">
                  {QUICK_REJECTION_REASONS.map((reason, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="obr-reason-chip"
                      onClick={() => setReviewNote(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="s2-modal-actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-org-secondary" onClick={() => setRejectingRequest(null)}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  style={{ background: '#991B1B' }}
                  disabled={busyKey.startsWith('request-') || !reviewNote.trim()}
                >
                  Xác nhận từ chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
