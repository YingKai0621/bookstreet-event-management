import { PaginatedList } from '../ui/PaginatedList';
import { AlertCircle, Check, DollarSign, Loader2, RefreshCw, Store } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { EventBooth } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import './Sprint2Booth.css';

interface Props {
  language: Language;
  event: OrganizerEvent;
  onChanged?: () => void | Promise<void>;
}

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.fieldErrors.map(item => item.message).filter(Boolean).join(' ') || error.message;
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';
}

function availabilityLabel(row: EventBooth): string {
  if (!row.booth.active) return 'Gian vật lý tạm ngưng';
  if (row.availability === 'AVAILABLE') return 'Còn trống';
  if (row.availability === 'ASSIGNED') return 'Đã thuê';
  if (row.availability === 'ON_HOLD') return 'Đang giữ chỗ';
  return 'Không mở bán';
}

export const EventBoothConfigurationPanel: React.FC<Props> = ({ language, event, onChanged }) => {
  const [rows, setRows] = useState<EventBooth[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const generationRef = useRef(0);
  const currentEventIdRef = useRef(event.id);

  useEffect(() => {
    currentEventIdRef.current = event.id;
  }, [event.id]);

  const loadData = useCallback(async () => {
    const requestedEventId = event.id;
    const generation = ++generationRef.current;
    setLoading(true);
    setError('');
    setSuccess('');
    setRows([]);
    setPriceDrafts({});

    try {
      const [physicalBooths, configurations] = await Promise.all([
        boothApi.listAllPhysicalBooths(),
        boothApi.listEventBoothConfigurations(requestedEventId),
      ]);
      if (generation !== generationRef.current || currentEventIdRef.current !== requestedEventId) return;

      const configurationByBoothId = new Map(
        configurations.map(configuration => [configuration.booth.boothId, configuration]),
      );
      const nextRows = physicalBooths
        .filter(booth => booth.active)
        .map(booth => configurationByBoothId.get(booth.boothId) || ({
          eventBoothConfigId: null,
          eventId: Number(requestedEventId),
          booth,
          rentalPrice: null,
          enabled: false,
          availability: 'UNAVAILABLE',
        } satisfies EventBooth));

      setRows(nextRows);
      setPriceDrafts(Object.fromEntries(
        nextRows.map(row => [row.booth.boothId, row.rentalPrice?.toString() ?? '']),
      ));
    } catch (caughtError) {
      if (generation !== generationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setError(apiMessage(caughtError));
    } finally {
      if (generation === generationRef.current && currentEventIdRef.current === requestedEventId) setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    void loadData();
    return () => {
      generationRef.current += 1;
    };
  }, [loadData]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const configuredCount = useMemo(() => rows.filter(row => row.eventBoothConfigId !== null).length, [rows]);
  const enabledCount = useMemo(() => rows.filter(row => row.enabled).length, [rows]);

  const setSaving = (boothId: number, saving: boolean) => {
    setSavingIds(current => {
      const next = new Set(current);
      if (saving) next.add(boothId);
      else next.delete(boothId);
      return next;
    });
  };

  const replaceRow = (updated: EventBooth) => {
    setRows(current => current.map(row => row.booth.boothId === updated.booth.boothId ? updated : row));
    setPriceDrafts(current => ({
      ...current,
      [updated.booth.boothId]: updated.rentalPrice?.toString() ?? '',
    }));
  };

  const saveConfiguration = async (row: EventBooth, rentalPrice: number, enabled: boolean, successMessage: string) => {
    const boothId = row.booth.boothId;
    const requestedEventId = event.id;
    setSaving(boothId, true);
    setError('');
    try {
      const updated = await boothApi.configureEventBooth(requestedEventId, boothId, rentalPrice, enabled);
      if (currentEventIdRef.current !== requestedEventId) return;
      replaceRow(updated);
      setSuccess(successMessage);
      await onChanged?.();
    } catch (caughtError) {
      if (currentEventIdRef.current !== requestedEventId) return;
      setPriceDrafts(current => ({ ...current, [boothId]: row.rentalPrice?.toString() ?? '' }));
      setError(apiMessage(caughtError));
    } finally {
      setSaving(boothId, false);
    }
  };

  const handlePriceBlur = async (row: EventBooth, rawValue: string) => {
    if (!rawValue.trim() && row.rentalPrice === null) return;
    const rentalPrice = Number(rawValue);
    if (!rawValue.trim() || !Number.isFinite(rentalPrice) || rentalPrice < 0) {
      setPriceDrafts(current => ({ ...current, [row.booth.boothId]: row.rentalPrice?.toString() ?? '' }));
      setError('Giá thuê phải là một số không âm.');
      return;
    }
    if (rentalPrice === row.rentalPrice) return;
    await saveConfiguration(row, rentalPrice, row.enabled, `Đã cập nhật giá thuê cho ${row.booth.code}.`);
  };

  const handleEnabledChange = async (row: EventBooth, enabled: boolean) => {
    const rawValue = priceDrafts[row.booth.boothId] ?? row.rentalPrice?.toString() ?? '';
    const rentalPrice = Number(rawValue);
    if (!rawValue.trim() || !Number.isFinite(rentalPrice) || rentalPrice < 0) {
      setError('Hãy nhập và lưu giá thuê hợp lệ trước khi mở bán gian hàng.');
      return;
    }
    await saveConfiguration(row, rentalPrice, enabled, `Đã ${enabled ? 'mở bán' : 'ngừng mở bán'} gian ${row.booth.code}.`);
  };

  return (
    <div className="organizer-card s2-event-config-panel">
      <div className="s2-panel-heading">
        <div>
          <span className="s2-eyebrow">{event.title} · {event.dateRange}</span>
          <h2>{language === 'vi' ? 'Cấu hình gian hàng & giá sự kiện' : 'Event booth configuration & pricing'}</h2>
          <p>Chỉ các thiết lập trong bảng này mới quyết định gian nào được mở bán cho sự kiện.</p>
        </div>
        <button type="button" className="btn-org-secondary" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="s2-config-summary" aria-label="Tổng quan cấu hình gian hàng">
        <span><Store size={15} /> {rows.length} gian vật lý đang hoạt động</span>
        <span><DollarSign size={15} /> {configuredCount} gian đã có giá</span>
        <span><Check size={15} /> {enabledCount} gian đang mở bán</span>
      </div>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      {loading ? (
        <div className="s2-loading"><Loader2 className="s2-spin" size={24} />Đang tải cấu hình gian hàng...</div>
      ) : rows.length === 0 ? (
        <div className="s2-empty"><Store size={34} /><strong>Chưa có gian vật lý đang hoạt động</strong><span>Hãy tạo hoặc kích hoạt gian tại màn hình Gian hàng.</span></div>
      ) : (
        <PaginatedList items={rows}>{pageItems => (<div className="s2-config-list">
          {pageItems.map(row => {
            const saving = savingIds.has(row.booth.boothId);
            return (
              <div className="s2-config-row" key={row.booth.boothId}>
                <div className="s2-config-identity">
                  <div className="s2-booth-badge">{row.booth.code}</div>
                  <div className="s2-config-info">
                    <h3>{row.booth.name}</h3>
                    <p>{row.booth.categoryCode || 'Chưa phân loại'}</p>
                  </div>
                </div>

                <div className="s2-config-status">
                  <span className={`s2-status ${row.availability.toLowerCase()}`}>{availabilityLabel(row)}</span>
                </div>

                <div className="s2-config-price">
                  <label htmlFor={`event-booth-price-${row.booth.boothId}`}>Giá thuê (VNĐ)</label>
                  <div className="s2-price-input-wrapper">
                    <input
                      id={`event-booth-price-${row.booth.boothId}`}
                      type="number"
                      min="0"
                      step="100000"
                      value={priceDrafts[row.booth.boothId] ?? ''}
                      placeholder="Nhập giá thuê"
                      disabled={saving}
                      onChange={changeEvent => setPriceDrafts(current => ({ ...current, [row.booth.boothId]: changeEvent.target.value }))}
                      onBlur={blurEvent => void handlePriceBlur(row, blurEvent.target.value)}
                    />
                    <span className="s2-price-currency">₫</span>
                  </div>
                </div>

                <label className="s2-switch-wrapper">
                  <div className="s2-switch">
                    <input type="checkbox" checked={row.enabled} disabled={saving} onChange={changeEvent => void handleEnabledChange(row, changeEvent.target.checked)} />
                    <span className="s2-slider"></span>
                  </div>
                  <span className="s2-switch-label">{saving ? 'Đang lưu...' : row.enabled ? 'Mở bán' : 'Không mở bán'}</span>
                </label>
              </div>
            );
          })}
        </div>)}</PaginatedList>
      )}
    </div>
  );
};
