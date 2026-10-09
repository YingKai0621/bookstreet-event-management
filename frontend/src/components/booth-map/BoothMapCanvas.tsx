import React, { useMemo, useRef, useState, useEffect } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { DEFAULT_MAP_IMAGE } from '../../services/mapService';
import type { BoothMapMarker } from './boothMapModel';
import { markerStatusLabel } from './boothMapModel';
import './BoothMapCanvas.css';

interface BoothMapCanvasProps {
  markers: BoothMapMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (marker: BoothMapMarker) => void;
  onPositionChange?: (markerId: string, x: number, y: number) => void;
  editable?: boolean;
  ariaLabel: string;
  emptyMessage?: string;
  className?: string;
}

export const BoothMapCanvas: React.FC<BoothMapCanvasProps> = ({
  markers,
  selectedMarkerId,
  onSelectMarker,
  onPositionChange,
  editable = false,
  ariaLabel,
  emptyMessage = 'Chưa có gian hàng đã định vị trên bản đồ.',
  className = '',
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

  const imageLayerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const visibleMarkers = useMemo(() => markers.filter(marker =>
    Number.isFinite(marker.x) && Number.isFinite(marker.y)
      && marker.x >= 0 && marker.x <= 100 && marker.y >= 0 && marker.y <= 100,
  ), [markers]);

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

  // Pan controls
  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerId) return;
    if (zoom <= 1 || (event.target as HTMLElement).closest('.booth-map-marker')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    panStart.current = pan;
    setIsPanning(true);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingMarkerId) {
      const coords = getPercentCoordinates(event.clientX, event.clientY);
      if (coords && onPositionChange) {
        onPositionChange(draggingMarkerId, coords.x, coords.y);
      }
      return;
    }
    if (!isPanning || zoom <= 1) return;
    const limit = (zoom - 1) * 240;
    setPan({
      x: Math.max(-limit, Math.min(limit, panStart.current.x + event.clientX - dragStart.current.x)),
      y: Math.max(-limit, Math.min(limit, panStart.current.y + event.clientY - dragStart.current.y)),
    });
  };

  const endPanOrDrag = () => {
    setIsPanning(false);
    setDraggingMarkerId(null);
  };

  // Click on map to place/move selected marker
  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !selectedMarkerId || !onPositionChange) return;
    if ((event.target as HTMLElement).closest('.booth-map-marker')) return;
    const coords = getPercentCoordinates(event.clientX, event.clientY);
    if (coords) {
      onPositionChange(selectedMarkerId, coords.x, coords.y);
    }
  };

  // Start dragging a marker
  const handleMarkerPointerDown = (event: React.PointerEvent, marker: BoothMapMarker) => {
    event.stopPropagation();
    onSelectMarker?.(marker);
    if (editable && onPositionChange) {
      setDraggingMarkerId(marker.id);
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    }
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => setDraggingMarkerId(null);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  return (
    <div className={`booth-map-shell ${className}`.trim()}>
      <div className="booth-map-toolbar">
        <div className="booth-map-legend" aria-label="Chú thích trạng thái gian hàng">
          <span><i className="available" />Còn trống</span>
          <span><i className="on-hold" />Đang giữ chỗ / Chờ duyệt</span>
          <span><i className="assigned" />Đã thuê / Phân bổ</span>
          <span><i className="unavailable" />Chưa mở</span>
        </div>
        <div className="booth-map-zoom" aria-label="Công cụ thu phóng bản đồ">
          <button type="button" onClick={() => zoomBy(0.25)} disabled={zoom >= 2.5} aria-label="Phóng to bản đồ"><ZoomIn size={16} /></button>
          <button type="button" onClick={() => zoomBy(-0.25)} disabled={zoom <= 1} aria-label="Thu nhỏ bản đồ"><ZoomOut size={16} /></button>
          <button type="button" onClick={reset} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} aria-label="Đặt lại bản đồ"><RotateCcw size={15} /></button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        </div>
      </div>

      <div
        className={`booth-map-viewport ${zoom > 1 ? 'is-zoomed' : ''} ${isPanning || draggingMarkerId ? 'is-dragging' : ''} ${editable ? 'is-editable' : ''}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPanOrDrag}
        onPointerCancel={endPanOrDrag}
        onClick={handleMapClick}
      >
        <div
          ref={imageLayerRef}
          className="booth-map-image-layer"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          aria-label={ariaLabel}
        >
          <img src={DEFAULT_MAP_IMAGE} alt="Bản đồ minh họa Đường Sách Nguyễn Văn Bình" draggable={false} />
          {visibleMarkers.map(marker => {
            const selected = marker.id === selectedMarkerId;
            const isDraggingThis = draggingMarkerId === marker.id;
            return (
              <button
                type="button"
                key={marker.id}
                className={`booth-map-marker status-${marker.status.toLowerCase()} ${selected ? 'is-selected' : ''} ${isDraggingThis ? 'is-active-dragging' : ''}`}
                style={{ left: `${marker.x}%`, top: `${marker.y}%`, '--marker-scale': 1 / zoom } as React.CSSProperties}
                aria-label={`${marker.code} – ${marker.name} – ${markerStatusLabel(marker.status)}`}
                aria-pressed={selected}
                onPointerDown={e => handleMarkerPointerDown(e, marker)}
                onClick={e => {
                  e.stopPropagation();
                  onSelectMarker?.(marker);
                }}
                title={`${marker.code}: ${marker.name} (${markerStatusLabel(marker.status)})`}
              >
                <span>{marker.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!visibleMarkers.length && <p className="booth-map-empty" role="status">{emptyMessage}</p>}
    </div>
  );
};
