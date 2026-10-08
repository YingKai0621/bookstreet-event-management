import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { DEFAULT_MAP_IMAGE } from '../../services/mapService';
import type { BoothMapMarker } from './boothMapModel';
import { markerStatusLabel } from './boothMapModel';
import './BoothMapCanvas.css';

interface BoothMapCanvasProps {
  markers: BoothMapMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (marker: BoothMapMarker) => void;
  ariaLabel: string;
  emptyMessage?: string;
  className?: string;
}

export const BoothMapCanvas: React.FC<BoothMapCanvasProps> = ({
  markers,
  selectedMarkerId,
  onSelectMarker,
  ariaLabel,
  emptyMessage = 'Chưa có gian hàng đã định vị trên bản đồ.',
  className = '',
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
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

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || (event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    panStart.current = pan;
    setDragging(true);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || zoom <= 1) return;
    const limit = (zoom - 1) * 240;
    setPan({
      x: Math.max(-limit, Math.min(limit, panStart.current.x + event.clientX - dragStart.current.x)),
      y: Math.max(-limit, Math.min(limit, panStart.current.y + event.clientY - dragStart.current.y)),
    });
  };

  return (
    <div className={`booth-map-shell ${className}`.trim()}>
      <div className="booth-map-toolbar">
        <div className="booth-map-legend" aria-label="Chú thích trạng thái gian hàng">
          <span><i className="available" />Còn trống</span>
          <span><i className="on-hold" />Đang giữ chỗ</span>
          <span><i className="assigned" />Đã phân bổ</span>
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
        className={`booth-map-viewport ${zoom > 1 ? 'is-zoomed' : ''} ${dragging ? 'is-dragging' : ''}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div
          className="booth-map-image-layer"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          aria-label={ariaLabel}
        >
          <img src={DEFAULT_MAP_IMAGE} alt="Bản đồ minh họa Đường Sách Nguyễn Văn Bình" draggable={false} />
          {visibleMarkers.map(marker => {
            const selected = marker.id === selectedMarkerId;
            return (
              <button
                type="button"
                key={marker.id}
                className={`booth-map-marker status-${marker.status.toLowerCase()} ${selected ? 'is-selected' : ''}`}
                style={{ left: `${marker.x}%`, top: `${marker.y}%`, '--marker-scale': 1 / zoom } as React.CSSProperties}
                aria-label={`${marker.code} – ${marker.name} – ${markerStatusLabel(marker.status)}`}
                aria-pressed={selected}
                onClick={() => onSelectMarker?.(marker)}
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
