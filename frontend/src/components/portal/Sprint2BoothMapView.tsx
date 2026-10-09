import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, MapPin, RefreshCw, Save, Store } from 'lucide-react';
import type { Language } from '../../types';
import type { EventBooth, PhysicalBooth } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
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
  onOpenRequests: () => void;
}

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

export const Sprint2BoothMapView: React.FC<Props> = ({
  events,
  selectedEventId,
  onSelectEventId,
  onOpenRequests,
}) => {
  const eventId = selectedEventId !== 'all' ? selectedEventId : events[0]?.id || '';
  const currentEvent = events.find(event => event.id === eventId);
  const [physicalBooths, setPhysicalBooths] = useState<PhysicalBooth[]>([]);
  const [configurations, setConfigurations] = useState<EventBooth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState<number | null>(null);
  const [draftX, setDraftX] = useState('');
  const [draftY, setDraftY] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [booths, rows] = await Promise.all([
        boothApi.listAllPhysicalBooths(),
        eventId ? boothApi.listEventBoothConfigurations(eventId) : Promise.resolve([]),
      ]);
      setPhysicalBooths(booths);
      setConfigurations(rows);
      setSelectedBoothId(current => booths.some(booth => booth.boothId === current) ? current : booths[0]?.boothId ?? null);
    } catch (caughtError) {
      setPhysicalBooths([]);
      setConfigurations([]);
      setError(apiMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const configurationByBooth = useMemo(
    () => new Map(configurations.map(row => [row.booth.boothId, row])),
    [configurations],
  );
  const selectedBooth = physicalBooths.find(booth => booth.boothId === selectedBoothId) || null;

  useEffect(() => {
    setDraftX(selectedBooth?.mapX == null ? '' : String(selectedBooth.mapX));
    setDraftY(selectedBooth?.mapY == null ? '' : String(selectedBooth.mapY));
  }, [selectedBooth]);

  const markers = useMemo(() => physicalBooths.flatMap(booth => {
    const configured = configurationByBooth.get(booth.boothId);
    const marker = configured
      ? eventBoothToMarker(configured)
      : physicalBoothToMarker(booth);
    if (!marker) return [];
    return [{ ...marker, status: configured?.availability || (eventId ? 'UNAVAILABLE' : 'PHYSICAL') } satisfies BoothMapMarker];
  }), [configurationByBooth, eventId, physicalBooths]);

  const draftMarker = useMemo<BoothMapMarker | null>(() => {
    if (!selectedBooth) return null;
    const x = Number(draftX);
    const y = Number(draftY);
    if (draftX.trim() === '' || draftY.trim() === '' || !Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || x > 100 || y < 0 || y > 100) return null;
    const configured = configurationByBooth.get(selectedBooth.boothId);
    return {
      id: `booth-${selectedBooth.boothId}`,
      boothId: selectedBooth.boothId,
      code: selectedBooth.code,
      name: selectedBooth.name,
      x,
      y,
      status: configured?.availability || (eventId ? 'UNAVAILABLE' : 'PHYSICAL'),
    };
  }, [configurationByBooth, draftX, draftY, eventId, selectedBooth]);

  const previewMarkers = draftMarker
    ? [...markers.filter(marker => marker.boothId !== draftMarker.boothId), draftMarker]
    : markers;

  const selectBooth = (boothId: number) => {
    setSelectedBoothId(boothId);
    setError('');
  };

  const saveCoordinates = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!selectedBooth || !draftMarker) {
      setError('Vui lòng nhập đủ X và Y trong khoảng 0–100.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await boothApi.updatePhysicalBooth(selectedBooth.boothId, {
        mapX: draftMarker.x,
        mapY: draftMarker.y,
      });
      setPhysicalBooths(current => current.map(booth => booth.boothId === updated.boothId ? updated : booth));
      setSuccess(`Đã lưu vị trí ${updated.code} trên bản đồ.`);
    } catch (caughtError) {
      setError(apiMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="s2-booth-page" aria-labelledby="organizer-map-title">
      <header className="s2-booth-header">
        <div>
          <span className="s2-eyebrow">Sprint 2 · Bản đồ gian hàng</span>
          <h1 id="organizer-map-title">Vị trí gian hàng trên Đường Sách</h1>
          <p>Dữ liệu vị trí vật lý và trạng thái theo sự kiện được tải trực tiếp từ Sprint 2 API.</p>
        </div>
        <button className="btn-org-secondary" type="button" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} />Làm mới
        </button>
      </header>

      <div className="s2-event-bar">
        <label htmlFor="s2-organizer-map-event">Sự kiện đang hiển thị</label>
        <select id="s2-organizer-map-event" value={eventId} onChange={event => onSelectEventId(event.target.value)}>
          {events.map(event => <option value={event.id} key={event.id}>{event.title}</option>)}
        </select>
        {currentEvent && <span>{currentEvent.statusLabelVi}</span>}
        <button type="button" className="s2-link-button" onClick={onOpenRequests}>Mở cấu hình & yêu cầu</button>
      </div>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      {loading ? <div className="s2-loading"><Loader2 className="s2-spin" size={22} />Đang tải dữ liệu bản đồ...</div> : (
        <div className="s2-map-management-grid">
          <div className="s2-panel s2-map-panel">
            <div className="s2-panel-heading">
              <div><h2>Sơ đồ vị trí</h2><p>{BOOTH_MAP_COORDINATE_HELP}</p></div>
              <span className="s2-map-count"><MapPin size={15} />{markers.length}/{physicalBooths.length} đã định vị</span>
            </div>
            <BoothMapCanvas
              markers={previewMarkers}
              selectedMarkerId={selectedBooth ? `booth-${selectedBooth.boothId}` : null}
              onSelectMarker={marker => selectBooth(marker.boothId)}
              ariaLabel="Bản đồ gian hàng dành cho Organizer"
            />
          </div>

          <aside className="s2-panel s2-map-sidebar" aria-label="Danh sách và tọa độ gian hàng">
            <h2>Gian hàng vật lý</h2>
            <div className="s2-map-booth-list">
              {physicalBooths.map(booth => {
                const configured = configurationByBooth.get(booth.boothId);
                return <button
                  type="button"
                  key={booth.boothId}
                  className={selectedBoothId === booth.boothId ? 'is-selected' : ''}
                  onClick={() => selectBooth(booth.boothId)}
                >
                  <span><strong>{booth.code}</strong>{booth.name}</span>
                  <small>{hasValidMapCoordinates(booth) ? `${booth.mapX}%, ${booth.mapY}%` : 'Chưa định vị'}</small>
                  <small>{booth.categoryCode || 'Chưa phân loại'} · {configured ? (configured.enabled ? 'Đang mở' : 'Đang đóng') : (eventId ? 'Chưa cấu hình' : 'Gian vật lý')}</small>
                  <small>{configured ? `${money(configured.rentalPrice)} · ${markerStatusLabel(configured.availability)}` : (eventId ? 'Chưa cấu hình cho sự kiện' : 'Không áp dụng trạng thái sự kiện')}</small>
                </button>;
              })}
              {!physicalBooths.length && <div className="s2-empty"><Store size={28} />Chưa có gian hàng vật lý.</div>}
            </div>

            {selectedBooth && <form className="s2-coordinate-form" onSubmit={saveCoordinates}>
              <div><strong>{selectedBooth.code}</strong><span>{selectedBooth.name}</span></div>
              <p>{BOOTH_MAP_COORDINATE_HELP}</p>
              <div className="s2-coordinate-inputs">
                <label>Tọa độ X (%)<input aria-label="Tọa độ X (%)" type="number" min="0" max="100" step="0.01" value={draftX} onChange={event => setDraftX(event.target.value)} /></label>
                <label>Tọa độ Y (%)<input aria-label="Tọa độ Y (%)" type="number" min="0" max="100" step="0.01" value={draftY} onChange={event => setDraftY(event.target.value)} /></label>
              </div>
              {!hasValidMapCoordinates(selectedBooth) && <small className="s2-blocked-reason">Gian hàng này sẽ không xuất hiện với Partner/Public cho đến khi có đủ hai tọa độ hợp lệ.</small>}
              <button type="submit" className="btn-org-primary" disabled={saving || !draftMarker}><Save size={15} />{saving ? 'Đang lưu...' : 'Lưu vị trí'}</button>
            </form>}
          </aside>
        </div>
      )}
    </section>
  );
};
