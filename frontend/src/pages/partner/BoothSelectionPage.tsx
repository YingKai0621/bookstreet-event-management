import {
  ArrowRight,
  CheckCircle2,
  Info,
  RotateCcw,
  Send,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSharedMapImage, getSharedMapPoints } from '../../services/mapService';
import { Language, PartnerBooth } from '../../types';
import { MapLocationPoint } from '../../types/map';
import './PartnerPages.css';

interface BoothSelectionPageProps {
  language: Language;
  booths?: PartnerBooth[];
  currentAssignedBoothId?: string;
  onSelectBooth: (boothId: string) => void;
}

export const BoothSelectionPage: React.FC<BoothSelectionPageProps> = ({
  language,
  booths: _initialBooths,
  currentAssignedBoothId: _currentAssignedBoothId,
  onSelectBooth,
}) => {
  const navigate = useNavigate();
  const [mapPoints, setMapPoints] = useState<MapLocationPoint[]>(() => getSharedMapPoints());
  const [mapImageUrl, setMapImageUrl] = useState<string>(() => getSharedMapImage());
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [activePoint, setActivePoint] = useState<MapLocationPoint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Listen for BQL Map Updates in Real-time
  useEffect(() => {
    const handleMapUpdate = (e: any) => {
      if (e.detail?.points) {
        setMapPoints(e.detail.points);
      }
    };
    const handleImageUpdate = (e: any) => {
      if (e.detail?.imageUrl) {
        setMapImageUrl(e.detail.imageUrl);
      }
    };
    window.addEventListener('duongsach_map_updated', handleMapUpdate);
    window.addEventListener('duongsach_map_image_updated', handleImageUpdate);
    return () => {
      window.removeEventListener('duongsach_map_updated', handleMapUpdate);
      window.removeEventListener('duongsach_map_image_updated', handleImageUpdate);
    };
  }, []);

  // Close popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePoint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const filteredPoints = mapPoints.filter(p => {
    if (selectedZone === 'all') return true;
    return p.zone === selectedZone;
  });

  const handlePointClick = (p: MapLocationPoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePoint(prev => (prev?.id === p.id ? null : p));
  };

  const handleOpenChangeRequestModal = () => {
    if (!activePoint || activePoint.status !== 'available') return;
    setIsModalOpen(true);
  };

  const handleConfirmChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePoint) return;
    setIsSubmitted(true);
    setTimeout(() => {
      onSelectBooth(activePoint.id);
      setIsSubmitted(false);
      setIsModalOpen(false);
      setConfirmedSuccess(true);
      setTimeout(() => {
        navigate('/partner/booths');
      }, 1200);
    }, 1500);
  };

  return (
    <div className="booth-selection-page">
      {/* 1. Header */}
      <div className="partner-page-header">
        <h1 className="partner-page-title">
          {language === 'vi' ? 'Sơ đồ & Chọn đổi gian hàng' : 'Booth Map & Location Selection'}
        </h1>
        <p className="partner-page-sub">
          {language === 'vi' 
            ? 'Xem sơ đồ quy hoạch Đường Sách và lựa chọn các gian hàng còn trống để gửi yêu cầu đổi vị trí tới Ban Quản Lý.' 
            : 'Explore the Book Street layout and select available stalls to request a relocation.'}
        </p>
      </div>

      {/* 2. Interactive Map Container matching Sketch Screen 3 */}
      <div className="booth-map-container">
        {/* Legend & Filter Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Status Legend matching Sketch */}
          <div className="booth-legend-row" style={{ margin: 0 }}>
            <div className="legend-item">
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#9CA3AF', border: '1px solid #6B7280' }}></div>
              <span>{language === 'vi' ? 'Đã thuê (Khóa)' : 'Assigned (Locked)'}</span>
            </div>
            <div className="legend-item">
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FBBF24', border: '1px solid #D97706' }}></div>
              <span>{language === 'vi' ? 'Chờ duyệt (Khóa)' : 'Pending (Locked)'}</span>
            </div>
            <div className="legend-item">
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#E0F2FE', border: '1px solid #7DD3FC' }}></div>
              <span>{language === 'vi' ? 'Còn trống (Có thể chọn)' : 'Available (Selectable)'}</span>
            </div>
          </div>

          {/* Right cluster: Zone filter + Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#637771' }}>
                {language === 'vi' ? 'Khu vực:' : 'Zone:'}
              </span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #D5DFDC',
                  fontSize: '0.84rem',
                  backgroundColor: '#FFFFFF',
                  color: '#172421',
                  cursor: 'pointer'
                }}
              >
                <option value="all">{language === 'vi' ? 'Tất cả khu vực' : 'All zones'}</option>
                <option value="Khu A">Khu A (Gần Cổng Chính)</option>
                <option value="Khu B">Khu B (Trung tâm)</option>
                <option value="Khu C">Khu C (Sân khấu & Di sản)</option>
              </select>
            </div>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#F4F7F5', padding: '3px', borderRadius: '8px', border: '1px solid #E2EAE5' }}>
              <button
                type="button"
                onClick={handleZoomIn}
                style={{ background: 'none', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', color: '#17382E' }}
                title="Phóng to"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                style={{ background: 'none', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: zoomLevel <= 1 ? 'not-allowed' : 'pointer', color: zoomLevel <= 1 ? '#9CA3AF' : '#17382E' }}
                title="Thu nhỏ"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                style={{ background: 'none', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', color: '#17382E', fontSize: '0.75rem', fontWeight: 700 }}
                title="Đặt lại"
              >
                <RotateCcw size={12} style={{ marginRight: '3px' }} />
                <span>{Math.round(zoomLevel * 100)}%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Map Viewport */}
        <div 
          ref={mapContainerRef}
          onClick={() => setActivePoint(null)}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: 'relative',
            width: '100%',
            background: '#E8E0D2',
            border: '1.5px solid #DFCDBD',
            borderRadius: '14px',
            overflow: zoomLevel > 1 ? 'hidden' : 'visible',
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            boxShadow: '0 4px 18px rgba(0,0,0,0.06)'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Illustrated Map Background */}
            <img 
              src={mapImageUrl} 
              alt="Bản đồ Đường Sách" 
              style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
              draggable={false}
            />

            {/* Interactive Booth Markers on Map */}
            {filteredPoints.map((point) => {
              const isSelected = activePoint?.id === point.id;
              const isAvailable = point.status === 'available';
              const markerScale = 1 / zoomLevel;

              let badgeBg = '#E0F2FE';
              let badgeBorder = '#7DD3FC';
              let textColor = '#0369A1';

              if (point.status === 'assigned') {
                badgeBg = '#9CA3AF';
                badgeBorder = '#6B7280';
                textColor = '#374151';
              } else if (point.status === 'pending') {
                badgeBg = '#FBBF24';
                badgeBorder = '#D97706';
                textColor = '#92400E';
              }

              if (isSelected) {
                badgeBorder = '#17382E';
              }

              return (
                <div
                  key={point.id}
                  style={{
                    position: 'absolute',
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    transform: `translate(-50%, ${isSelected ? '-65%' : '-50%'}) scale(${markerScale})`,
                    zIndex: isSelected ? 30 : 10,
                    transition: 'all 0.18s ease'
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => handlePointClick(point, e)}
                    style={{
                      background: isSelected ? '#E9BC63' : badgeBg,
                      border: `2px solid ${isSelected ? '#17382E' : badgeBorder}`,
                      borderRadius: '20px',
                      padding: '3px 9px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: isSelected
                        ? '0 0 0 4px rgba(23, 56, 46, 0.35), 0 8px 24px rgba(0,0,0,0.3)' 
                        : '0 3px 8px rgba(0,0,0,0.22)',
                      color: isSelected ? '#172421' : textColor,
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      opacity: isAvailable ? 1 : 0.85,
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 160ms ease'
                    }}
                    title={`${point.code} - ${point.name} (${isAvailable ? 'Còn trống - Có thể chọn' : 'Đã thuê / Đang giữ - Không thể chọn'})`}
                  >
                    <span>{point.code}</span>
                    {!isAvailable && <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>🔒</span>}
                  </button>
                </div>
              );
            })}

            {/* Popover anchored on the clicked booth */}
            {activePoint && (() => {
              const isAbove = activePoint.y >= 45;
              const rawLeftPercent = activePoint.x;
              const rawTopPercent = activePoint.y;
              const clampedLeftPercent = Math.max(22, Math.min(78, rawLeftPercent));
              const isAvailable = activePoint.status === 'available';

              return (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: isAbove ? `calc(${rawTopPercent}% - 16px)` : `calc(${rawTopPercent}% + 16px)`,
                    left: `${clampedLeftPercent}%`,
                    transform: isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                    padding: '1.15rem 1.25rem',
                    width: '380px',
                    maxWidth: '90vw',
                    maxHeight: '90%',
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.1)',
                    border: '1.5px solid #E2EAE5',
                    zIndex: 60,
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8C6519', textTransform: 'uppercase' }}>
                        {activePoint.zone || 'Khu vực trung tâm'}
                      </span>
                      <h4 style={{ margin: '0.15rem 0 0 0', fontSize: '1.05rem', color: '#172421', fontWeight: 800 }}>
                        {activePoint.code} • {activePoint.name}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePoint(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '3px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div style={{ marginBottom: '0.65rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '12px',
                      background: isAvailable ? '#E0F2FE' : (activePoint.status === 'pending' ? '#FEF3C7' : '#F3F4F6'),
                      color: isAvailable ? '#0369A1' : (activePoint.status === 'pending' ? '#92400E' : '#4B5563'),
                      border: `1px solid ${isAvailable ? '#BAE6FD' : (activePoint.status === 'pending' ? '#FDE68A' : '#D1D5DB')}`
                    }}>
                      ● {isAvailable ? 'Còn trống — Sẵn sàng đăng ký đổi' : (activePoint.status === 'pending' ? 'Đang chờ duyệt (Không thể chọn)' : 'Đã có đơn vị thuê (Không thể chọn)')}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: '#556B65', lineHeight: 1.5, margin: '0 0 0.85rem 0' }}>
                    {activePoint.shortDesc || 'Gian hàng tiêu chuẩn tại trục đường chính Nguyễn Văn Bình.'}
                  </p>

                  <div style={{ background: '#F8FAF9', border: '1px solid #E2EAE5', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                    <div><strong>Diện tích:</strong> {activePoint.dimensions || '3m x 3m'}</div>
                    <div><strong>Phân loại:</strong> {activePoint.areaType || 'Sách tổng hợp'}</div>
                    {activePoint.orgName && <div><strong>Đơn vị đang thuê:</strong> {activePoint.orgName}</div>}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn-part-secondary"
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', justifyContent: 'center' }}
                      onClick={() => setActivePoint(null)}
                    >
                      {language === 'vi' ? 'Đóng' : 'Close'}
                    </button>

                    {isAvailable ? (
                      <button
                        type="button"
                        className="btn-part-primary"
                        style={{ flex: 1.6, padding: '0.45rem', fontSize: '0.8rem', justifyContent: 'center' }}
                        onClick={handleOpenChangeRequestModal}
                      >
                        <span>{language === 'vi' ? 'Yêu cầu đổi sang gian này' : 'Request Relocation'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        style={{
                          flex: 1.6,
                          padding: '0.45rem',
                          fontSize: '0.78rem',
                          background: '#E5E7EB',
                          color: '#9CA3AF',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          fontWeight: 650
                        }}
                      >
                        <span>🔒 Không thể chọn</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 3. Bottom Summary Card matching Sketch Screen 3 */}
      {activePoint ? (
        <div className="booth-selection-summary-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {activePoint.imageUrl && <img src={activePoint.imageUrl} alt={activePoint.name} style={{ width: '100px', height: '70px', borderRadius: '8px', objectFit: 'cover' }} />}
            <div>
              <div style={{ fontSize: '0.78rem', color: '#637771', fontWeight: 600, marginBottom: '0.2rem' }}>
                {language === 'vi' ? 'Thông tin gian hàng đang xem' : 'Inspected Booth Info'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 800, color: '#172421' }}>
                  {activePoint.code}
                </span>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: activePoint.status === 'available' ? '#E0F2FE' : '#F3F4F6',
                  color: activePoint.status === 'available' ? '#0369A1' : '#4B5563',
                  border: `1px solid ${activePoint.status === 'available' ? '#BAE6FD' : '#D1D5DB'}`
                }}>
                  {activePoint.status === 'available' ? '● Còn trống' : '🔒 Đã khóa (Không thể chọn)'}
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#556B65', marginTop: '0.25rem' }}>
                <span>{language === 'vi' ? 'Diện tích:' : 'Size:'} {activePoint.dimensions || '3m x 3m'}</span>
                <span style={{ margin: '0 0.5rem' }}>•</span>
                <span>{language === 'vi' ? 'Khu vực:' : 'Zone:'} {activePoint.zone || 'Khu A'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              type="button"
              className="btn-booth-cancel"
              onClick={() => setActivePoint(null)}
            >
              {language === 'vi' ? 'Bỏ chọn' : 'Deselect'}
            </button>
            <button 
              type="button"
              className="btn-booth-confirm"
              onClick={handleOpenChangeRequestModal}
              disabled={activePoint.status !== 'available' || confirmedSuccess}
              style={{
                opacity: activePoint.status === 'available' ? 1 : 0.6,
                cursor: activePoint.status === 'available' ? 'pointer' : 'not-allowed'
              }}
            >
              {confirmedSuccess ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>{language === 'vi' ? 'Đã gửi yêu cầu đổi!' : 'Request Sent!'}</span>
                </>
              ) : (
                <>
                  <span>{activePoint.status === 'available' ? (language === 'vi' ? 'Gửi yêu cầu đổi sang gian này' : 'Request Relocation') : (language === 'vi' ? 'Gian hàng đã có người thuê' : 'Stall Occupied')}</span>
                  {activePoint.status === 'available' && <ArrowRight size={16} />}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="booth-selection-summary-card" style={{ background: '#F8FAF9', border: '1px dashed #D1DCD7', justifyContent: 'center', textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#637771', fontSize: '0.88rem' }}>
            <Info size={18} color="#17382E" />
            <span>{language === 'vi' ? 'Vui lòng nhấp vào một gian hàng màu xanh (Còn trống) trên sơ đồ để xem thông tin chi tiết và gửi yêu cầu đổi vị trí.' : 'Please click on an available booth (blue) on the map to inspect and request relocation.'}</span>
          </div>
        </div>
      )}

      {/* Modal: Gửi yêu cầu đổi gian hàng */}
      {isModalOpen && activePoint && (
        <div className="attendance-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="attendance-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="attendance-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                {language === 'vi' ? `Yêu cầu đổi sang gian ${activePoint.code}` : `Request Relocation to ${activePoint.code}`}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="attendance-modal-body">
              {isSubmitted ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <CheckCircle2 size={46} color="#059669" style={{ margin: '0 auto 0.75rem' }} />
                  <h4 style={{ margin: '0 0 0.4rem 0', color: '#172421' }}>
                    {language === 'vi' ? 'Yêu cầu đổi gian hàng đã được gửi!' : 'Change request submitted!'}
                  </h4>
                  <p style={{ fontSize: '0.86rem', color: '#556B65' }}>
                    {language === 'vi' 
                      ? 'Ban Quản Lý sẽ xem xét và phản hồi qua mục Thông báo trong vòng 24 giờ.' 
                      : 'Management will review and respond via Notifications within 24h.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleConfirmChangeRequest}>
                  <div style={{ 
                    background: '#FAF8F3', 
                    border: '1px solid #EAE0CE', 
                    borderRadius: '10px', 
                    padding: '0.85rem 1rem', 
                    marginBottom: '1rem',
                    fontSize: '0.86rem'
                  }}>
                    <div style={{ fontWeight: 700, color: '#172421', marginBottom: '0.25rem' }}>
                      {language === 'vi' ? 'Vị trí mong muốn chuyển đến:' : 'Requested Destination:'}
                    </div>
                    <div style={{ color: '#8C6519', fontWeight: 650 }}>
                      {activePoint.code} — {activePoint.name} ({activePoint.zone}, {activePoint.dimensions})
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Lý do xin đổi vị trí gian hàng *' : 'Reason for relocation *'}</label>
                    <textarea 
                      rows={4}
                      required 
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder={language === 'vi' ? 'Ví dụ: Do nhu cầu mở rộng không gian trưng bày sách thiếu nhi tương tác và tiếp cận luồng độc giả từ cổng chính...' : 'State your reason...'}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button 
                      type="button" 
                      className="btn-part-secondary"
                      onClick={() => setIsModalOpen(false)}
                    >
                      {language === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                    <button type="submit" className="btn-part-primary">
                      <Send size={15} />
                      <span>{language === 'vi' ? 'Gửi yêu cầu' : 'Submit'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
