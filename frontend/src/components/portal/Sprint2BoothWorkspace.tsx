import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  Edit3,
  Layers,
  Loader2,
  MapPin,
  Move,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { BoothRequest, CreatePhysicalBoothInput, EventBooth, PhysicalBooth } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import { BoothMapCanvas } from '../booth-map/BoothMapCanvas';
import {
  BOOTH_MAP_COORDINATE_HELP,
  eventBoothToMarker,
  hasValidMapCoordinates,
  markerStatusLabel,
  physicalBoothToMarker,
  type BoothMapMarker,
} from '../booth-map/boothMapModel';
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
  AVAILABLE: 'Còn trống', ON_HOLD: 'Đang giữ chỗ', ASSIGNED: 'Đã thuê / Phân bổ', UNAVAILABLE: 'Chưa mở',
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
  const [tab, setTab] = useState<'map' | 'catalog' | 'configuration' | 'requests'>('map');
  const [physicalBooths, setPhysicalBooths] = useState<PhysicalBooth[]>([]);
  const [eventBooths, setEventBooths] = useState<EventBooth[]>([]);
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyKey, setBusyKey] = useState('');

  // Map Positioning States
  const [selectedBoothId, setSelectedBoothId] = useState<number | null>(null);
  const [draftCoords, setDraftCoords] = useState<Record<number, { x: number; y: number }>>({});
  const [savingPosition, setSavingPosition] = useState(false);

  // Booth Modal Form States
  const [editingBooth, setEditingBooth] = useState<PhysicalBooth | null>(null);
  const [boothForm, setBoothForm] = useState<BoothFormState>({ ...EMPTY_FORM });
  const [showBoothForm, setShowBoothForm] = useState(false);

  // Request Reject Modal
  const [rejectingRequest, setRejectingRequest] = useState<BoothRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const eventId = selectedEventId !== 'all' ? selectedEventId : events[0]?.id || '';
  const currentEvent = useMemo(() => events.find(event => event.id === eventId), [eventId, events]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const physicalBooths = await boothApi.listAllPhysicalBooths();
      setPhysicalBooths(physicalBooths);
      if (eventId) {
        const [configurations, eventRequests] = await Promise.all([
          boothApi.listEventBoothConfigurations(eventId),
          boothApi.listAllOrganizerRequests(eventId),
        ]);
        const configurationByBoothId = new Map(
          configurations.map(configuration => [configuration.booth.boothId, configuration]),
        );
        setEventBooths(physicalBooths.map(booth => configurationByBoothId.get(booth.boothId) || {
          eventBoothConfigId: null,
          eventId: Number(eventId),
          booth,
          rentalPrice: null,
          enabled: false,
          availability: 'UNAVAILABLE' as const,
        }));
        setRequests(eventRequests);
      } else {
        setEventBooths([]);
        setRequests([]);
      }
      setSelectedBoothId(curr => (physicalBooths.some(b => b.boothId === curr) ? curr : physicalBooths[0]?.boothId ?? null));
    } catch (caughtError) {
      setPhysicalBooths([]);
      setEventBooths([]);
      setRequests([]);
      setError(apiMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Auto dismiss success toast
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  const configurationByBooth = useMemo(
    () => new Map(eventBooths.map(row => [row.booth.boothId, row])),
    [eventBooths],
  );

  const selectedBooth = physicalBooths.find(b => b.boothId === selectedBoothId) || null;
  const currentDraft = selectedBoothId ? draftCoords[selectedBoothId] : undefined;

  // Selected booth coordinate inputs
  const currentX = currentDraft ? currentDraft.x : selectedBooth?.mapX ?? '';
  const currentY = currentDraft ? currentDraft.y : selectedBooth?.mapY ?? '';

  // Markers with draft position override
  const markers = useMemo<BoothMapMarker[]>(() => {
    return physicalBooths.flatMap(booth => {
      const configured = configurationByBooth.get(booth.boothId);
      const draft = draftCoords[booth.boothId];

      const x = draft ? draft.x : booth.mapX;
      const y = draft ? draft.y : booth.mapY;

      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
        return [];
      }

      const status = configured ? configured.availability : (eventId ? 'UNAVAILABLE' : 'PHYSICAL');

      return [{
        id: `booth-${booth.boothId}`,
        boothId: booth.boothId,
        code: booth.code,
        name: booth.name,
        x,
        y,
        status,
      }];
    });
  }, [physicalBooths, configurationByBooth, draftCoords, eventId]);

  // Handle position change on drag or map click
  const handlePositionChange = (markerOrBoothId: string | number, newX: number, newY: number) => {
    const boothId = typeof markerOrBoothId === 'number'
      ? markerOrBoothId
      : Number(markerOrBoothId.replace('booth-', ''));

    if (isNaN(boothId)) return;

    setDraftCoords(prev => ({
      ...prev,
      [boothId]: { x: newX, y: newY },
    }));
    setSelectedBoothId(boothId);
  };

  // Save coordinates to backend
  const handleSaveCoordinates = async (boothId: number) => {
    const targetBooth = physicalBooths.find(b => b.boothId === boothId);
    const coords = draftCoords[boothId];
    if (!targetBooth || !coords) return;

    setSavingPosition(true);
    setError('');
    setSuccess('');
    try {
      const updated = await boothApi.updatePhysicalBooth(boothId, {
        mapX: coords.x,
        mapY: coords.y,
      });
      setPhysicalBooths(prev => prev.map(b => (b.boothId === updated.boothId ? updated : b)));
      setDraftCoords(prev => {
        const next = { ...prev };
        delete next[boothId];
        return next;
      });
      setSuccess(`Đã lưu thành công tọa độ cho gian hàng "${updated.code}" (X: ${updated.mapX}%, Y: ${updated.mapY}%).`);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setSavingPosition(false);
    }
  };

  // Reset drafted coordinates
  const handleResetDraft = (boothId: number) => {
    setDraftCoords(prev => {
      const next = { ...prev };
      delete next[boothId];
      return next;
    });
  };

  // Submit create/edit booth
  const submitBooth = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setError('');
    const mapX = boothForm.mapX === '' ? null : Number(boothForm.mapX);
    const mapY = boothForm.mapY === '' ? null : Number(boothForm.mapY);

    if (!boothForm.code.trim() || !boothForm.name.trim()) {
      setError('Mã và tên gian hàng là bắt buộc.');
      return;
    }
    if ((mapX !== null && !Number.isFinite(mapX)) || (mapY !== null && !Number.isFinite(mapY))) {
      setError('Tọa độ gian hàng phải là số hợp lệ.');
      return;
    }
    const input: CreatePhysicalBoothInput = {
      code: boothForm.code.trim(),
      name: boothForm.name.trim(),
      description: boothForm.description.trim() || null,
      maxCapacity: 1,
      mapX,
      mapY,
      categoryCode: boothForm.categoryCode.trim() || null,
      note: boothForm.note.trim() || null,
    };
    setBusyKey('booth-form');
    try {
      if (editingBooth) {
        const { code: _code, ...updateInput } = input;
        await boothApi.updatePhysicalBooth(editingBooth.boothId, { ...updateInput, active: boothForm.active });
        setSuccess('Đã cập nhật gian hàng vật lý thành công.');
      } else {
        await boothApi.createPhysicalBooth(input);
        setSuccess('Đã thêm gian hàng mới vào danh mục.');
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

  // Status counts
  const availableCount = eventBooths.filter(r => r.availability === 'AVAILABLE').length;
  const onHoldCount = eventBooths.filter(r => r.availability === 'ON_HOLD').length;
  const assignedCount = eventBooths.filter(r => r.availability === 'ASSIGNED').length;
  const unavailableCount = eventBooths.filter(r => r.availability === 'UNAVAILABLE').length;

  return (
    <section className="s2-booth-page" aria-labelledby="organizer-booth-title">
      <header className="s2-booth-header">
        <div>
          <h1 id="organizer-booth-title" className="organizer-view-title">Sơ đồ & Yêu cầu gian hàng</h1>
          <p className="organizer-view-sub">Định vị trực quan trên bản đồ, quản lý giá theo sự kiện và phê duyệt giữ chỗ của đối tác.</p>
        </div>
        <button className="btn-org-secondary" type="button" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* Event Selector */}
      <div className="s2-event-bar">
        <label htmlFor="s2-organizer-event">Sự kiện đang quản lý</label>
        <select id="s2-organizer-event" value={eventId} onChange={event => onSelectEventId(event.target.value)}>
          {events.map(event => <option value={event.id} key={event.id}>{event.title}</option>)}
        </select>
        {currentEvent && <span>{currentEvent.statusLabelVi}</span>}
      </div>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      {/* Workspace Tabs */}
      <nav className="s2-tabs" aria-label="Quản lý gian hàng">
        <button type="button" className={tab === 'map' ? 'is-active' : ''} onClick={() => setTab('map')}>
          <MapPin size={16} />
          <span>Sơ đồ & Định vị bản đồ</span>
          <span>{markers.length}/{physicalBooths.length}</span>
        </button>
        <button type="button" className={tab === 'configuration' ? 'is-active' : ''} onClick={() => setTab('configuration')}>
          <DollarSign size={16} />
          <span>Cấu hình sự kiện</span>
          <span>{eventBooths.filter(row => row.enabled).length}</span>
        </button>
        <button type="button" className={tab === 'requests' ? 'is-active' : ''} onClick={() => setTab('requests')}>
          <Clock3 size={16} />
          <span>Yêu cầu đối tác</span>
          <span>{requests.filter(row => row.status === 'PENDING').length}</span>
        </button>
        <button type="button" className={tab === 'catalog' ? 'is-active' : ''} onClick={() => setTab('catalog')}>
          <Store size={16} />
          <span>Danh mục gian hàng</span>
          <span>{physicalBooths.length}</span>
        </button>
      </nav>

      {loading ? (
        <div className="s2-loading"><Loader2 className="s2-spin" size={24} />Đang tải dữ liệu gian hàng...</div>
      ) : (
        <>
          {/* TAB 1: SƠ ĐỒ & ĐỊNH VỊ BẢN ĐỒ (INTERACTIVE MAP) */}
          {tab === 'map' && (
            <div className="s2-map-management-grid">
              {/* Left Column: Interactive Map */}
              <div className="s2-panel s2-map-panel">
                <div className="s2-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2>Bản đồ vị trí gian hàng</h2>
                    <p>💡 <strong>Kéo thả</strong> chấm gian hàng hoặc <strong>click trực tiếp</strong> lên sơ đồ để đặt vị trí, sau đó bấm <strong>Lưu vị trí</strong>.</p>
                  </div>

                  {/* Summary Status Badges */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="s2-status available">🟢 Còn trống: {availableCount}</span>
                    <span className="s2-status on_hold">🟠 Chờ duyệt / Giữ chỗ: {onHoldCount}</span>
                    <span className="s2-status assigned">🟣 Đã thuê / Phân bổ: {assignedCount}</span>
                    <span className="s2-status unavailable">⚪ Chưa mở: {unavailableCount}</span>
                  </div>
                </div>

                <BoothMapCanvas
                  markers={markers}
                  selectedMarkerId={selectedBoothId ? `booth-${selectedBoothId}` : null}
                  onSelectMarker={marker => setSelectedBoothId(marker.boothId)}
                  onPositionChange={handlePositionChange}
                  editable={true}
                  ariaLabel="Sơ đồ mặt bằng Đường Sách tương tác"
                  emptyMessage="Chưa có gian hàng nào được định vị trên bản đồ."
                />
              </div>

              {/* Right Column: Coordinate Editor & Booth Selector */}
              <aside className="s2-panel s2-map-sidebar" aria-label="Định vị tọa độ gian hàng">
                <h2>Chọn & Lưu vị trí</h2>

                {selectedBooth ? (
                  <div className="s2-coordinate-form" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <div style={{ background: '#F8FAF9', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2EAE5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#17382E', fontSize: '1.1rem' }}>{selectedBooth.code}</strong>
                        {configurationByBooth.get(selectedBooth.boothId) && (
                          <span className={`s2-status ${configurationByBooth.get(selectedBooth.boothId)?.availability.toLowerCase()}`}>
                            {availabilityLabel[configurationByBooth.get(selectedBooth.boothId)!.availability]}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.88rem', color: '#4B5563', display: 'block' }}>{selectedBooth.name}</span>
                      {selectedBooth.description && (
                        <small style={{ color: '#6B7280', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                          {selectedBooth.description}
                        </small>
                      )}
                    </div>

                    <div className="s2-coordinate-inputs">
                      <label>
                        Tọa độ X (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={currentX}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            handlePositionChange(selectedBooth.boothId, val, Number(currentY) || 0);
                          }}
                        />
                      </label>
                      <label>
                        Tọa độ Y (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={currentY}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            handlePositionChange(selectedBooth.boothId, Number(currentX) || 0, val);
                          }}
                        />
                      </label>
                    </div>

                    {currentDraft && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-org-primary"
                          style={{ flex: 1 }}
                          disabled={savingPosition}
                          onClick={() => handleSaveCoordinates(selectedBooth.boothId)}
                        >
                          <Save size={15} />
                          <span>{savingPosition ? 'Đang lưu...' : 'Lưu vị trí'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-org-secondary"
                          onClick={() => handleResetDraft(selectedBooth.boothId)}
                          disabled={savingPosition}
                          title="Hủy thay đổi chưa lưu"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}

                    {!currentDraft && (
                      <div style={{ fontSize: '0.78rem', color: '#6B7280', fontStyle: 'italic', textAlign: 'center', padding: '0.35rem' }}>
                        {hasValidMapCoordinates(selectedBooth)
                          ? `✓ Đã định vị tại X: ${selectedBooth.mapX}%, Y: ${selectedBooth.mapY}%`
                          : '⚠️ Gian hàng chưa có tọa độ. Hãy click lên bản đồ để đặt vị trí.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="s2-empty" style={{ minHeight: '100px' }}>
                    <MapPin size={24} />
                    <p>Chọn một gian hàng bên dưới để định vị</p>
                  </div>
                )}

                {/* Booth List Selector */}
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid #E2EAE5', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#17382E', display: 'block', marginBottom: '0.5rem' }}>
                    Danh sách gian hàng ({physicalBooths.length})
                  </span>
                  <div className="s2-map-booth-list" style={{ maxHeight: '280px' }}>
                    {physicalBooths.map(booth => {
                      const configured = configurationByBooth.get(booth.boothId);
                      const isSelected = selectedBoothId === booth.boothId;
                      const hasDraft = !!draftCoords[booth.boothId];
                      const isMapped = hasValidMapCoordinates(booth);

                      return (
                        <button
                          type="button"
                          key={booth.boothId}
                          className={`${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedBoothId(booth.boothId)}
                          style={{ position: 'relative' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#17382E' }}>{booth.code}</span>
                            {configured && (
                              <span className={`s2-status ${configured.availability.toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                                {availabilityLabel[configured.availability]}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.82rem', color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {booth.name}
                          </span>
                          <small style={{ color: hasDraft ? '#B45309' : isMapped ? '#059669' : '#9CA3AF', fontWeight: hasDraft ? 700 : 500 }}>
                            {hasDraft
                              ? `● Đang chỉnh sửa (X:${draftCoords[booth.boothId].x}, Y:${draftCoords[booth.boothId].y})`
                              : isMapped
                              ? `✓ X:${booth.mapX}%, Y:${booth.mapY}%`
                              : '○ Chưa định vị'}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* TAB 2: GIAN HÀNG VẬT LÝ */}
          {tab === 'catalog' && (
            <div className="s2-panel">
              <div className="s2-panel-heading">
                <div><h2>Danh mục gian hàng vật lý</h2><p>Một vị trí có thể dùng cho các sự kiện không trùng thời gian.</p></div>
                <button type="button" className="btn-org-primary" onClick={() => { setEditingBooth(null); setBoothForm({ ...EMPTY_FORM }); setShowBoothForm(true); }}>
                  <Plus size={16} />Thêm gian hàng
                </button>
              </div>
              <div className="s2-card-grid">
                {physicalBooths.map(booth => (
                  <article className="s2-booth-card" key={booth.boothId}>
                    <div className="s2-booth-card-top">
                      <strong>{booth.code}</strong>
                      <span className={`s2-status ${booth.active ? 'available' : 'unavailable'}`}>
                        {booth.active ? 'Đang hoạt động' : 'Tạm ngưng'}
                      </span>
                    </div>
                    <h3>{booth.name}</h3>
                    <p>{booth.description || 'Chưa có mô tả vị trí.'}</p>
                    <dl>
                      <div><dt>Thể loại</dt><dd>{booth.categoryCode || 'Chưa phân loại'}</dd></div>
                      <div><dt>Tọa độ</dt><dd>{hasValidMapCoordinates(booth) ? `${booth.mapX}%, ${booth.mapY}%` : 'Chưa định vị'}</dd></div>
                    </dl>
                    <div className="s2-actions">
                      <button type="button" className="s2-link-button" onClick={() => { setEditingBooth(booth); setBoothForm(formFromBooth(booth)); setShowBoothForm(true); }}>
                        <Edit3 size={15} />Chỉnh sửa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CẤU HÌNH SỰ KIỆN */}
          {tab === 'configuration' && (
            <div className="s2-panel">
              <div className="s2-panel-heading">
                <div><h2>Cấu hình gian hàng cho sự kiện</h2><p>Thiết lập giá thuê và mở đăng ký cho từng gian hàng trong sự kiện.</p></div>
              </div>
              <div className="s2-config-list">
                {eventBooths.map(row => (
                  <div className="s2-config-row" key={row.booth.boothId}>
                    <div className="s2-config-identity">
                      <strong>{row.booth.code}</strong>
                      <div>
                        <h3>{row.booth.name}</h3>
                        <p>{row.booth.categoryCode || 'Chưa phân loại'}</p>
                      </div>
                    </div>
                    <div>
                      <span className={`s2-status ${row.availability.toLowerCase()}`}>
                        {availabilityLabel[row.availability]}
                      </span>
                    </div>
                    <label>
                      Giá thuê (VNĐ)
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        defaultValue={row.rentalPrice ?? ''}
                        onBlur={e => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val >= 0) saveConfiguration(row, val, row.enabled);
                        }}
                      />
                    </label>
                    <label className="s2-toggle">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        disabled={busyKey === `config-${row.booth.boothId}`}
                        onChange={e => saveConfiguration(row, row.rentalPrice ?? 2000000, e.target.checked)}
                      />
                      <span>{row.enabled ? 'Mở đăng ký' : 'Tạm khóa'}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: YÊU CẦU ĐỐI TÁC */}
          {tab === 'requests' && (
            <div className="s2-panel">
              <div className="s2-panel-heading">
                <div><h2>Yêu cầu thuê gian hàng từ đối tác</h2><p>Duyệt chọn đối tác phù hợp và giữ chỗ gian hàng cho sự kiện.</p></div>
              </div>
              {requests.length === 0 ? (
                <div className="s2-empty"><Store size={32} /><p>Chưa có yêu cầu đăng ký gian hàng nào cho sự kiện này.</p></div>
              ) : (
                <div className="s2-request-list">
                  {requests.map(req => (
                    <div className="s2-request-card" key={req.boothRequestId}>
                      <div className="s2-request-main">
                        <div>
                          <span className={`s2-status request-${req.status.toLowerCase()}`}>{requestStatusLabel[req.status]}</span>
                          <h3>{req.partnerOrganizationName} — Gian {req.boothCode}</h3>
                          <small style={{ color: '#6B7280' }}>Gửi lúc: {dateTime(req.submittedAt)}</small>
                        </div>
                        {req.status === 'PENDING' && (
                          <div className="s2-actions">
                            <button type="button" className="btn-org-secondary" onClick={() => { setRejectingRequest(req); setReviewNote(''); }}>
                              Từ chối
                            </button>
                            <button type="button" className="btn-org-primary" onClick={() => selectRequest(req)}>
                              Duyệt & Giữ chỗ
                            </button>
                          </div>
                        )}
                      </div>
                      {req.requestNote && <div className="s2-request-note"><p><strong>Ghi chú đối tác:</strong> {req.requestNote}</p></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT BOOTH MODAL */}
      {showBoothForm && (
        <div className="s2-modal-backdrop" onClick={() => setShowBoothForm(false)}>
          <div className="s2-modal" onClick={e => e.stopPropagation()}>
            <div className="s2-modal-header">
              <h2>{editingBooth ? `Chỉnh sửa ${editingBooth.code}` : 'Thêm gian hàng mới'}</h2>
              <button type="button" onClick={() => setShowBoothForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submitBooth} className="s2-form">
              <label>
                Mã gian hàng *
                <input
                  type="text"
                  value={boothForm.code}
                  disabled={!!editingBooth}
                  onChange={e => setBoothForm({ ...boothForm, code: e.target.value })}
                  required
                />
              </label>
              <label>
                Tên gian hàng *
                <input
                  type="text"
                  value={boothForm.name}
                  onChange={e => setBoothForm({ ...boothForm, name: e.target.value })}
                  required
                />
              </label>
              <label className="s2-form-wide">
                Mô tả
                <textarea
                  rows={2}
                  value={boothForm.description}
                  onChange={e => setBoothForm({ ...boothForm, description: e.target.value })}
                />
              </label>
              <label>
                Tọa độ X (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={boothForm.mapX}
                  onChange={e => setBoothForm({ ...boothForm, mapX: e.target.value })}
                />
              </label>
              <label>
                Tọa độ Y (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={boothForm.mapY}
                  onChange={e => setBoothForm({ ...boothForm, mapY: e.target.value })}
                />
              </label>
              <div className="s2-modal-actions s2-form-wide">
                <button type="button" className="btn-org-secondary" onClick={() => setShowBoothForm(false)}>Hủy</button>
                <button type="submit" className="btn-org-primary" disabled={busyKey === 'booth-form'}>
                  {busyKey === 'booth-form' ? 'Đang lưu...' : editingBooth ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT REQUEST MODAL */}
      {rejectingRequest && (
        <div className="s2-modal-backdrop" onClick={() => setRejectingRequest(null)}>
          <div className="s2-modal s2-modal-small" onClick={e => e.stopPropagation()}>
            <div className="s2-modal-header">
              <h2>Từ chối yêu cầu gian hàng</h2>
              <button type="button" onClick={() => setRejectingRequest(null)}><X size={20} /></button>
            </div>
            <form onSubmit={rejectRequest} className="s2-stack-form">
              <p>Bạn sắp từ chối yêu cầu của <strong>{rejectingRequest.partnerOrganizationName}</strong> cho gian <strong>{rejectingRequest.boothCode}</strong>.</p>
              <label>
                Lý do từ chối *
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Nhập lý do từ chối để thông báo cho đối tác..."
                  required
                />
              </label>
              <div className="s2-modal-actions">
                <button type="button" className="btn-org-secondary" onClick={() => setRejectingRequest(null)}>Hủy</button>
                <button type="submit" className="btn-org-primary" style={{ background: '#991B1B' }} disabled={busyKey.startsWith('request-') || !reviewNote.trim()}>
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
