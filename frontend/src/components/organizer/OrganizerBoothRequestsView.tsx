import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { BoothRequest } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import './Sprint2Booth.css';

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
};

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
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
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export const OrganizerBoothRequestsView: React.FC<Props> = ({ events, selectedEventId, onSelectEventId }) => {
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'SELECTED' | 'OTHER'>('ALL');
  const [rejectingRequest, setRejectingRequest] = useState<BoothRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyKey, setBusyKey] = useState('');
  useModalDismiss(Boolean(rejectingRequest), () => setRejectingRequest(null));

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
  const selectedRequests = useMemo(
    () => requests.filter(request => request.status === 'SELECTED' || request.status === 'COMPLETED'),
    [requests],
  );
  const otherRequests = useMemo(
    () => requests.filter(request => request.status !== 'PENDING' && request.status !== 'SELECTED' && request.status !== 'COMPLETED'),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    if (requestFilter === 'PENDING') return pendingRequests;
    if (requestFilter === 'SELECTED') return selectedRequests;
    if (requestFilter === 'OTHER') return otherRequests;
    return requests;
  }, [otherRequests, pendingRequests, requestFilter, requests, selectedRequests]);

  const handleSelectRequest = async (request: BoothRequest) => {
    if (!eventId || !window.confirm(`Duyệt và cấp giữ chỗ cho đối tác "${request.partnerOrganizationName}" tại gian "${request.boothCode}"?`)) return;
    const requestedEventId = eventId;
    setBusyKey(`request-${request.boothRequestId}`);
    setError('');
    try {
      await boothApi.selectRequest(requestedEventId, request.boothRequestId);
      if (currentEventIdRef.current !== requestedEventId) return;
      setSuccess(`Đã duyệt chọn gian "${request.boothCode}" cho "${request.partnerOrganizationName}".`);
      await loadData();
    } catch (caughtError) {
      if (currentEventIdRef.current === requestedEventId) setError(apiMessage(caughtError));
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
    <section className="s2-booth-page" aria-labelledby="organizer-booth-request-title">
      <header className="s2-booth-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 id="organizer-booth-request-title" className="organizer-view-title" style={{ fontSize: '1.75rem' }}>
            Yêu cầu gian hàng theo sự kiện
          </h1>
          <p className="organizer-view-sub" style={{ marginTop: '0.35rem', fontSize: '0.92rem' }}>
            Xét duyệt yêu cầu thuê và theo dõi giữ chỗ. Danh mục vật lý và giá sự kiện được quản lý ở các màn hình riêng.
          </p>
        </div>
        <button type="button" className="btn-org-secondary" onClick={() => void loadData()} disabled={loading || !eventId}>
          <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </header>

      <div className="s2-event-context">
        <div className="s2-event-context-icon" aria-hidden="true"><CalendarDays size={21} /></div>
        <div className="s2-event-context-copy">
          <span>Phạm vi xét duyệt</span>
          <label htmlFor="organizer-booth-event">Sự kiện đang duyệt</label>
        </div>
        <div className="s2-event-context-control">
          <select
            id="organizer-booth-event"
            value={eventId}
            disabled={!events.length}
            onChange={event => {
              currentEventIdRef.current = event.target.value;
              onSelectEventId(event.target.value);
            }}
          >
            {!events.length && <option value="">Chưa có sự kiện</option>}
            {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </div>
        {selectedEvent && (
          <div className="s2-event-context-date">
            <CalendarDays size={15} />
            <span>{selectedEvent.dateRange}</span>
          </div>
        )}
      </div>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      <div className="s2-panel">
        <div className="s2-panel-heading">
          <div>
            <h2>Yêu cầu thuê từ đối tác</h2>
            <p>Mọi dữ liệu và thao tác bên dưới chỉ áp dụng cho sự kiện đang chọn.</p>
          </div>
        </div>

        <div className="s2-filter-tabs">
          <button type="button" className={`s2-filter-tab ${requestFilter === 'ALL' ? 'is-active' : ''}`} onClick={() => setRequestFilter('ALL')}>Tất cả ({requests.length})</button>
          <button type="button" className={`s2-filter-tab ${requestFilter === 'PENDING' ? 'is-active' : ''}`} onClick={() => setRequestFilter('PENDING')}>Chờ duyệt ({pendingRequests.length})</button>
          <button type="button" className={`s2-filter-tab ${requestFilter === 'SELECTED' ? 'is-active' : ''}`} onClick={() => setRequestFilter('SELECTED')}>Đã cấp giữ chỗ ({selectedRequests.length})</button>
          <button type="button" className={`s2-filter-tab ${requestFilter === 'OTHER' ? 'is-active' : ''}`} onClick={() => setRequestFilter('OTHER')}>Khác ({otherRequests.length})</button>
        </div>

        {loading ? (
          <div className="s2-loading"><Loader2 className="s2-spin" size={24} />Đang tải yêu cầu...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="s2-empty"><Store size={36} /><p>Không có yêu cầu thuê gian hàng trong danh mục này.</p></div>
        ) : (
          <div className="s2-request-list">
            {filteredRequests.map(request => (
              <article className={`s2-request-card ${request.status === 'PENDING' ? 'is-pending' : ''}`} key={request.boothRequestId}>
                <div className="s2-request-header">
                  <div className="s2-request-title-area">
                    <div className="s2-request-title-row">
                      <span className={`s2-status request-${request.status.toLowerCase()}`}>{requestStatusLabel[request.status]}</span>
                      <span className="s2-request-partner-name">{request.partnerOrganizationName}</span>
                      <span className="s2-request-booth-tag">Gian {request.boothCode}</span>
                    </div>
                    <div className="s2-request-meta"><Clock3 size={13} /><span>Nộp lúc: {dateTime(request.submittedAt)}</span></div>
                  </div>
                  {request.status === 'PENDING' && (
                    <div className="s2-request-actions">
                      <button type="button" className="btn-request-reject" onClick={() => { setRejectingRequest(request); setReviewNote(''); }}>Từ chối</button>
                      <button type="button" className="btn-request-approve" onClick={() => void handleSelectRequest(request)} disabled={busyKey === `request-${request.boothRequestId}`}>
                        {busyKey === `request-${request.boothRequestId}` ? <Loader2 size={15} className="s2-spin" /> : <Check size={15} />}
                        <span>Duyệt & Cấp giữ chỗ</span>
                      </button>
                    </div>
                  )}
                </div>

                {request.hold && (
                  <div className="s2-hold-card">
                    <div className="s2-hold-summary">
                      <div className="s2-hold-summary-main">
                        <span className="s2-hold-price-label">Giá giữ chỗ:</span>
                        <strong className="s2-hold-price-val">{money(request.hold.lockedRentalPrice)}</strong>
                        <span className={`s2-hold-status-badge status-${request.hold.status.toLowerCase()}`}>Trạng thái: {request.hold.status}</span>
                      </div>
                      <div className="s2-hold-meta-row">
                        <span className="s2-hold-meta-point"><Clock3 size={13} />Tạo: {dateTime(request.hold.createdAt)}</span>
                        <span className="s2-hold-meta-point highlight"><Clock3 size={13} />Hạn thanh toán: {dateTime(request.hold.expiresAt)}</span>
                        {request.hold.releasedAt && <span className="s2-hold-meta-point">Giải phóng: {dateTime(request.hold.releasedAt)}</span>}
                      </div>
                    </div>
                  </div>
                )}
                {request.requestNote && (
                  <div className="s2-request-note-box">
                    <div className="s2-note-header"><MessageSquare size={14} /><strong>Ghi chú đăng ký:</strong></div>
                    <div className="s2-note-text">{request.requestNote}</div>
                  </div>
                )}
                {request.reviewNote && (
                  <div className="s2-request-review-box">
                    <div className="s2-review-header"><ShieldCheck size={14} /><strong>Phản hồi từ BQL:</strong></div>
                    <div className="s2-review-text">{request.reviewNote}</div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {rejectingRequest && (
        <div className="s2-modal-backdrop" onClick={() => setRejectingRequest(null)}>
          <div className="s2-modal s2-modal-small" onClick={event => event.stopPropagation()}>
            <div className="s2-modal-header">
              <h2>Từ chối yêu cầu thuê gian hàng</h2>
              <button type="button" onClick={() => setRejectingRequest(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRejectRequest} className="s2-stack-form">
              <p>Bạn sắp từ chối yêu cầu của <strong>{rejectingRequest.partnerOrganizationName}</strong> cho gian <strong>{rejectingRequest.boothCode}</strong>.</p>
              <label>
                Lý do từ chối *
                <textarea rows={3} value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder="Nhập lý do từ chối để gửi thông báo cho đối tác..." required />
              </label>
              <div className="s2-modal-actions">
                <button type="button" className="btn-org-secondary" onClick={() => setRejectingRequest(null)}>Hủy</button>
                <button type="submit" className="btn-org-primary" style={{ background: '#991B1B' }} disabled={busyKey.startsWith('request-') || !reviewNote.trim()}>Xác nhận từ chối</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
