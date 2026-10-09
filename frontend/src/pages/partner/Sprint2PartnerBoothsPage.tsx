import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCw,
  Store,
  Timer,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../components/organizer/Sprint2Booth.css';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language, PartnerEventApplication } from '../../types';
import type { BoothRequest, EventBooth } from '../../types/booth';
import { BoothMapCanvas } from '../../components/booth-map/BoothMapCanvas';
import { eventBoothToMarker } from '../../components/booth-map/boothMapModel';
import './PartnerPages.css';

interface Props {
  language: Language;
  applications: PartnerEventApplication[];
}

const availabilityLabel: Record<EventBooth['availability'], string> = {
  AVAILABLE: 'Còn trống',
  ON_HOLD: 'Đang giữ chỗ',
  ASSIGNED: 'Đã phân bổ',
  UNAVAILABLE: 'Chưa mở',
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

function remainingTime(expiresAt: string, now: number): string {
  const milliseconds = Math.max(0, new Date(expiresAt).getTime() - now);
  if (milliseconds <= 0) return 'Đang chờ hệ thống cập nhật trạng thái';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0 ? `${days} ngày ${hours} giờ ${minutes} phút` : `${hours} giờ ${minutes} phút ${seconds} giây`;
}

export const Sprint2PartnerBoothsPage: React.FC<Props> = ({ applications }) => {
  const approvedApplications = useMemo(
    () => applications.filter(application => application.status === 'approved'),
    [applications],
  );
  const [selectedEventId, _setSelectedEventId] = useState('');
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

  const eventId = approvedApplications.some(application => application.eventId === selectedEventId)
    ? selectedEventId
    : approvedApplications[0]?.eventId || '';

  const loadData = useCallback(async () => {
    if (!eventId) {
      setBooths([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [eventBooths, ownRequests] = await Promise.all([
        boothApi.listAllPublicEventBooths(eventId),
        boothApi.listAllPartnerRequests(eventId),
      ]);
      setBooths(eventBooths);
      setRequests(ownRequests);
    } catch (caughtError) {
      setBooths([]);
      setRequests([]);
      setError(apiMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
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
    setBusy('submit');
    setError('');
    try {
      await boothApi.submitRequest(eventId, selectedBooth.booth.boothId, requestNote.trim() || null);
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
    setBusy(`withdraw-${request.boothRequestId}`);
    setError('');
    try {
      await boothApi.withdrawRequest(request.boothRequestId);
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
          <p className="partner-page-sub">Nhấn trực tiếp vào các gian hàng trên sơ đồ để xem thông tin và gửi yêu cầu đăng ký / đổi gian hàng.</p>
        </div>
        <button className="btn-part-secondary" type="button" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} />
          Làm mới
        </button>
      </header>

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
              <p>Theo dõi quyết định của Ban tổ chức và thời hạn giữ chỗ thanh toán cho từng gian hàng.</p>
            </div>
          </div>
          <div className="s2-request-list">
            {requests.map(request => {
              const isHoldActive = request.hold?.status === 'ACTIVE';
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

                  {request.hold && (
                    <div className={`s2-hold-box ${request.hold.status === 'ACTIVE' ? 'is-active' : 'is-inactive'}`}>
                      <div className="s2-hold-box-header">
                        <div className="s2-hold-price-area">
                          <span className="s2-hold-price-label">Giá thuê giữ chỗ</span>
                          <span className="s2-hold-price-value">{money(request.hold.lockedRentalPrice)}</span>
                        </div>
                        <div className="s2-hold-status-badge">
                          <span className={`s2-hold-status-pill ${request.hold.status.toLowerCase()}`}>
                            {request.hold.status === 'ACTIVE' ? 'Đang giữ chỗ (ACTIVE)' : `Giữ chỗ: ${request.hold.status}`}
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
                            <span>Giải phóng: <strong>{dateTime(request.hold.releasedAt)}</strong></span>
                          </div>
                        )}
                      </div>

                      {request.hold.status === 'ACTIVE' && (
                        <div className="s2-hold-countdown-banner">
                          <div className="s2-countdown-icon-box">
                            <Timer size={22} className="s2-pulse" />
                          </div>
                          <div className="s2-countdown-info">
                            <div className="s2-countdown-title">Thời gian giữ chỗ thanh toán còn lại:</div>
                            <div className="s2-countdown-value">
                              {now === 0 ? 'Đang đồng bộ thời gian…' : remainingTime(request.hold.expiresAt, now)}
                            </div>
                            <div className="s2-countdown-hint">
                              Đồng hồ đếm ngược mang tính tham khảo; trạng thái ghi nhận trên hệ thống là quyết định cuối cùng.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {request.reviewNote && (
                    <div className="s2-organizer-feedback">
                      <div className="s2-feedback-header">
                        <CheckCircle2 size={15} />
                        <span>Phản hồi từ Ban tổ chức (Organizer)</span>
                      </div>
                      <div className="s2-feedback-body">{request.reviewNote}</div>
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
          <div className="booth-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="booth-modal-header">
              <div>
                <span className="s2-eyebrow" style={{ display: 'inline-block', marginBottom: '0.25rem' }}>
                  {selectedBooth.booth.code} · {availabilityLabel[selectedBooth.availability]}
                </span>
                <h2 style={{ margin: 0 }}>{selectedBooth.booth.name}</h2>
              </div>
              <button
                type="button"
                className="booth-modal-close-btn"
                onClick={() => busy !== 'submit' && setSelectedBooth(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="s2-booth-detail" style={{ padding: '1rem 0' }}>
              <p style={{ margin: '0 0 1rem 0', color: '#475569' }}>
                {selectedBooth.booth.description || selectedBooth.booth.note || 'Chưa có mô tả chi tiết vị trí.'}
              </p>
              <dl>
                <div>
                  <dt>Chuyên mục</dt>
                  <dd>{selectedBooth.booth.categoryCode || 'Chưa phân loại'}</dd>
                </div>
                <div>
                  <dt>Sức chứa</dt>
                  <dd>{selectedBooth.booth.maxCapacity} đơn vị</dd>
                </div>
                <div>
                  <dt>Giá thuê sự kiện</dt>
                  <dd style={{ color: '#059669', fontWeight: 700 }}>{money(selectedBooth.rentalPrice)}</dd>
                </div>
              </dl>
            </div>

            {requestBlockedReason(selectedBooth) ? (
              <div className="s2-alert s2-alert-error" style={{ margin: '0.75rem 0' }}>
                <AlertCircle size={16} />
                <span>{requestBlockedReason(selectedBooth)}</span>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="s2-stack-form">
                <label>
                  Ghi chú gửi Ban tổ chức (không bắt buộc)
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={requestNote}
                    onChange={event => setRequestNote(event.target.value)}
                    placeholder="Mô tả nhu cầu trưng bày, diện tích hoặc mong muốn đổi gian..."
                  />
                </label>
                <div className="booth-modal-footer" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-org-secondary"
                    onClick={() => setSelectedBooth(null)}
                    disabled={busy === 'submit'}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-org-primary"
                    disabled={busy === 'submit'}
                  >
                    {busy === 'submit' ? 'Đang gửi...' : 'Gửi yêu cầu thuê / đổi gian'}
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
