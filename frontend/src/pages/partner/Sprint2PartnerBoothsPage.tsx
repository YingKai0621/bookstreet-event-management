import { AlertCircle, Check, Clock3, Loader2, RefreshCw, Store, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../components/portal/Sprint2Booth.css';
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
  AVAILABLE: 'Còn trống', ON_HOLD: 'Đang giữ chỗ', ASSIGNED: 'Đã phân bổ', UNAVAILABLE: 'Chưa mở',
};

const requestStatusLabel: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt', SELECTED: 'Đã được chọn', COMPLETED: 'Hoàn tất',
  PAYMENT_EXPIRED: 'Hết hạn giữ chỗ', NOT_SELECTED: 'Không được chọn',
  REJECTED: 'Đã từ chối', WITHDRAWN: 'Đã rút',
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
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
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
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tab, setTab] = useState<'browse' | 'requests'>('browse');
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [category, setCategory] = useState('ALL');
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

  useEffect(() => { void loadData(); }, [loadData]);
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

  const categories = useMemo(
    () => [...new Set(booths.map(row => row.booth.categoryCode).filter((value): value is string => Boolean(value)))],
    [booths],
  );
  const filteredBooths = category === 'ALL' ? booths : booths.filter(row => row.booth.categoryCode === category);
  const mapMarkers = useMemo(
    () => filteredBooths.flatMap(row => {
      const marker = eventBoothToMarker(row);
      return marker ? [marker] : [];
    }),
    [filteredBooths],
  );
  const requestByBooth = useMemo(() => {
    const map = new Map<number, BoothRequest[]>();
    requests.forEach(request => map.set(request.boothId, [...(map.get(request.boothId) || []), request]));
    return map;
  }, [requests]);

  const requestBlockedReason = (row: EventBooth): string | null => {
    if (row.availability !== 'AVAILABLE') return `Không thể yêu cầu: ${availabilityLabel[row.availability].toLowerCase()}.`;
    const history = requestByBooth.get(row.booth.boothId) || [];
    if (history.some(request => request.status === 'PENDING' || request.status === 'SELECTED')) return 'Bạn đã có một yêu cầu đang mở cho gian hàng này.';
    if (history.some(request => request.status === 'REJECTED')) return 'Yêu cầu trước đã bị từ chối và không thể gửi lại cho cùng gian hàng.';
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
      setSuccess('Đã gửi yêu cầu. Gian hàng vẫn còn trống cho đến khi Organizer chọn một ứng viên.');
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
    return <section className="partner-page"><div className="partner-page-header"><h1 className="partner-page-title">Chọn gian hàng</h1><p className="partner-page-sub">Bạn cần một hồ sơ tham gia sự kiện đã được duyệt trước khi gửi yêu cầu gian hàng.</p></div><div className="s2-empty s2-panel"><Store size={34} /><strong>Chưa có sự kiện đủ điều kiện</strong><span>Hãy theo dõi trạng thái tại mục Sự kiện của tôi.</span></div></section>;
  }

  return <section className="partner-page s2-booth-page" aria-labelledby="partner-booth-title">
    <header className="s2-booth-header"><div><h1 id="partner-booth-title" className="partner-page-title" style={{ fontSize: '1.5rem', margin: 0 }}>Chọn gian hàng cho sự kiện</h1><p className="partner-page-sub">Xem giá và tình trạng thực tế trước khi gửi yêu cầu.</p></div><button className="btn-part-secondary" type="button" onClick={() => void loadData()} disabled={loading}><RefreshCw size={15} />Làm mới</button></header>

    <div className="s2-event-bar"><label htmlFor="s2-partner-event">Sự kiện đã được duyệt</label><select id="s2-partner-event" value={eventId} onChange={event => { setSelectedEventId(event.target.value); setSelectedBooth(null); }}>
      {approvedApplications.map(application => <option key={application.id} value={application.eventId}>{application.eventTitle}</option>)}
    </select></div>

    {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
    {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

    <nav className="s2-tabs" aria-label="Gian hàng đối tác"><button type="button" className={tab === 'browse' ? 'is-active' : ''} onClick={() => setTab('browse')}>Danh sách gian hàng <span>{booths.length}</span></button><button type="button" className={tab === 'requests' ? 'is-active' : ''} onClick={() => setTab('requests')}>Yêu cầu của tôi <span>{requests.length}</span></button></nav>

    {loading ? <div className="s2-loading"><Loader2 className="s2-spin" size={22} />Đang tải gian hàng...</div> : tab === 'browse' ? <div className="s2-panel">
      <div className="s2-panel-heading"><div><h2>Gian hàng đang mở</h2><p>Yêu cầu đang chờ không khóa gian hàng; tình trạng do backend xác định.</p></div><label className="s2-category-filter">Danh mục<select value={category} onChange={event => setCategory(event.target.value)}><option value="ALL">Tất cả</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
      <div className="s2-partner-map">
        <BoothMapCanvas
          markers={mapMarkers}
          selectedMarkerId={selectedBooth ? `booth-${selectedBooth.booth.boothId}` : null}
          onSelectMarker={marker => {
            const row = filteredBooths.find(item => item.booth.boothId === marker.boothId);
            if (row) { setSelectedBooth(row); setRequestNote(''); }
          }}
          ariaLabel="Bản đồ chọn gian hàng dành cho Partner"
          emptyMessage="Chưa có gian hàng nào trong bộ lọc được định vị trên bản đồ. Hãy dùng danh sách bên dưới."
        />
        {mapMarkers.length < filteredBooths.length && <p className="s2-map-note" role="note">
          {filteredBooths.length - mapMarkers.length} gian hàng chưa có đủ tọa độ nên chỉ hiển thị trong danh sách.
        </p>}
      </div>
      <div className="s2-card-grid">{filteredBooths.map(row => {
        const blockedReason = requestBlockedReason(row);
        return <article className="s2-booth-card" key={row.booth.boothId}>
          <div className="s2-booth-card-top"><strong>{row.booth.code}</strong><span className={`s2-status ${row.availability.toLowerCase()}`}>{availabilityLabel[row.availability]}</span></div>
          <h3>{row.booth.name}</h3><p>{row.booth.description || row.booth.note || 'Chưa có mô tả.'}</p>
          <dl><div><dt>Danh mục</dt><dd>{row.booth.categoryCode || '—'}</dd></div><div><dt>Giá sự kiện</dt><dd>{money(row.rentalPrice)}</dd></div></dl>
          {blockedReason && <small className="s2-blocked-reason">{blockedReason}</small>}
          <button type="button" className="btn-part-primary" disabled={Boolean(blockedReason)} onClick={() => { setSelectedBooth(row); setRequestNote(''); }}>Xem & gửi yêu cầu</button>
        </article>;
      })}{!filteredBooths.length && <div className="s2-empty"><Store size={30} /><strong>Không có gian hàng phù hợp</strong></div>}</div>
    </div> : <div className="s2-panel">
      <div className="s2-panel-heading"><div><h2>Yêu cầu của tôi</h2><p>Theo dõi quyết định của Organizer và thời hạn giữ chỗ.</p></div></div>
      <div className="s2-request-list">{requests.map(request => <article className="s2-request-card" key={request.boothRequestId}>
        <div className="s2-request-main"><div><span className={`s2-status request-${request.status.toLowerCase()}`}>{requestStatusLabel[request.status]}</span><h3>Gian {request.boothCode}</h3><p>Gửi lúc {dateTime(request.submittedAt)}</p></div><p className="s2-request-note">{request.requestNote || 'Không có ghi chú.'}</p></div>
        <div className="s2-request-note">
          {request.reviewedAt && <p>Đã xét duyệt: {dateTime(request.reviewedAt)}</p>}
          {request.selectedAt && <p>Được chọn: {dateTime(request.selectedAt)}</p>}
          {request.completedAt && <p>Hoàn tất: {dateTime(request.completedAt)}</p>}
          {request.paymentExpiredAt && <p>Hết hạn thanh toán: {dateTime(request.paymentExpiredAt)}</p>}
          {request.withdrawnAt && <p>Đã rút: {dateTime(request.withdrawnAt)}</p>}
        </div>
        {request.hold && <div className="s2-hold-card"><div className="s2-hold-summary"><Clock3 size={18} /><div><strong>{money(request.hold.lockedRentalPrice)}</strong><span>Giữ chỗ: {request.hold.status} · tạo {dateTime(request.hold.createdAt)} · hết hạn {dateTime(request.hold.expiresAt)}</span>{request.hold.releasedAt && <span>Giải phóng: {dateTime(request.hold.releasedAt)}</span>}</div></div>{request.hold.status === 'ACTIVE' && <div className="s2-countdown"><span>Thời gian còn lại</span><strong>{now === 0 ? 'Đang đồng bộ thời gian…' : remainingTime(request.hold.expiresAt, now)}</strong><small>Đồng hồ chỉ để tham khảo; trạng thái backend là quyết định cuối cùng.</small></div>}</div>}
        {request.reviewNote && <p className="s2-review-note"><strong>Phản hồi Organizer:</strong> {request.reviewNote}</p>}
        {request.status === 'PENDING' && <div className="s2-actions"><button type="button" className="btn-part-secondary" disabled={busy === `withdraw-${request.boothRequestId}`} onClick={() => void withdraw(request)}>Rút yêu cầu</button></div>}
      </article>)}{!requests.length && <div className="s2-empty">Bạn chưa gửi yêu cầu gian hàng nào cho sự kiện này.</div>}</div>
    </div>}

    {selectedBooth && <div className="s2-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedBooth(null); }}><div className="s2-modal s2-modal-small" role="dialog" aria-modal="true" aria-labelledby="request-booth-title">
      <div className="s2-modal-header"><div><span className="s2-eyebrow">{selectedBooth.booth.code} · {availabilityLabel[selectedBooth.availability]}</span><h2 id="request-booth-title">{selectedBooth.booth.name}</h2></div><button type="button" aria-label="Đóng" onClick={() => setSelectedBooth(null)}><X size={20} /></button></div>
      <div className="s2-booth-detail"><p>{selectedBooth.booth.description || selectedBooth.booth.note || 'Chưa có mô tả.'}</p><dl><div><dt>Danh mục</dt><dd>{selectedBooth.booth.categoryCode || '—'}</dd></div><div><dt>Sức chứa</dt><dd>{selectedBooth.booth.maxCapacity}</dd></div><div><dt>Giá thuê</dt><dd>{money(selectedBooth.rentalPrice)}</dd></div></dl></div>
      <form onSubmit={submitRequest} className="s2-stack-form"><label>Ghi chú cho Organizer (không bắt buộc)<textarea rows={4} maxLength={1000} value={requestNote} onChange={event => setRequestNote(event.target.value)} placeholder="Nhu cầu trưng bày hoặc thông tin cần lưu ý..." /></label><div className="s2-modal-actions"><button type="button" className="btn-part-secondary" onClick={() => setSelectedBooth(null)}>Hủy</button><button type="submit" className="btn-part-primary" disabled={busy === 'submit'}>{busy === 'submit' ? 'Đang gửi...' : 'Gửi yêu cầu gian hàng'}</button></div></form>
    </div></div>}
  </section>;
};
