import {
  ChevronRight,
  Clock,
  Phone,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_MAP_IMAGE, MapLocationPoint } from '../../services/mapService';
import { boothApi } from '../../services/boothApi';
import { Booth, EventItem, Language } from '../../types';
import type { EventBooth } from '../../types/booth';
import { IconMapBookPin } from './CustomIcons';
import { eventBoothToMarker } from '../booth-map/boothMapModel';
import './InteractiveMap.css';

interface InteractiveMapProps {
  language: Language;
  events?: EventItem[];
  selectedEventId: string;
  onSelectEventId: (eventId: string) => void;
  booths?: Booth[];
  isLoading?: boolean;
  highlightedBoothId: string | null;
  onNavigateToBoothDetail: (boothId: string) => void;
}

const EMPTY_BOOTHS: Booth[] = [];

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  language,
  events = [],
  selectedEventId,
  onSelectEventId,
  booths,
  isLoading = false,
  highlightedBoothId,
  onNavigateToBoothDetail,
}) => {
  const allBooths = booths || EMPTY_BOOTHS;
  const [mapPoints, setMapPoints] = useState<MapLocationPoint[]>([]);
  const [eventBooths, setEventBooths] = useState<EventBooth[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapImageUrl, setMapImageUrl] = useState<string>(DEFAULT_MAP_IMAGE);
  const [selectedPointId, setSelectedPointId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    if (!selectedEventId) {
      setMapPoints([]);
      setEventBooths([]);
      setSelectedPointId('');
      setMapError('');
      setIsMapLoading(false);
      return () => { isMounted = false; };
    }

    setIsMapLoading(true);
    setMapError('');
    boothApi.listAllPublicEventBooths(selectedEventId)
      .then(rows => {
        if (!isMounted) return;
        const points = rows.flatMap(row => {
          const marker = eventBoothToMarker(row);
          if (!marker) return [];
          const status = marker.status.toLowerCase() as MapLocationPoint['status'];
          return [{
            id: marker.id,
            code: marker.code,
            name: marker.name,
            nameEn: marker.name,
            category: 'booth' as const,
            status,
            statusLabelVi: marker.status === 'AVAILABLE' ? 'Còn trống'
              : marker.status === 'ON_HOLD' ? 'Đang giữ chỗ'
              : marker.status === 'ASSIGNED' ? 'Đã phân bổ' : 'Chưa mở',
            statusLabelEn: marker.status,
            x: marker.x,
            y: marker.y,
            shortDesc: row.booth.description || row.booth.note || 'Chưa có mô tả.',
            shortDescEn: row.booth.description || row.booth.note || '',
            features: [
              row.booth.categoryCode ? `Danh mục: ${row.booth.categoryCode}` : '',
              `Sức chứa: ${row.booth.maxCapacity}`,
            ].filter(Boolean),
          } satisfies MapLocationPoint];
        });
        setEventBooths(rows);
        setMapPoints(points);
        setSelectedPointId(current => points.some(point => point.id === current) ? current : points[0]?.id || '');
      })
      .catch(error => {
        if (!isMounted) return;
        console.warn('Không thể tải gian hàng công khai', error);
        setEventBooths([]);
        setMapPoints([]);
        setSelectedPointId('');
        setMapError(language === 'vi' ? 'Không thể tải gian hàng của sự kiện này.' : 'Could not load booths for this event.');
      })
      .finally(() => { if (isMounted) setIsMapLoading(false); });
    return () => { isMounted = false; };
  }, [language, selectedEventId]);

  // Preserve the approved illustrated image update hook used by the map editor.
  useEffect(() => {
    const handleImageUpdate = (e: any) => {
      if (e.detail?.imageUrl) {
        setMapImageUrl(e.detail.imageUrl);
      }
    };
    window.addEventListener('duongsach_map_image_updated', handleImageUpdate);
    return () => {
      window.removeEventListener('duongsach_map_image_updated', handleImageUpdate);
    };
  }, []);

  // Zoom & Pan state for mobile / desktop
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.35, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.35, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Touch handlers for smooth dragging & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoomLevel > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPanRef.current = { ...panOffset };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistanceRef.current = dist;
      initialPinchZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && zoomLevel > 1) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      const maxPan = (zoomLevel - 1) * 200;
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, initialPanRef.current.x + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, initialPanRef.current.y + dy)),
      });
    } else if (e.touches.length === 2 && pinchStartDistanceRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / pinchStartDistanceRef.current;
      const newZoom = Math.min(Math.max(initialPinchZoomRef.current * scaleFactor, 1), 2.5);
      setZoomLevel(newZoom);
      if (newZoom === 1) setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    pinchStartDistanceRef.current = null;
  };

  // Mouse drag support when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...panOffset };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const maxPan = (zoomLevel - 1) * 220;
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, initialPanRef.current.x + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, initialPanRef.current.y + dy)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Khi có highlightedBoothId từ "Xem trên bản đồ"
  React.useEffect(() => {
    if (highlightedBoothId) {
      const match = mapPoints.find(point => point.code === allBooths.find(booth => booth.id === highlightedBoothId)?.code);
      if (match) setSelectedPointId(match.id);
    }
  }, [highlightedBoothId, mapPoints, allBooths]);

  // Selected point data
  const isSectionLoading = isLoading || isMapLoading;
  const selectedPoint = mapPoints.find(p => p.id === selectedPointId) || mapPoints[0];
  const selectedEventBooth = selectedPoint
    ? eventBooths.find(row => `booth-${row.booth.boothId}` === selectedPoint.id)
    : null;
  const activeBooth = selectedPoint
    ? allBooths.find(b => b.code === selectedPoint.code || b.name.toLowerCase().includes(selectedPoint.name.toLowerCase()))
    : null;

  return (
    <section className="figma-map-section" id="ban-do">
      <div className="blueprint-map-section-container">
        {/* Header section */}
        <div className="figma-section-header">
          <span className="figma-eyebrow">
            <IconMapBookPin size={16} color="var(--figma-gold)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {language === 'vi' ? 'MẶT BẰNG QUY HOẠCH' : 'ARCHITECTURAL SCHEMATIC'}
          </span>
          <h2 className="figma-section-title">
            {language === 'vi' ? (
              <>Bản đồ <span className="serif-italic-accent">Đường Sách</span> Nguyễn Văn Bình</>
            ) : (
              'Nguyen Van Binh Book Street Map'
            )}
          </h2>
          <p className="figma-section-subtitle">
            {language === 'vi'
              ? 'Xem gian hàng, khu sự kiện và tiện ích trên bản đồ.'
              : 'See stalls, event areas, and amenities on the map.'}
          </p>
        </div>



        {/* Map Blueprint & Detail Column Layout */}
        <div className="blueprint-map-layout">
          {/* Left / Top Canvas: Vector Blueprint */}
          <div className="blueprint-canvas-wrapper">
            <div className="blueprint-toolbar">
              {/* Mobile & Desktop Interactive Zoom Controls */}
              <div className="map-zoom-controls-cluster" aria-label="Công cụ phóng to thu nhỏ bản đồ">
                <button
                  type="button"
                  className="btn-map-zoom"
                  onClick={handleZoomIn}
                  title={language === 'vi' ? 'Phóng to bản đồ (+)' : 'Zoom In (+)'}
                  aria-label="Phóng to"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  className="btn-map-zoom"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  title={language === 'vi' ? 'Thu nhỏ bản đồ (-)' : 'Zoom Out (-)'}
                  aria-label="Thu nhỏ"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  className={`btn-zoom-indicator ${zoomLevel > 1 ? 'is-active-zoom' : ''}`}
                  onClick={zoomLevel > 1 ? handleResetZoom : handleZoomIn}
                  title={zoomLevel > 1 ? (language === 'vi' ? 'Khôi phục 100%' : 'Reset 100%') : (language === 'vi' ? 'Phóng to bản đồ' : 'Zoom In')}
                  aria-label="Tỷ lệ thu phóng"
                >
                  <span className="zoom-val-tag">{Math.round(zoomLevel * 100)}%</span>
                </button>
              </div>
            </div>

            <div
              className={`blueprint-scroll-viewport ${zoomLevel > 1 ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
              ref={mapViewportRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                className="illustrated-map"
                aria-label={language === 'vi' ? 'Bản đồ tương tác Đường Sách Nguyễn Văn Bình' : 'Interactive Nguyen Van Binh Book Street map'}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  touchAction: zoomLevel > 1 ? 'none' : 'pan-y'
                }}
              >
                <img
                  className="illustrated-map-image"
                  src={mapImageUrl || DEFAULT_MAP_IMAGE}
                  alt={language === 'vi' ? 'Sơ đồ minh họa Đường Sách Nguyễn Văn Bình, Quận 1, Thành phố Hồ Chí Minh' : 'Illustrated map of Nguyen Van Binh Book Street in District 1, Ho Chi Minh City'}
                  draggable={false}
                />

                {mapPoints.map((point, index) => {
                  const isSelected = selectedPoint && selectedPoint.id === point.id;
                  const markerScale = 1 / zoomLevel;
                  const markerBackground = point.status === 'available' ? '#FFFFFF'
                    : point.status === 'on_hold' ? '#FFF1C7'
                    : point.status === 'assigned' ? '#E4ECFA' : '#E9EEEB';

                  return (
                    <button
                      key={point.id}
                      type="button"
                      className={`illustrated-map-marker status-${point.status} ${isSelected ? 'is-selected' : ''}`}
                      style={{
                        left: `${point.x}%`,
                        top: `${point.y}%`,
                        transform: `translate(-50%, ${isSelected ? 'calc(-50% - 10px)' : '-50%'}) scale(${markerScale})`,
                        background: isSelected ? '#E9BC63' : markerBackground,
                        borderColor: isSelected ? '#17382E' : '#185E48',
                        color: isSelected ? '#172421' : '#17382E',
                        boxShadow: isSelected ? '0 0 0 4px rgba(23, 56, 46, 0.35), 0 8px 24px rgba(0,0,0,0.3)' : '0 3px 8px rgba(0,0,0,0.18)'
                      }}
                      aria-label={`${point.code} – ${language === 'vi' ? point.name : (point.nameEn || point.name)} – ${point.statusLabelVi}`}
                      aria-pressed={isSelected}
                      aria-controls="map-location-detail"
                      onPointerDown={(event) => {
                        if (event.button === 0) setSelectedPointId(point.id);
                      }}
                      onClick={(event) => {
                        if (event.detail === 0) setSelectedPointId(point.id);
                      }}
                    >
                      <span className="marker-index">{index + 1}</span>
                      <span className="marker-label">{point.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Quick Location Selector Chips */}
            {mapPoints.length > 0 && (
              <div className="mobile-map-quick-selector" aria-label="Chọn nhanh địa điểm">
                <span className="quick-selector-label">
                  {language === 'vi' ? 'Chọn nhanh địa điểm:' : 'Quick Select:'}
                </span>
                <div className="quick-selector-chips">
                  {mapPoints.map((point, index) => {
                    const isSelected = selectedPoint && selectedPoint.id === point.id;
                    return (
                      <button
                        key={point.id}
                        type="button"
                        className={`quick-spot-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedPointId(point.id)}
                        aria-pressed={isSelected}
                      >
                        <span className="spot-chip-index">{index + 1}</span>
                        <span>{point.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Full Info Card for Selected Unit */}
          <div id="map-location-detail" className="blueprint-detail-panel" aria-live="polite" aria-atomic="true">
            {isSectionLoading ? (
              <div className="map-detail-skeleton" aria-hidden="true">
                <div className="panel-unit-top">
                  <div className="skeleton-box" style={{ width: '60px', height: '24px', borderRadius: '4px' }} />
                  <div className="skeleton-box" style={{ width: '120px', height: '18px', borderRadius: '4px' }} />
                </div>
                <div className="skeleton-box" style={{ width: '75%', height: '26px', marginTop: '12px', marginBottom: '10px' }} />
                <div className="skeleton-box" style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
                <div className="skeleton-box" style={{ width: '85%', height: '14px', marginBottom: '18px' }} />
                <div className="panel-highlights-box" style={{ borderStyle: 'dashed' }}>
                  <div className="skeleton-box" style={{ width: '55%', height: '12px', marginBottom: '10px' }} />
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <div className="skeleton-box" style={{ width: '80px', height: '24px', borderRadius: '4px' }} />
                    <div className="skeleton-box" style={{ width: '100px', height: '24px', borderRadius: '4px' }} />
                    <div className="skeleton-box" style={{ width: '70px', height: '24px', borderRadius: '4px' }} />
                  </div>
                </div>
                <div className="panel-contact-list">
                  <div className="contact-item">
                    <Clock size={15} />
                    <div className="skeleton-box" style={{ width: '90px', height: '14px' }} />
                  </div>
                </div>
                <div className="panel-booth-preview">
                  <div className="preview-thumb">
                    <div className="skeleton-box" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="preview-info" style={{ width: '100%' }}>
                    <div className="skeleton-box" style={{ width: '90px', height: '12px', marginBottom: '6px' }} />
                    <div className="skeleton-box" style={{ width: '70%', height: '16px' }} />
                  </div>
                </div>
              </div>
            ) : selectedPoint ? (
              <>
                {/* Header with Unit Code badge & Category */}
                <div className="panel-unit-top">
                  <span className="panel-code-badge">{selectedPoint.code}</span>
                  <span className="panel-category-name">
                    {selectedPoint.category === 'stage'
                      ? (language === 'vi' ? 'Sân khấu Sự kiện' : 'Event Stage')
                      : selectedPoint.category === 'cafe'
                      ? (language === 'vi' ? 'Cà phê Sách' : 'Book Cafe')
                      : selectedPoint.category === 'facility'
                      ? (language === 'vi' ? 'Tiện ích & Cảnh quan' : 'Public Facility')
                      : (language === 'vi' ? 'Gian hàng Xuất bản' : 'Bookstall Unit')}
                  </span>
                </div>

                {/* Title */}
                <h3 className="panel-unit-title">
                  {language === 'vi' ? selectedPoint.name : (selectedPoint.nameEn || selectedPoint.name)}
                </h3>

                {/* Description */}
                <p className="panel-unit-desc">
                  {language === 'vi' ? selectedPoint.shortDesc : (selectedPoint.shortDescEn || selectedPoint.shortDesc)}
                </p>

                {selectedEventBooth && (
                  <div
                    className="public-map-booth-facts"
                    aria-label={language === 'vi' ? 'Thông tin gian hàng theo sự kiện' : 'Event booth information'}
                  >
                    <span className={`public-map-status status-${selectedPoint.status}`}>
                      {selectedPoint.statusLabelVi}
                    </span>
                    <span>
                      {language === 'vi' ? 'Giá sự kiện' : 'Event price'}:{' '}
                      <strong>
                        {selectedEventBooth.rentalPrice === null
                          ? (language === 'vi' ? 'Chưa cấu hình' : 'Not configured')
                          : new Intl.NumberFormat('vi-VN', {
                              style: 'currency',
                              currency: 'VND',
                            }).format(selectedEventBooth.rentalPrice)}
                      </strong>
                    </span>
                  </div>
                )}

                {/* Highlights & Features Box */}
                {selectedPoint.features && selectedPoint.features.length > 0 && (
                  <div className="panel-highlights-box">
                    <span className="highlights-header-label">
                      {language === 'vi' ? 'ĐẶC TRƯNG & TIỆN ÍCH NỔI BẬT:' : 'HIGHLIGHTS & SERVICES:'}
                    </span>
                    <div className="highlights-chips-container">
                      {selectedPoint.features.map((feat: string, fIdx: number) => (
                        <span key={fIdx} className="highlight-chip">
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Featured Books if booth is selected */}
                {selectedPoint.featuredBooks && selectedPoint.featuredBooks.length > 0 && (
                  <div className="panel-featured-books-box">
                    <span className="highlights-header-label">
                      {language === 'vi' ? 'SÁCH TIÊU BIỂU GỢI Ý:' : 'FEATURED TITLES:'}
                    </span>
                    <p className="featured-books-text">
                      {selectedPoint.featuredBooks.join(' • ')}
                    </p>
                  </div>
                )}

                {/* Contact & Hours */}
                <div className="panel-contact-list">
                  <div className="contact-item">
                    <Clock size={15} />
                    <span>{selectedPoint.openHours || (language === 'vi' ? 'Chưa có dữ liệu' : 'No data')}</span>
                  </div>
                  {selectedPoint.phone && (
                    <div className="contact-item">
                      <Phone size={15} />
                      <span>{selectedPoint.phone}</span>
                    </div>
                  )}
                </div>

                {/* Operator info */}
                <div className="panel-booth-preview">
                  <div className="preview-thumb">
                    <img
                      src={selectedPoint.imageUrl || activeBooth?.image.url || undefined}
                      alt={selectedPoint.name}
                      decoding="async"
                    />
                  </div>
                  <div className="preview-info">
                    <span className="preview-label">
                      {selectedPoint.category === 'booth'
                        ? (language === 'vi' ? 'ĐƠN VỊ VẬN HÀNH' : 'OPERATOR')
                        : (language === 'vi' ? 'QUẢN LÝ KHÔNG GIAN' : 'SPACE MANAGEMENT')}
                    </span>
                    <p className="preview-name">
                      {selectedPoint.orgName || activeBooth?.name || (language === 'vi' ? 'Chưa có dữ liệu' : 'No data')}
                    </p>
                    {activeBooth && (
                      <button
                        type="button"
                        className="btn-navigate-booth"
                        onClick={() => onNavigateToBoothDetail(activeBooth.id)}
                      >
                        <span>{language === 'vi' ? 'Xem trong danh mục gian hàng' : 'Inspect Stall Catalog'}</span>
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Fallback overview information when map hotspots are not yet populated */}
                <div className="panel-unit-top">
                  <span className="panel-code-badge">NVB</span>
                  <span className="panel-category-name">
                    {language === 'vi' ? 'Không gian Tuyến phố' : 'Street Space'}
                  </span>
                </div>
                <h3 className="panel-unit-title">
                  {language === 'vi' ? 'Sơ đồ Đường Sách Nguyễn Văn Bình' : 'Nguyen Van Binh Book Street Plan'}
                </h3>
                <p className="panel-unit-desc">
                  {!selectedEventId
                    ? (language === 'vi' ? 'Chọn một sự kiện đã công bố để xem các gian hàng được cấu hình trên sơ đồ.' : 'Select a published event to view its configured booths on the map.')
                    : mapError
                      ? mapError
                      : (language === 'vi' ? 'Sự kiện này chưa có gian hàng nào với đủ tọa độ hợp lệ để hiển thị trên bản đồ.' : 'This event has no booths with complete valid coordinates to display on the map.')}
                </p>
                <div className="panel-highlights-box">
                  <span className="highlights-header-label">
                    {language === 'vi' ? 'ĐẶC TRƯNG KHÔNG GIAN:' : 'SPATIAL FEATURES:'}
                  </span>
                  <div className="highlights-chips-container">
                    <span className="highlight-chip">✓ {language === 'vi' ? 'Phố đi bộ văn hóa' : 'Pedestrian culture zone'}</span>
                    <span className="highlight-chip">✓ {language === 'vi' ? 'Sân khấu sự kiện ngoài trời' : 'Outdoor event stage'}</span>
                    <span className="highlight-chip">✓ {language === 'vi' ? 'Cà phê sách & Cảnh quan' : 'Book cafes & Amenities'}</span>
                  </div>
                </div>
                <div className="panel-contact-list">
                  <div className="contact-item">
                    <Clock size={15} />
                    <span>08:00 - 22:00</span>
                  </div>
                </div>
                <div className="panel-booth-preview">
                  <div className="preview-info">
                    <span className="preview-label">
                      {language === 'vi' ? 'QUẢN LÝ VẬN HÀNH' : 'MANAGEMENT'}
                    </span>
                    <p className="preview-name">
                      {language === 'vi' ? 'Chưa có dữ liệu đơn vị quản lý' : 'Management data unavailable'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
