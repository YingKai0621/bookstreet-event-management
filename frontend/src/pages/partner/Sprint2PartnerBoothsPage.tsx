import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Store,
  Tag,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../components/organizer/Sprint2Booth.css';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language, PartnerEventApplication } from '../../types';
import type { BoothRequest, EventBooth } from '../../types/booth';
import { BoothMapCanvas } from '../../components/booth-map/BoothMapCanvas';
import { eventBoothToMarker } from '../../components/booth-map/boothMapModel';
import { BoothPaymentCheckoutCard } from '../../components/partner/BoothPaymentCheckoutCard';
import './PartnerPages.css';

interface Props {
  language: Language;
  applications: PartnerEventApplication[];
}

const CATEGORY_LABEL: Record<string, string> = {
  MANGA_COMICS: 'Truyện tranh & Manga',
  LITERATURE: 'Văn học & Nghệ thuật',
  TECHNOLOGY_SCIENCE: 'Công nghệ & Khởi nghiệp',
  CHILDREN: 'Sách Thiếu nhi',
  ART_CULTURE: 'Nghệ thuật & Văn hóa',
  HISTORY_SOCIETY: 'Lịch sử & Xã hội',
  LIFESTYLE_EDUCATION: 'Đời sống & Giáo dục',
};

const availabilityLabel: Record<EventBooth['availability'], string> = {
  AVAILABLE: 'Còn trống',
  ON_HOLD: 'Đang giữ chỗ',
  ASSIGNED: 'Đã thuê',
  UNAVAILABLE: 'Không mở bán',
};

const requestStatusLabel: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt',
  SELECTED: 'Đã được chọn',
  COMPLETED: 'Hoàn tất',
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

export const Sprint2PartnerBoothsPage: React.FC<Props> = ({ applications }) => {
  const approvedApplications = useMemo(
    () => applications.filter(application => application.status === 'approved'),
    [applications],
  );
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tab, setTab] = useState<'browse' | 'requests'>('browse');
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(0);
  useModalDismiss(Boolean(selectedBooth), () => { if (busy !== 'submit') setSelectedBooth(null); });

  const eventId = approvedApplications.some(application => application.eventId === selectedEventId)
    ? selectedEventId
    : approvedApplications[0]?.eventId || '';
  const selectedApplication = approvedApplications.find(application => application.eventId === eventId);
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
      setBooths([]);
      setRequests([]);
      setSelectedBooth(null);
      setRequestNote('');
      setSuccess('');
    }
    setError('');

    if (!requestedEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [eventBooths, ownRequests] = await Promise.all([
        boothApi.listAllPublicEventBooths(requestedEventId),
        boothApi.listAllPartnerRequests(requestedEventId),
      ]);
      if (generation !== loadGenerationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setBooths(eventBooths);
      setRequests(ownRequests);
    } catch (caughtError) {
      if (generation !== loadGenerationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setBooths([]);
      setRequests([]);
      setError(apiMessage(caughtError));
    } finally {
      if (generation === loadGenerationRef.current && currentEventIdRef.current === requestedEventId) {
        setLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    void loadData(true);
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => void loadData(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeExpiries = requests
      .filter(request => request.hold?.status === 'ACTIVE')
      .map(request => new Date(request.hold!.expiresAt).getTime())
      .filter(expiresAt => expiresAt > Date.now());
    if (!activeExpiries.length) return;
    const delay = Math.min(...activeExpiries) - Date.now() + 1500;
    const timeout = window.setTimeout(() => void loadData(), Math.max(1000, delay));
    return () => window.clearTimeout(timeout);
  }, [loadData, requests]);

  const mapMarkers = useMemo(
    () => booths.flatMap(row => {
      const marker = eventBoothToMarker(row);
      return marker ? [marker] : [];
    }),
    [booths],
  );

  const requestByBooth = useMemo(() => {
    const map = new Map<number, BoothRequest[]>();
    requests.forEach(request => map.set(request.boothId, [...(map.get(request.boothId) || []), request]));
    return map;
  }, [requests]);

  const requestBlockedReason = (row: EventBooth): string | null => {
    if (row.availability !== 'AVAILABLE') {
      return `Gian hàng hiện ${availabilityLabel[row.availability].toLowerCase()}.`;
    }
    const history = requestByBooth.get(row.booth.boothId) || [];
    if (history.some(request => request.status === 'PENDING' || request.status === 'SELECTED')) {
      return 'Bạn đã có một yêu cầu đang mở cho gian hàng này.';
    }
    if (history.some(request => request.status === 'REJECTED')) {
      return 'Yêu cầu trước cho gian này đã bị từ chối và không thể gửi lại cho cùng gian hàng.';
    }
    return null;
  };

  const submitRequest = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!selectedBooth || !eventId || requestBlockedReason(selectedBooth)) return;
    const requestedEventId = eventId;
    setBusy('submit');
    setError('');
    try {
      await boothApi.submitRequest(requestedEventId, selectedBooth.booth.boothId, requestNote.trim() || null);
      if (currentEventIdRef.current !== requestedEventId) return;
      setSelectedBooth(null);
      setRequestNote('');
      setSuccess(`Đã gửi yêu cầu đăng ký gian hàng ${selectedBooth.booth.code} thành công.`);
      setTab('requests');
      await loadData();
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setBusy('');
    }
  };

  const withdraw = async (request: BoothRequest) => {
    if (!window.confirm(`Rút yêu cầu gian ${request.boothCode}?`)) return;
    const requestedEventId = eventId;
    setBusy(`withdraw-${request.boothRequestId}`);
    setError('');
    try {
      await boothApi.withdrawRequest(request.boothRequestId);
      if (currentEventIdRef.current !== requestedEventId) return;
      setSuccess('Đã rút yêu cầu gian hàng.');
      await loadData();
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setBusy('');
    }
  };

  if (!approvedApplications.length) {
    return (
      <section className="partner-page">
        <div className="partner-page-header">
          <h1 className="partner-page-title">Chọn gian hàng</h1>
          <p className="partner-page-sub">Bạn cần một hồ sơ tham gia sự kiện đã được duyệt trước khi gửi yêu cầu gian hàng.</p>
        </div>
        <div className="s2-empty s2-panel">
          <Store size={34} />
          <strong>Chưa có sự kiện đủ điều kiện</strong>
          <span>Hãy theo dõi trạng thái tại mục Sự kiện của tôi.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="partner-page s2-booth-page" aria-labelledby="partner-booth-title">
      <header className="s2-booth-header">
        <div>
          <h1 id="partner-booth-title" className="partner-page-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            Sơ đồ & Yêu cầu gian hàng
          </h1>
          <p className="partner-page-sub">Chọn sự kiện, xem trạng thái từng gian hàng và gửi yêu cầu thuê trực tiếp trên sơ đồ.</p>
        </div>
        <button className="btn-part-secondary" type="button" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} />
          Làm mới
        </button>
      </header>

      <div className="s2-event-bar">
        <label htmlFor="partner-booth-event">Sự kiện tham gia</label>
        <select
          id="partner-booth-event"
          value={eventId}
          onChange={event => {
            currentEventIdRef.current = event.target.value;
            setSelectedEventId(event.target.value);
          }}
        >
          {approvedApplications.map(application => (
            <option key={application.id} value={application.eventId}>{application.eventTitle}</option>
          ))}
        </select>
        {selectedApplication && <span>{selectedApplication.dateRange}</span>}
      </div>


      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      <nav className="s2-tabs" aria-label="Gian hàng đối tác">
        <button
          type="button"
          className={tab === 'browse' ? 'is-active' : ''}
          onClick={() => setTab('browse')}
        >
          Sơ đồ gian hàng <span className="tab-count">{booths.length}</span>
        </button>
        <button
          type="button"
          className={tab === 'requests' ? 'is-active' : ''}
          onClick={() => setTab('requests')}
        >
          Yêu cầu của tôi <span className="tab-count">{requests.length}</span>
        </button>
      </nav>

      {loading ? (
        <div className="s2-loading">
          <Loader2 className="s2-spin" size={22} />
          Đang tải gian hàng...
        </div>
      ) : tab === 'browse' ? (
        <div className="s2-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="s2-partner-map">
            <BoothMapCanvas
              markers={mapMarkers}
              selectedMarkerId={selectedBooth ? `booth-${selectedBooth.booth.boothId}` : null}
              onSelectMarker={marker => {
                const row = booths.find(item => item.booth.boothId === marker.boothId);
                if (row) {
                  setSelectedBooth(row);
                  setRequestNote('');
                }
              }}
              editable={false}
              ariaLabel="Bản đồ chọn gian hàng dành cho Partner"
              emptyMessage="Chưa có gian hàng nào được định vị trên bản đồ."
            />
          </div>
        </div>
      ) : (
        <div className="s2-panel">
          <div className="s2-panel-heading" style={{ marginBottom: '1.25rem' }}>
            <div>
              <h2>Yêu cầu của tôi</h2>
            </div>
          </div>
          <div className="s2-request-list">
            {requests.map(request => {
              const isHoldActive = request.hold?.status === 'ACTIVE';
              const boothInfo = booths.find(b => b.booth.boothId === request.boothId);
              const boothName = boothInfo?.booth.name;

              return (
                <article
                  className={`s2-request-card ${request.status === 'PENDING' ? 'is-pending' : ''} ${isHoldActive ? 'has-active-hold' : ''}`}
                  key={request.boothRequestId}
                >
                  <div className="s2-req-topbar">
                    <div className="s2-req-identity">
                      <div className="s2-req-badge-group">
                        <span className="s2-booth-tag">
                          <Store size={15} />
                          Gian {request.boothCode}
                          {boothName ? ` • ${boothName}` : ''}
                        </span>
                        <span className={`s2-status request-${request.status.toLowerCase()}`}>
                          {requestStatusLabel[request.status]}
                        </span>
                      </div>
                      <span className="s2-req-submitted">
                        <Calendar size={13} /> Gửi lúc: {dateTime(request.submittedAt)}
                      </span>
                    </div>

                    {request.status === 'PENDING' && (
                      <div className="s2-req-actions">
                        <button
                          type="button"
                          className="btn-request-reject"
                          disabled={busy === `withdraw-${request.boothRequestId}`}
                          onClick={() => void withdraw(request)}
                        >
                          <X size={14} />
                          {busy === `withdraw-${request.boothRequestId}` ? 'Đang rút…' : 'Rút yêu cầu'}
                        </button>
                      </div>
                    )}
                  </div>

                  {request.requestNote && (
                    <div className="s2-partner-note-bubble">
                      <div className="s2-note-bubble-title">
                        <MessageSquare size={13} />
                        <span>Ghi chú của bạn:</span>
                      </div>
                      <p className="s2-note-bubble-content">{request.requestNote}</p>
                    </div>
                  )}

                  {request.reviewNote && (
                    <div className="s2-organizer-feedback">
                      <div className="s2-feedback-header">
                        <CheckCircle2 size={15} />
                        <span>Phản hồi từ Ban tổ chức</span>
                      </div>
                      <div className="s2-feedback-body">{request.reviewNote}</div>
                    </div>
                  )}

                  {(request.reviewedAt || request.selectedAt || request.completedAt || request.paymentExpiredAt || request.withdrawnAt) && (
                    <div className="s2-timeline-chips">
                      {request.reviewedAt && (
                        <div className="s2-timeline-chip">
                          <span className="s2-chip-dot reviewed" />
                          <span className="s2-chip-label">Đã xét duyệt:</span>
                          <strong>{dateTime(request.reviewedAt)}</strong>
                        </div>
                      )}
                      {request.selectedAt && (
                        <div className="s2-timeline-chip selected">
                          <span className="s2-chip-dot selected" />
                          <span className="s2-chip-label">Được chọn:</span>
                          <strong>{dateTime(request.selectedAt)}</strong>
                        </div>
                      )}
                      {request.completedAt && (
                        <div className="s2-timeline-chip success">
                          <span className="s2-chip-dot completed" />
                          <span className="s2-chip-label">Hoàn tất:</span>
                          <strong>{dateTime(request.completedAt)}</strong>
                        </div>
                      )}
                      {request.paymentExpiredAt && (
                        <div className="s2-timeline-chip error">
                          <span className="s2-chip-dot expired" />
                          <span className="s2-chip-label">Hết hạn thanh toán:</span>
                          <strong>{dateTime(request.paymentExpiredAt)}</strong>
                        </div>
                      )}
                      {request.withdrawnAt && (
                        <div className="s2-timeline-chip neutral">
                          <span className="s2-chip-dot withdrawn" />
                          <span className="s2-chip-label">Đã rút:</span>
                          <strong>{dateTime(request.withdrawnAt)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Khi gian hàng đã được chọn và đang trong thời gian giữ chỗ: Thẻ thanh toán chuyên nghiệp VNPay */}
                  {request.status === 'SELECTED' && isHoldActive ? (
                    <BoothPaymentCheckoutCard request={request} now={now} boothName={boothName} />
                  ) : request.hold ? (
                    /* Lịch sử giữ chỗ khi đã giải phóng hoặc hết hạn */
                    <div className="s2-hold-box is-inactive">
                      <div className="s2-hold-box-header">
                        <div className="s2-hold-price-area">
                          <span className="s2-hold-price-label">Giá thuê giữ chỗ</span>
                          <span className="s2-hold-price-value">{money(request.hold.lockedRentalPrice)}</span>
                        </div>
                        <div className="s2-hold-status-badge">
                          <span className={`s2-hold-status-pill ${request.hold.status.toLowerCase()}`}>
                            {request.hold.status === 'CONSUMED' ? 'Đã cấp gian hàng' : request.hold.status === 'EXPIRED' ? 'Đã hết hạn giữ chỗ' : 'Đã giải phóng'}
                          </span>
                        </div>
                      </div>

                      <div className="s2-hold-meta-grid">
                        <div className="s2-hold-meta-item">
                          <Clock3 size={14} />
                          <span>Tạo lúc: <strong>{dateTime(request.hold.createdAt)}</strong></span>
                        </div>
                        <div className="s2-hold-meta-item">
                          <Clock3 size={14} />
                          <span>Hạn thanh toán: <strong>{dateTime(request.hold.expiresAt)}</strong></span>
                        </div>
                        {request.hold.releasedAt && (
                          <div className="s2-hold-meta-item">
                            <Clock3 size={14} />
                            <span>Giải phóng lúc: <strong>{dateTime(request.hold.releasedAt)}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {request.hold && (
                    <div className="s3-payment-link-wrapper">
                      <Link to={`/partner/booth-requests/${request.boothRequestId}/payment`} className="s3-payment-details-link">
                        <CreditCard size={16} />
                        <span>Xem chi tiết thanh toán & thông tin gian hàng</span>
                        <ChevronRight size={15} />
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
            {!requests.length && (
              <div className="s2-empty">
                <Store size={32} />
                <strong>Bạn chưa gửi yêu cầu gian hàng nào</strong>
                <span>Chọn các gian hàng còn trống trên sơ đồ để đăng ký.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP XEM CHI TIẾT & GỬI YÊU CẦU GIAN HÀNG */}
      {selectedBooth && (
        <div
          className="booth-modal-backdrop"
          onClick={() => busy !== 'submit' && setSelectedBooth(null)}
        >
          <div className="booth-modal-box s2-booth-request-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            {/* Header */}
            <div className="booth-modal-header">
              <div>
                <div className="s2-booth-modal-badge-row">
                  <span className="s2-booth-tag">
                    <Store size={14} />
                    {selectedBooth.booth.code}
                  </span>
                  <span className={`s2-status ${selectedBooth.availability.toLowerCase()}`}>
                    {availabilityLabel[selectedBooth.availability]}
                  </span>
                </div>
                <h2 className="s2-booth-modal-title">{selectedBooth.booth.name}</h2>
              </div>
              <button
                type="button"
                className="booth-modal-close-btn"
                onClick={() => busy !== 'submit' && setSelectedBooth(null)}
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Description */}
            {(selectedBooth.booth.description || selectedBooth.booth.note) && (
              <div className="s2-booth-desc-box">
                <Info size={16} className="s2-desc-icon" />
                <p>{selectedBooth.booth.description || selectedBooth.booth.note}</p>
              </div>
            )}

            {/* Specifications Grid */}
            <div className="s2-booth-specs-grid">
              <div className="s2-booth-spec-card">
                <div className="s2-spec-header">
                  <Tag size={13} />
                  <span>Chuyên mục</span>
                </div>
                <strong className="s2-spec-value">
                  {CATEGORY_LABEL[selectedBooth.booth.categoryCode || ''] || selectedBooth.booth.categoryCode || 'Chưa phân loại'}
                </strong>
              </div>

              <div className="s2-booth-spec-card">
                <div className="s2-spec-header">
                  <Users size={13} />
                  <span>Sức chứa</span>
                </div>
                <strong className="s2-spec-value">
                  {selectedBooth.booth.maxCapacity ? `${selectedBooth.booth.maxCapacity} đơn vị` : 'Tiêu chuẩn'}
                </strong>
              </div>

              <div className="s2-booth-spec-card s2-spec-price-card">
                <div className="s2-spec-header">
                  <DollarSign size={13} />
                  <span>Giá thuê</span>
                </div>
                <strong className="s2-spec-value s2-price-highlight">
                  {money(selectedBooth.rentalPrice)}
                </strong>
              </div>
            </div>

            {/* Form / Blocked Notice */}
            {requestBlockedReason(selectedBooth) ? (
              <div className="s2-alert s2-alert-error" style={{ margin: 0 }}>
                <AlertCircle size={18} />
                <span>{requestBlockedReason(selectedBooth)}</span>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="s2-modal-request-form">
                <div className="s2-form-field">
                  <label htmlFor="partner-request-note" className="s2-form-label">
                    <MessageSquare size={14} />
                    <span>Ghi chú gửi Ban tổ chức</span>
                    <small>(không bắt buộc)</small>
                  </label>
                  <textarea
                    id="partner-request-note"
                    className="s2-request-textarea"
                    rows={3}
                    maxLength={1000}
                    value={requestNote}
                    onChange={event => setRequestNote(event.target.value)}
                    placeholder="Mô tả nhu cầu trưng bày, diện tích hoặc yêu cầu dành cho gian hàng..."
                  />
                </div>

                <div className="booth-modal-footer">
                  <button
                    type="button"
                    className="btn-part-secondary"
                    onClick={() => setSelectedBooth(null)}
                    disabled={busy === 'submit'}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-part-primary"
                    disabled={busy === 'submit'}
                  >
                    {busy === 'submit' ? (
                      <>
                        <Loader2 size={16} className="s2-spin" />
                        <span>Đang gửi...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Gửi yêu cầu thuê gian</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
