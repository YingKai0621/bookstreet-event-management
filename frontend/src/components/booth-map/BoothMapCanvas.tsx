import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Check,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DEFAULT_MAP_IMAGE } from '../../services/mapService';
import type { BoothMapMarker, BoothMapMarkerStatus } from './boothMapModel';
import { markerStatusLabel } from './boothMapModel';
import './BoothMapCanvas.css';

export interface MapPopoverData {
  markerId: string;
  resourceId: number;
  resourceType: 'booth' | 'location';
  code: string;
  name: string;
  status: BoothMapMarkerStatus;
  resourceLabel?: string;
  partnerName?: string;
  x: number;
  y: number;
}

interface BoothMapCanvasProps {
  markers: BoothMapMarker[];
  selectedMarkerId?: string | null;
  newlyCreatedMarkerId?: string | null;
  onSelectMarker?: (marker: BoothMapMarker) => void;
  activePopoverData?: MapPopoverData | null;
  onOpenPopover?: (marker: BoothMapMarker) => void;
  onClosePopover?: () => void;
  onSavePopover?: (data: MapPopoverData) => Promise<void> | void;
  onDeleteBooth?: (boothId: number) => Promise<void> | void;
  onPositionChange?: (markerId: string, x: number, y: number) => void;
  onSaveAllMap?: () => Promise<void> | void;
  onUploadMapImage?: (file: File) => void;
  isSavingAll?: boolean;
  hasUnsavedChanges?: boolean;
  editable?: boolean;
  ariaLabel: string;
  emptyMessage?: string;
  className?: string;
  customMapUrl?: string;
  statusScope?: 'event' | 'physical';
}

export const BoothMapCanvas: React.FC<BoothMapCanvasProps> = ({
  markers,
  selectedMarkerId,
  newlyCreatedMarkerId,
  onSelectMarker,
  activePopoverData,
  onOpenPopover,
  onClosePopover,
  onSavePopover,
  onDeleteBooth,
  onPositionChange,
  onSaveAllMap,
  onUploadMapImage,
  isSavingAll = false,
  editable = true,
  ariaLabel,
  emptyMessage = 'Chưa có gian hàng nào trên bản đồ.',
  className = '',
  customMapUrl,
  statusScope = 'event',
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

  // Popover Form State
  const [popoverForm, setPopoverForm] = useState<{
    sourceKey: string;
    code: string;
    name: string;
  }>({
    sourceKey: '',
    code: '',
    name: '',
  });
  const [popoverSaving, setPopoverSaving] = useState(false);

  const imageLayerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const hasMovedMarkerRef = useRef(false);

  const activePopoverSourceKey = activePopoverData
    ? `${activePopoverData.markerId}\u0000${activePopoverData.code}\u0000${activePopoverData.name}`
    : '';
  const activePopoverForm = activePopoverData && popoverForm.sourceKey !== activePopoverSourceKey
    ? {
      sourceKey: activePopoverSourceKey,
      code: activePopoverData.code || '',
      name: activePopoverData.name || '',
    }
    : popoverForm;

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClosePopover?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClosePopover]);

  const visibleMarkers = useMemo(() => markers.filter(marker =>
    Number.isFinite(marker.x) && Number.isFinite(marker.y)
      && marker.x >= 0 && marker.x <= 100 && marker.y >= 0 && marker.y <= 100,
  ), [markers]);

  // Counts
  const availableCount = visibleMarkers.filter(m => m.status === 'AVAILABLE').length;
  const assignedCount = visibleMarkers.filter(m => m.status === 'ASSIGNED').length;
  const ownedCount = visibleMarkers.filter(m => m.status === 'OWNED').length;
  const onHoldCount = visibleMarkers.filter(m => m.status === 'ON_HOLD').length;
  const physicalInactiveCount = visibleMarkers.filter(m => m.status === 'PHYSICAL_INACTIVE').length;
  const physicalKindCounts = useMemo(() => ({
    BOOTH: visibleMarkers.filter(marker => (marker.kind || 'BOOTH') === 'BOOTH').length,
    STAGE: visibleMarkers.filter(marker => marker.kind === 'STAGE').length,
    WORKSHOP: visibleMarkers.filter(marker => marker.kind === 'WORKSHOP').length,
    AREA: visibleMarkers.filter(marker => marker.kind === 'AREA').length,
  }), [visibleMarkers]);

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomBy = (amount: number) => {
    setZoom(current => {
      const next = Math.max(1, Math.min(2.5, current + amount));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const getPercentCoordinates = (clientX: number, clientY: number) => {
    if (!imageLayerRef.current) return null;
    const rect = imageLayerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  };

  // Pan handlers
  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerId) return;
    if (zoom <= 1 || (event.target as HTMLElement).closest('.booth-map-marker') || (event.target as HTMLElement).closest('.booth-marker-popover')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    panStart.current = pan;
    setIsPanning(true);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerId && editable && onPositionChange) {
      const dist = Math.hypot(event.clientX - pointerStartPos.current.x, event.clientY - pointerStartPos.current.y);
      if (dist > 6) {
        hasMovedMarkerRef.current = true;
        const coords = getPercentCoordinates(event.clientX, event.clientY);
        if (coords) {
          onPositionChange(draggingMarkerId, coords.x, coords.y);
        }
      }
      return;
    }
    if (!isPanning || zoom <= 1) return;
    const limit = (zoom - 1) * 260;
    setPan({
      x: Math.max(-limit, Math.min(limit, panStart.current.x + event.clientX - dragStart.current.x)),
      y: Math.max(-limit, Math.min(limit, panStart.current.y + event.clientY - dragStart.current.y)),
    });
  };

  const endPanOrDrag = () => {
    setIsPanning(false);
    setDraggingMarkerId(null);
  };

  // Marker drag start
  const handleMarkerPointerDown = (event: React.PointerEvent, marker: BoothMapMarker) => {
    event.stopPropagation();
    pointerStartPos.current = { x: event.clientX, y: event.clientY };
    hasMovedMarkerRef.current = false;
    if (editable && onPositionChange) {
      setDraggingMarkerId(marker.id);
    }
  };

  // Marker click toggle
  const handleMarkerClick = (event: React.MouseEvent, marker: BoothMapMarker) => {
    event.stopPropagation();
    if (hasMovedMarkerRef.current) {
      hasMovedMarkerRef.current = false;
      return;
    }
    onSelectMarker?.(marker);
    if (activePopoverData?.markerId === marker.id) {
      onClosePopover?.();
    } else {
      onOpenPopover?.(marker);
    }
  };

  // Submit Popover form
  const handleSavePopoverForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePopoverData || !onSavePopover) return;
    setPopoverSaving(true);
    try {
      await onSavePopover({
        ...activePopoverData,
        code: activePopoverForm.code.trim().toUpperCase() || activePopoverData.code,
        name: activePopoverForm.name.trim() || activePopoverData.name,
        status: activePopoverData.status,
        partnerName: activePopoverData.partnerName || '',
      });
      onClosePopover?.();
    } finally {
      setPopoverSaving(false);
    }
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadMapImage) {
      onUploadMapImage(file);
    }
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => setDraggingMarkerId(null);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  return (
    <div className={`booth-map-shell ${editable ? 'is-editable' : 'is-readonly'} ${className}`.trim()}>
      {/* Hidden file input for uploading map */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 1. MAP TOOLBAR (MATCHING SCREENSHOT 1) */}
      <div className="booth-map-toolbar">
        {/* Left: Status Legend */}
        <div className="booth-map-legend">
          {statusScope === 'physical' ? (
            <>
              <div className="booth-map-legend-item"><span className="booth-map-legend-dot kind-booth"></span><span>Gian hàng ({physicalKindCounts.BOOTH})</span></div>
              {physicalKindCounts.STAGE > 0 && <div className="booth-map-legend-item"><span className="booth-map-legend-dot kind-stage"></span><span>Sân khấu ({physicalKindCounts.STAGE})</span></div>}
              {physicalKindCounts.WORKSHOP > 0 && <div className="booth-map-legend-item"><span className="booth-map-legend-dot kind-workshop"></span><span>Workshop ({physicalKindCounts.WORKSHOP})</span></div>}
              {physicalKindCounts.AREA > 0 && <div className="booth-map-legend-item"><span className="booth-map-legend-dot kind-area"></span><span>Khu vực ({physicalKindCounts.AREA})</span></div>}
              {physicalInactiveCount > 0 && <div className="booth-map-legend-item"><span className="booth-map-legend-dot physical-inactive"></span><span>Tạm ngưng ({physicalInactiveCount})</span></div>}
            </>
          ) : (
            <>
              <div className="booth-map-legend-item"><span className="booth-map-legend-dot available"></span><span>Còn trống ({availableCount})</span></div>
              <div className="booth-map-legend-item"><span className="booth-map-legend-dot assigned"></span><span>Đã thuê ({assignedCount})</span></div>
              {ownedCount > 0 && <div className="booth-map-legend-item"><span className="booth-map-legend-dot owned"></span><span>Gian của bạn ({ownedCount})</span></div>}
              <div className="booth-map-legend-item"><span className="booth-map-legend-dot on_hold"></span><span>Đang giữ chỗ ({onHoldCount})</span></div>
            </>
          )}
        </div>

        {/* Right: Actions & Zoom */}
        <div className="booth-map-toolbar-actions">
          {editable && onUploadMapImage && (
            <button
              type="button"
              className="btn-map-tool"
              onClick={() => fileInputRef.current?.click()}
              title="Tải ảnh bản đồ mới lên"
            >
              <Upload size={15} />
              <span>Tải bản đồ lên</span>
            </button>
          )}

          {editable && onSaveAllMap && (
            <button
              type="button"
              className="btn-map-tool primary"
              onClick={() => void onSaveAllMap()}
              disabled={isSavingAll}
              title="Lưu toàn bộ tọa độ sơ đồ vào cơ sở dữ liệu"
            >
              <Check size={15} />
              <span>{isSavingAll ? 'Đang lưu...' : 'Lưu sơ đồ'}</span>
            </button>
          )}

          <div className="booth-map-zoom-group">
            <button
              type="button"
              className="booth-map-zoom-btn"
              onClick={() => zoomBy(-0.25)}
              disabled={zoom <= 1}
              aria-label="Thu nhỏ"
              title="Thu nhỏ"
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              className="booth-map-zoom-btn"
              onClick={reset}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              aria-label="Đặt lại thu phóng"
              title="Đặt lại bản đồ"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              className="booth-map-zoom-btn"
              onClick={() => zoomBy(0.25)}
              disabled={zoom >= 2.5}
              aria-label="Phóng to"
              title="Phóng to"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAP VIEWPORT */}
      <div
        className={`booth-map-viewport ${zoom > 1 ? 'is-zoomed' : ''} ${isPanning || draggingMarkerId ? 'is-dragging' : ''}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPanOrDrag}
        onPointerCancel={endPanOrDrag}
        onClick={() => {
          if (!hasMovedMarkerRef.current) {
            onClosePopover?.();
          }
        }}
      >
        <div
          ref={imageLayerRef}
          className="booth-map-image-layer"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          aria-label={ariaLabel}
        >
          <img
            src={customMapUrl || DEFAULT_MAP_IMAGE}
            alt="Bản đồ minh họa Đường Sách Nguyễn Văn Bình"
            draggable={false}
          />

          {/* Markers */}
          {visibleMarkers.map(marker => {
            const statusClass = `status-${marker.status.toLowerCase()}`;

            const isSelected = activePopoverData?.markerId === marker.id || selectedMarkerId === marker.id;
            const isNewlyCreated = newlyCreatedMarkerId === marker.id;
            const isDraggingThis = draggingMarkerId === marker.id;
            const kindClass = `kind-${(marker.kind || 'BOOTH').toLowerCase()}`;

            return (
              <button
                type="button"
                key={marker.id}
                className={`booth-map-marker ${statusClass} ${kindClass} ${marker.status === 'PHYSICAL_INACTIVE' ? 'is-inactive' : ''} ${isSelected ? 'is-selected' : ''} ${isNewlyCreated ? 'is-newly-created' : ''} ${isDraggingThis ? 'is-active-dragging' : ''}`}
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  '--marker-scale': 1 / zoom,
                } as React.CSSProperties}
                aria-label={`${marker.code} – ${marker.name} – ${markerStatusLabel(marker.status)}`}
                onPointerDown={e => handleMarkerPointerDown(e, marker)}
                onClick={e => handleMarkerClick(e, marker)}
                title={`${marker.code}: ${marker.name} (${markerStatusLabel(marker.status)}) - Kéo để đổi vị trí, Click để chỉnh sửa`}
              >
                <span>{marker.code}</span>
                {isNewlyCreated && <span className="newly-created-badge" aria-hidden="true">★ Mới</span>}
                {(marker.status === 'ASSIGNED' || marker.status === 'OWNED') && <Lock size={11} className="booth-marker-lock" />}
              </button>
            );
          })}

          {/* 3. INLINE POPOVER (MATCHING SCREENSHOT 2) */}
          {activePopoverData && (
            <div
              className="booth-marker-popover"
              style={{
                left: `${activePopoverData.x}%`,
                top: `${activePopoverData.y}%`,
                transform: `translate(-50%, -100%) translateY(-16px) scale(${1 / zoom})`,
                transformOrigin: 'bottom center',
              }}
              onClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleSavePopoverForm}>
                {/* Header */}
                <div className="popover-header">
                  <input
                    type="text"
                    className="popover-code-input"
                    value={activePopoverForm.code}
                    onChange={e => setPopoverForm({ ...activePopoverForm, code: e.target.value.toUpperCase() })}
                    placeholder="Mã gian..."
                    title="Chỉnh sửa mã gian hàng (Ví dụ: A01, BOOTH-A02)"
                    maxLength={30}
                    readOnly={statusScope === 'physical'}
                    required
                  />
                  <input
                    type="text"
                    className="popover-title-input"
                    value={activePopoverForm.name}
                    onChange={e => setPopoverForm({ ...activePopoverForm, name: e.target.value })}
                    placeholder="Tên gian hàng..."
                    required
                  />
                  <button
                    type="button"
                    className="popover-close-btn"
                    onClick={onClosePopover}
                    title="Đóng"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Form Fields (2 columns) */}
                <div className="popover-body-grid">
                  <div className="popover-field">
                    <label>{statusScope === 'physical' ? 'Trạng thái vật lý' : 'Trạng thái theo sự kiện'}</label>
                    <strong>{markerStatusLabel(activePopoverData.status)}</strong>
                  </div>

                  {statusScope === 'physical' ? (
                    <div className="popover-field">
                      <label>Loại không gian</label>
                      <strong>{activePopoverData.resourceLabel || 'Gian hàng'}</strong>
                    </div>
                  ) : (
                    <div className="popover-field">
                      <label>Đơn vị tham gia (NXB / Đối tác)</label>
                      <strong>{activePopoverData.partnerName || 'Chưa có đơn vị được cấp'}</strong>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="popover-footer">
                  {onDeleteBooth && (
                    <button
                      type="button"
                      className="btn-popover-delete"
                      onClick={() => onDeleteBooth(activePopoverData.resourceId)}
                      title="Xóa gian hàng này"
                    >
                      <Trash2 size={14} />
                      <span>Xóa</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    className="btn-popover-save"
                    disabled={popoverSaving}
                    aria-label="Lưu thay đổi"
                    title="Lưu thay đổi"
                  >
                    <Check size={15} />
                    <span>{popoverSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {!visibleMarkers.length && <p className="booth-map-empty" role="status">{emptyMessage}</p>}
    </div>
  );
};
