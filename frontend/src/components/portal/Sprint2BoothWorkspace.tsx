import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Clock3, Edit3, Loader2, Plus, RefreshCw, Store, X } from 'lucide-react';
import type { Language } from '../../types';
import type { BoothRequest, CreatePhysicalBoothInput, EventBooth, PhysicalBooth } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import { boothApi } from '../../services/boothApi';
import { ApiError } from '../../services/apiClient';
import './Sprint2Booth.css';

interface Props {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
}

interface BoothFormState {
  code: string;
  name: string;
  description: string;
  maxCapacity: string;
  mapX: string;
  mapY: string;
  categoryCode: string;
  note: string;
  active: boolean;
}

const EMPTY_FORM: BoothFormState = {
  code: '', name: '', description: '', maxCapacity: '1', mapX: '', mapY: '',
  categoryCode: '', note: '', active: true,
};

const availabilityLabel: Record<EventBooth['availability'], string> = {
  AVAILABLE: 'Còn trống', ON_HOLD: 'Đang giữ chỗ', ASSIGNED: 'Đã phân bổ', UNAVAILABLE: 'Chưa mở',
};

const requestStatusLabel: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt', SELECTED: 'Đã chọn', COMPLETED: 'Hoàn tất',
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

function formFromBooth(booth: PhysicalBooth | null): BoothFormState {
  if (!booth) return { ...EMPTY_FORM };
  return {
    code: booth.code,
    name: booth.name,
    description: booth.description || '',
    maxCapacity: String(booth.maxCapacity),
    mapX: booth.mapX === null ? '' : String(booth.mapX),
    mapY: booth.mapY === null ? '' : String(booth.mapY),
    categoryCode: booth.categoryCode || '',
    note: booth.note || '',
    active: booth.active,
  };
}

export const Sprint2BoothWorkspace: React.FC<Props> = ({ events, selectedEventId, onSelectEventId }) => {
  const [tab, setTab] = useState<'catalog' | 'configuration' | 'requests'>('catalog');
  const [physicalBooths, setPhysicalBooths] = useState<PhysicalBooth[]>([]);
  const [eventBooths, setEventBooths] = useState<EventBooth[]>([]);
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [editingBooth, setEditingBooth] = useState<PhysicalBooth | null>(null);
  const [boothForm, setBoothForm] = useState<BoothFormState>({ ...EMPTY_FORM });
  const [showBoothForm, setShowBoothForm] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<BoothRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const eventId = selectedEventId !== 'all' ? selectedEventId : events[0]?.id || '';
  const currentEvent = useMemo(() => events.find(event => event.id === eventId), [eventId, events]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const physicalPage = await boothApi.listPhysicalBooths();
      setPhysicalBooths(physicalPage.content);
      if (eventId) {
        const [configurations, requestPage] = await Promise.all([
          boothApi.listEventBoothConfigurations(eventId),
          boothApi.listOrganizerRequests(eventId),
        ]);
        const configurationByBoothId = new Map(
          configurations.map(configuration => [configuration.booth.boothId, configuration]),
        );
        setEventBooths(physicalPage.content.map(booth => configurationByBoothId.get(booth.boothId) || {
          eventBoothConfigId: null,
          eventId: Number(eventId),
          booth,
          rentalPrice: null,
          enabled: false,
          availability: 'UNAVAILABLE' as const,
        }));
        setRequests(requestPage.content);
      } else {
        setEventBooths([]);
        setRequests([]);
      }
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const submitBooth = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setError('');
    const maxCapacity = Number(boothForm.maxCapacity);
    if (!boothForm.code.trim() || !boothForm.name.trim() || !Number.isInteger(maxCapacity) || maxCapacity <= 0) {
      setError('Mã, tên và sức chứa dương là bắt buộc.');
      return;
    }
    const input: CreatePhysicalBoothInput = {
      code: boothForm.code.trim(),
      name: boothForm.name.trim(),
      description: boothForm.description.trim() || null,
      maxCapacity,
      mapX: boothForm.mapX === '' ? null : Number(boothForm.mapX),
      mapY: boothForm.mapY === '' ? null : Number(boothForm.mapY),
      categoryCode: boothForm.categoryCode.trim() || null,
      note: boothForm.note.trim() || null,
    };
    setBusyKey('booth-form');
    try {
      if (editingBooth) {
        const { code: _code, ...updateInput } = input;
        await boothApi.updatePhysicalBooth(editingBooth.boothId, { ...updateInput, active: boothForm.active });
        setSuccess('Đã cập nhật gian hàng vật lý.');
      } else {
        await boothApi.createPhysicalBooth(input);
        setSuccess('Đã tạo gian hàng vật lý.');
      }
      setShowBoothForm(false);
      await loadData();
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setBusyKey('');
    }
  };

  const saveConfiguration = async (row: EventBooth, rentalPrice: number, enabled: boolean) => {
    if (!eventId || !Number.isFinite(rentalPrice) || rentalPrice < 0) {
      setError('Giá thuê phải là số không âm.');
      return;
    }
    setBusyKey(`config-${row.booth.boothId}`);
    setError('');
    try {
      await boothApi.configureEventBooth(eventId, row.booth.boothId, rentalPrice, enabled);
      setSuccess(`Đã cập nhật cấu hình ${row.booth.code}.`);
      await loadData();
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setBusyKey('');
    }
  };

  const selectRequest = async (request: BoothRequest) => {
    if (!eventId || !window.confirm(`Chọn ${request.partnerOrganizationName} cho gian ${request.boothCode}?`)) return;
    setBusyKey(`request-${request.boothRequestId}`);
    setError('');
    try {
      await boothApi.selectRequest(eventId, request.boothRequestId);
      setSuccess('Đã chọn yêu cầu và tạo giữ chỗ. Các ứng viên khác vẫn chờ duyệt.');
      await loadData();
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setBusyKey('');
    }
  };

  const rejectRequest = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!eventId || !rejectingRequest || !reviewNote.trim()) return;
    setBusyKey(`request-${rejectingRequest.boothRequestId}`);
    try {
      await boothApi.rejectRequest(eventId, rejectingRequest.boothRequestId, reviewNote.trim());
      setRejectingRequest(null);
      setReviewNote('');
      setSuccess('Đã từ chối yêu cầu gian hàng.');
      await loadData();
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <section className="s2-booth-page" aria-labelledby="organizer-booth-title">
      <header className="s2-booth-header">
        <div><span className="s2-eyebrow">Sprint 2 · Quản lý gian hàng</span><h1 id="organizer-booth-title">Gian hàng & yêu cầu đối tác</h1><p>Quản lý vị trí vật lý, giá theo sự kiện và giữ chỗ của đối tác.</p></div>
        <button className="btn-org-secondary" type="button" onClick={() => void loadData()} disabled={loading}><RefreshCw size={15} />Làm mới</button>
      </header>

      <div className="s2-event-bar">
        <label htmlFor="s2-organizer-event">Sự kiện đang quản lý</label>
        <select id="s2-organizer-event" value={eventId} onChange={event => onSelectEventId(event.target.value)}>
          {events.map(event => <option value={event.id} key={event.id}>{event.title}</option>)}
        </select>
        {currentEvent && <span>{currentEvent.statusLabelVi}</span>}
      </div>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      <nav className="s2-tabs" aria-label="Quản lý gian hàng">
        <button type="button" className={tab === 'catalog' ? 'is-active' : ''} onClick={() => setTab('catalog')}>Gian hàng vật lý <span>{physicalBooths.length}</span></button>
        <button type="button" className={tab === 'configuration' ? 'is-active' : ''} onClick={() => setTab('configuration')}>Cấu hình sự kiện <span>{eventBooths.filter(row => row.enabled).length}</span></button>
        <button type="button" className={tab === 'requests' ? 'is-active' : ''} onClick={() => setTab('requests')}>Yêu cầu đối tác <span>{requests.filter(row => row.status === 'PENDING').length}</span></button>
      </nav>

      {loading ? <div className="s2-loading"><Loader2 className="s2-spin" size={22} />Đang tải dữ liệu...</div> : tab === 'catalog' ? (
        <div className="s2-panel">
          <div className="s2-panel-heading"><div><h2>Danh mục gian hàng vật lý</h2><p>Một vị trí có thể dùng cho các sự kiện không trùng thời gian.</p></div><button className="btn-org-primary" type="button" onClick={() => { setEditingBooth(null); setBoothForm({ ...EMPTY_FORM }); setShowBoothForm(true); }}><Plus size={16} />Thêm gian hàng</button></div>
          <div className="s2-card-grid">
            {physicalBooths.map(booth => <article className="s2-booth-card" key={booth.boothId}>
              <div className="s2-booth-card-top"><strong>{booth.code}</strong><span className={`s2-status ${booth.active ? 'available' : 'unavailable'}`}>{booth.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></div>
              <h3>{booth.name}</h3><p>{booth.description || 'Chưa có mô tả.'}</p>
              <dl><div><dt>Danh mục</dt><dd>{booth.categoryCode || '—'}</dd></div><div><dt>Sức chứa</dt><dd>{booth.maxCapacity}</dd></div></dl>
              <button type="button" className="s2-link-button" onClick={() => { setEditingBooth(booth); setBoothForm(formFromBooth(booth)); setShowBoothForm(true); }}><Edit3 size={14} />Chỉnh sửa</button>
            </article>)}
            {!physicalBooths.length && <div className="s2-empty"><Store size={30} /><strong>Chưa có gian hàng vật lý</strong></div>}
          </div>
        </div>
      ) : tab === 'configuration' ? (
        <div className="s2-panel">
          <div className="s2-panel-heading"><div><h2>Cấu hình theo sự kiện</h2><p>Giá thuê và trạng thái mở chỉ áp dụng cho sự kiện đang chọn.</p></div></div>
          <div className="s2-config-list">{eventBooths.map(row => <ConfigurationRow key={`${row.booth.boothId}-${row.rentalPrice}-${row.enabled}`} row={row} busy={busyKey === `config-${row.booth.boothId}`} onSave={saveConfiguration} />)}{!eventBooths.length && <div className="s2-empty">Chưa có gian hàng để cấu hình.</div>}</div>
        </div>
      ) : (
        <div className="s2-panel">
          <div className="s2-panel-heading"><div><h2>Ứng viên gian hàng</h2><p>Chọn một yêu cầu sẽ tạo Hold; các ứng viên khác vẫn chờ duyệt.</p></div></div>
          <div className="s2-request-list">{requests.map(request => <article className="s2-request-card" key={request.boothRequestId}>
            <div className="s2-request-main"><div><span className={`s2-status request-${request.status.toLowerCase()}`}>{requestStatusLabel[request.status]}</span><h3>{request.partnerOrganizationName}</h3><p>Gian <strong>{request.boothCode}</strong> · {dateTime(request.submittedAt)}</p></div><p className="s2-request-note">{request.requestNote || 'Không có ghi chú từ đối tác.'}</p></div>
            {request.hold && <div className="s2-hold-summary"><Clock3 size={17} /><div><strong>{money(request.hold.lockedRentalPrice)}</strong><span>Giữ đến {dateTime(request.hold.expiresAt)}</span></div></div>}
            {request.reviewNote && <p className="s2-review-note"><strong>Phản hồi:</strong> {request.reviewNote}</p>}
            {request.status === 'PENDING' && <div className="s2-actions"><button className="btn-org-secondary" type="button" onClick={() => { setRejectingRequest(request); setReviewNote(''); }}>Từ chối</button><button className="btn-org-primary" type="button" disabled={busyKey === `request-${request.boothRequestId}`} onClick={() => void selectRequest(request)}>Chọn & giữ chỗ</button></div>}
          </article>)}{!requests.length && <div className="s2-empty">Chưa có yêu cầu gian hàng cho sự kiện này.</div>}</div>
        </div>
      )}

      {showBoothForm && <div className="s2-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowBoothForm(false); }}><div className="s2-modal" role="dialog" aria-modal="true" aria-labelledby="booth-form-title">
        <div className="s2-modal-header"><div><span className="s2-eyebrow">Gian hàng vật lý</span><h2 id="booth-form-title">{editingBooth ? 'Chỉnh sửa gian hàng' : 'Tạo gian hàng mới'}</h2></div><button type="button" aria-label="Đóng" onClick={() => setShowBoothForm(false)}><X size={20} /></button></div>
        <form onSubmit={submitBooth} className="s2-form">
          <label>Mã gian hàng<input value={boothForm.code} disabled={Boolean(editingBooth)} maxLength={30} required onChange={event => setBoothForm(current => ({ ...current, code: event.target.value }))} /></label>
          <label>Tên gian hàng<input value={boothForm.name} maxLength={100} required onChange={event => setBoothForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label>Sức chứa<input type="number" min="1" step="1" value={boothForm.maxCapacity} required onChange={event => setBoothForm(current => ({ ...current, maxCapacity: event.target.value }))} /></label>
          <label>Mã danh mục<input value={boothForm.categoryCode} maxLength={50} onChange={event => setBoothForm(current => ({ ...current, categoryCode: event.target.value }))} /></label>
          <label>Tọa độ X<input type="number" step="0.01" value={boothForm.mapX} onChange={event => setBoothForm(current => ({ ...current, mapX: event.target.value }))} /></label>
          <label>Tọa độ Y<input type="number" step="0.01" value={boothForm.mapY} onChange={event => setBoothForm(current => ({ ...current, mapY: event.target.value }))} /></label>
          <label className="s2-form-wide">Mô tả<textarea rows={3} value={boothForm.description} onChange={event => setBoothForm(current => ({ ...current, description: event.target.value }))} /></label>
          <label className="s2-form-wide">Ghi chú<textarea rows={2} value={boothForm.note} onChange={event => setBoothForm(current => ({ ...current, note: event.target.value }))} /></label>
          {editingBooth && <label className="s2-checkbox s2-form-wide"><input type="checkbox" checked={boothForm.active} onChange={event => setBoothForm(current => ({ ...current, active: event.target.checked }))} />Gian hàng đang hoạt động</label>}
          <div className="s2-modal-actions s2-form-wide"><button type="button" className="btn-org-secondary" onClick={() => setShowBoothForm(false)}>Hủy</button><button type="submit" className="btn-org-primary" disabled={busyKey === 'booth-form'}>{busyKey === 'booth-form' ? 'Đang lưu...' : 'Lưu gian hàng'}</button></div>
        </form>
      </div></div>}

      {rejectingRequest && <div className="s2-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRejectingRequest(null); }}><div className="s2-modal s2-modal-small" role="dialog" aria-modal="true" aria-labelledby="reject-title">
        <div className="s2-modal-header"><div><span className="s2-eyebrow">Yêu cầu {rejectingRequest.boothCode}</span><h2 id="reject-title">Từ chối yêu cầu</h2></div><button type="button" aria-label="Đóng" onClick={() => setRejectingRequest(null)}><X size={20} /></button></div>
        <form onSubmit={rejectRequest} className="s2-stack-form"><label>Lý do từ chối<textarea autoFocus rows={4} maxLength={1000} required value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></label><div className="s2-modal-actions"><button type="button" className="btn-org-secondary" onClick={() => setRejectingRequest(null)}>Hủy</button><button type="submit" className="btn-org-primary" disabled={!reviewNote.trim() || Boolean(busyKey)}>Xác nhận từ chối</button></div></form>
      </div></div>}
    </section>
  );
};

const ConfigurationRow: React.FC<{ row: EventBooth; busy: boolean; onSave: (row: EventBooth, rentalPrice: number, enabled: boolean) => Promise<void> }> = ({ row, busy, onSave }) => {
  const [price, setPrice] = useState(row.rentalPrice === null ? '0' : String(row.rentalPrice));
  const [enabled, setEnabled] = useState(row.enabled);
  return <article className="s2-config-row">
    <div className="s2-config-identity"><strong>{row.booth.code}</strong><div><h3>{row.booth.name}</h3><p>{row.booth.categoryCode || 'Chưa phân loại'} · Sức chứa {row.booth.maxCapacity}</p></div></div>
    <label>Giá thuê (VND)<input type="number" min="0" step="1000" value={price} onChange={event => setPrice(event.target.value)} /></label>
    <label className="s2-toggle"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span>{enabled ? 'Đang mở' : 'Đang đóng'}</span></label>
    <span className={`s2-status ${row.availability.toLowerCase()}`}>{availabilityLabel[row.availability]}</span>
    <button type="button" className="btn-org-secondary" disabled={busy} onClick={() => void onSave(row, Number(price), enabled)}>{busy ? 'Đang lưu...' : 'Lưu'}</button>
  </article>;
};
