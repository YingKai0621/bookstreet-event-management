import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Store, 
  MapPin, 
  Plus, 
  Minus, 
  RotateCcw,
  CheckCircle,
  Eye,
  Building2,
  Users,
  X,
  Upload,
  Trash2,
  Save,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Language } from '../../types';
import { OrganizerBoothItem, OrganizerEvent } from '../../types/organizer';
import { MapLocationPoint } from '../../types/map';
import {
  getSharedMapImage, 
  fetchMapHotspotsFromApi,
} from '../../services/mapService';
import { organizerApi } from '../../services/organizerApi';

interface BoothMapViewProps {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
  booths: OrganizerBoothItem[];
  onBackToList?: () => void;
  onApproveBooth?: (boothId: string) => void;
  onRejectBooth?: (boothId: string) => void;
}

interface LocalBoothItem extends OrganizerBoothItem {
  x: number;
  y: number;
}

interface SelectedBoothState {
  booth: LocalBoothItem;
}

export const BoothMapView: React.FC<BoothMapViewProps> = ({
  language,
  events,
  selectedEventId,
  onSelectEventId,
  booths,
  onBackToList,
  onApproveBooth,
  onRejectBooth
}) => {
  const [localBooths, setLocalBooths] = useState<LocalBoothItem[]>([]);

  const [selectedBooth, setSelectedBooth] = useState<SelectedBoothState | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mapImageUrl, setMapImageUrl] = useState<string>(() => getSharedMapImage());
  const [draggingBoothId, setDraggingBoothId] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table filter and pagination states
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'assigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Create Booth Modal state
  const [isAddBoothModalOpen, setIsAddBoothModalOpen] = useState(false);
  const [newBoothData, setNewBoothData] = useState({
    code: '',
    name: '',
    zone: 'Khu A',
    dimensions: '3m x 3m',
    areaType: 'Sách tổng hợp',
    price: '5.000.000 đ',
    electricityIncluded: true,
    waterIncluded: false,
    notes: '',
  });

  // Close popup when switching events
  useEffect(() => {
    setSelectedBooth(null);
  }, [selectedEventId]);

  useEffect(() => {
    fetchMapHotspotsFromApi().then(points => {
      const pointById = new Map(points.map(point => [point.id, point]));
      setLocalBooths(booths.map((booth, index) => {
        const point = pointById.get(booth.id);
        return {
          ...booth,
          x: booth.x ?? point?.x ?? 12 + (index % 12) * 6.9,
          y: booth.y ?? point?.y ?? 38 + Math.floor(index / 12) * 16,
        };
      }));
    }).catch(error => console.warn('Không thể tải tọa độ bản đồ', error));
  }, [booths, selectedEventId]);

  // Close popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBooth(null);
        setIsAddBoothModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global Mouse Events for Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingBoothId || !mapContainerRef.current) return;
      
      const rect = mapContainerRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Clamp coordinates
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      setLocalBooths(prev => prev.map(b => 
        b.id === draggingBoothId ? { ...b, x, y } : b
      ));

      if (selectedBooth?.booth.id === draggingBoothId) {
        setSelectedBooth(prev => prev ? { booth: { ...prev.booth, x, y } } : null);
      }
    };

    const handleMouseUp = () => {
      setDraggingBoothId(null);
    };

    if (draggingBoothId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoothId, selectedBooth]);

  const handleBoothClick = (b: LocalBoothItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (draggingBoothId) return;
    setSelectedBooth(prev => (prev?.booth.id === b.id ? null : { booth: b }));
  };

  const handleBoothMouseDown = (b: LocalBoothItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingBoothId(b.id);
  };

  const handleOpenAddBoothModal = () => {
    const nextNum = localBooths.length + 1;
    setNewBoothData({
      code: `A-${String(nextNum).padStart(2, '0')}`,
      name: '',
      zone: 'Khu A',
      dimensions: '3m x 3m',
      areaType: 'Sách tổng hợp',
      price: '5.000.000 đ',
      electricityIncluded: true,
      waterIncluded: false,
      notes: '',
    });
    setIsAddBoothModalOpen(true);
  };

  const handleCreateBoothSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoothData.name.trim()) return;

    const code = newBoothData.code.trim() || `GH-${localBooths.length + 1}`;
    const newId = `booth-${Date.now()}`;
    const newBooth: LocalBoothItem = {
      id: newId,
      code,
      name: newBoothData.name.trim(),
      zone: newBoothData.zone,
      dimensions: newBoothData.dimensions,
      status: 'available',
      statusLabelVi: 'Còn trống',
      areaType: newBoothData.areaType,
      priceEstimate: newBoothData.price,
      notes: newBoothData.notes,
      x: 15 + ((localBooths.length * 8) % 70),
      y: 35 + ((Math.floor(localBooths.length / 8) * 16) % 50),
    };

    try {
      await organizerApi.createBooth({
        code,
        name: newBoothData.name.trim(),
        areaName: newBoothData.zone,
        category: newBoothData.areaType,
        dimensions: newBoothData.dimensions,
        price: parseInt(newBoothData.price.replace(/\D/g, '')) || 5000000,
        description: newBoothData.notes,
      });
    } catch (err) {
      console.warn('Could not persist booth to backend', err);
    }

    setLocalBooths(prev => [...prev, newBooth]);
    setIsAddBoothModalOpen(false);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleDeleteBooth = async (id: string) => {
    await organizerApi.deleteBooth(id);
    setLocalBooths(prev => prev.filter(b => b.id !== id));
    if (selectedBooth?.booth.id === id) setSelectedBooth(null);
    window.dispatchEvent(new Event('duongsach:data-changed'));
  };

  const handleUpdateBooth = (updated: LocalBoothItem) => {
    setLocalBooths(prev => prev.map(b => b.id === updated.id ? updated : b));
    setSelectedBooth({ booth: updated });
  };

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveMap = async () => {
    await Promise.all(localBooths.map(booth => Promise.all([
      organizerApi.updateBoothMapPosition(booth.id, booth.x, booth.y),
      organizerApi.updateBooth(booth.id, { code: booth.code, name: booth.name, category: booth.areaType, areaName: booth.zone, dimensions: booth.dimensions }),
    ])));
    setIsSaved(true);
    window.dispatchEvent(new Event('duongsach:data-changed'));
    setTimeout(() => {
      setIsSaved(false);
    }, 2500);
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setMapImageUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter booths for table
  const filteredBooths = localBooths.filter(b => {
    if (selectedBooth) {
      return b.id === selectedBooth.booth.id;
    }
    if (activeTab === 'pending' && b.status !== 'pending') return false;
    if (activeTab === 'assigned' && b.status !== 'assigned') return false;
    if (selectedZone !== 'all' && b.zone !== selectedZone) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || (b.orgName && b.orgName.toLowerCase().includes(q));
    }
    return true;
  });

  const totalPages = Math.ceil(filteredBooths.length / itemsPerPage) || 1;
  const paginatedBooths = selectedBooth 
    ? filteredBooths 
    : filteredBooths.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusChip = (status: OrganizerBoothItem['status']) => {
    switch (status) {
      case 'assigned':
        return <span className="org-chip" style={{ background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB' }}>● {language === 'vi' ? 'Đã thuê' : 'Assigned'}</span>;
      case 'pending':
        return <span className="org-chip pending">● {language === 'vi' ? 'Chờ duyệt' : 'Pending'}</span>;
      case 'available':
      default:
        return <span className="org-chip available">● {language === 'vi' ? 'Còn trống' : 'Available'}</span>;
    }
  };

  return (
    <div className="organizer-content">
      {/* 1. Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div>
            <h1 className="organizer-view-title" style={{ fontSize: '1.4rem' }}>
              {language === 'vi' ? 'Sơ đồ & Danh sách gian hàng' : 'Booth Map & Table View'}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-org-primary"
            onClick={handleOpenAddBoothModal}
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={14} />
            {language === 'vi' ? 'Thêm gian hàng' : 'Add Booth'}
          </button>
        </div>
      </div>

      {/* 2. Legend & Tools */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '10px',
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.82rem', fontWeight: 650, color: '#374151' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#9CA3AF', border: '1px solid #6B7280' }}></span>
            <span>{language === 'vi' ? 'Đã thuê' : 'Assigned'}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FBBF24', border: '1px solid #D97706' }}></span>
            <span>{language === 'vi' ? 'Chờ duyệt' : 'Pending'}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#E0F2FE', border: '1px solid #7DD3FC' }}></span>
            <span>{language === 'vi' ? 'Còn trống' : 'Available'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleMapUpload} 
            style={{ display: 'none' }} 
          />
          <button
            type="button"
            className="btn-org-secondary"
            style={{ padding: '0.35rem 0.75rem', height: '34px', fontSize: '0.8rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Tải bản đồ lên</span>
          </button>

          <button
            type="button"
            className="btn-org-primary"
            style={{ 
              padding: '0.35rem 0.85rem', 
              height: '34px', 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem',
              background: isSaved ? '#059669' : '#17382E',
              transition: 'background 0.2s ease'
            }}
            onClick={handleSaveMap}
          >
            {isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
            <span>{isSaved ? (language === 'vi' ? 'Đã lưu!' : 'Saved!') : (language === 'vi' ? 'Lưu' : 'Save')}</span>
          </button>

          <div style={{ width: '1px', height: '24px', background: '#E2EAE5' }}></div>

          <button
            type="button"
            className="organizer-icon-button"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.1))}
            title="Thu nhỏ"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            className="organizer-icon-button"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setZoomLevel(1)}
            title="Mặc định"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="organizer-icon-button"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
            title="Phóng to"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* 3. Interactive Map Container */}
      <div 
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedBooth(null);
          }
        }}
        style={{
        background: '#FFFFFF',
        border: '1.5px solid #DFCDBD',
        borderRadius: '16px',
        padding: 0,
        position: 'relative',
        overflow: 'visible',
        boxShadow: '0 10px 35px rgba(24, 41, 36, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'default',
        marginBottom: '2rem'
      }}>
        <div 
          ref={mapContainerRef}
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
              setSelectedBooth(null);
            }
          }}
          style={{
          width: '100%',
          position: 'relative',
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top center',
          transition: draggingBoothId ? 'none' : 'transform 0.2s ease',
          background: '#E8E0D2'
        }}>
          {/* Real Illustrated Map Picture */}
          <img 
            src={mapImageUrl} 
            alt="Bản đồ"
            style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
            draggable={false}
          />

          {/* Interactive Booth Markers */}
          {localBooths.map(b => {
            const isSelected = selectedBooth?.booth.id === b.id;
            const isDragging = draggingBoothId === b.id;

            let badgeBg = '#E0F2FE';
            let badgeBorder = '#7DD3FC';

            if (b.status === 'assigned') {
              badgeBg = '#9CA3AF';
              badgeBorder = '#6B7280';
            } else if (b.status === 'pending') {
              badgeBg = '#FBBF24';
              badgeBorder = '#D97706';
            }

            if (isSelected || isDragging) {
              badgeBorder = '#17382E';
            }

            return (
              <div
                key={b.id}
                onClick={(e) => handleBoothClick(b, e)}
                onMouseDown={(e) => handleBoothMouseDown(b, e)}
                style={{
                  position: 'absolute',
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: (isSelected || isDragging) ? 25 : 10,
                  transition: isDragging ? 'none' : 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
              >
                <button
                  type="button"
                  style={{
                    background: badgeBg,
                    border: `2px solid ${badgeBorder}`,
                    borderRadius: '20px',
                    padding: '3px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: (isSelected || isDragging)
                      ? '0 0 0 4px rgba(23, 56, 46, 0.35), 0 6px 16px rgba(0,0,0,0.3)' 
                      : '0 3px 8px rgba(0,0,0,0.22)',
                    color: b.status === 'available' ? '#0369A1' : '#1F2937',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transform: (isSelected || isDragging) ? 'scale(1.15)' : 'scale(1)',
                    transition: isDragging ? 'none' : 'transform 180ms ease, box-shadow 180ms ease'
                  }}
                  title={`${b.code} - ${b.name}${b.orgName ? ' | ' + b.orgName : ''} (${b.statusLabelVi})`}
                >
                  <span>{b.code}</span>
                </button>
              </div>
            );
          })}

          {/* 4. Popover Detail Card Anchored Directly to Clicked Booth */}
          {selectedBooth && (() => {
            const isAbove = selectedBooth.booth.y >= 50;
            const rawLeftPercent = selectedBooth.booth.x;
            const rawTopPercent = selectedBooth.booth.y;
            const clampedLeftPercent = Math.max(18, Math.min(82, rawLeftPercent));
            const arrowPercent = Math.max(10, Math.min(90, 50 + (rawLeftPercent - clampedLeftPercent) * 2.5));

            return (
              <div 
                key={selectedBooth.booth.id}
                onClick={(e) => e.stopPropagation()}
                className={`booth-popover-card ${isAbove ? 'above' : 'below'}`}
                style={{
                  top: isAbove ? `calc(${rawTopPercent}% - 24px)` : `calc(${rawTopPercent}% + 24px)`,
                  left: `${clampedLeftPercent}%`,
                  padding: '1.25rem 1.4rem',
                  width: '440px',
                  maxWidth: '92vw',
                  boxSizing: 'border-box',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.16), 0 4px 16px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  zIndex: 100,
                  position: 'absolute'
                }}
              >
                <div
                  className={`booth-popover-tail ${isAbove ? 'tail-down' : 'tail-up'}`}
                  style={{ left: `${arrowPercent}%` }}
                />

                {/* Header Inputs + Close Button on the same row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #F3F4F6' }}>
                  <input 
                    type="text"
                    value={selectedBooth.booth.code}
                    onChange={(e) => handleUpdateBooth({ ...selectedBooth.booth, code: e.target.value })}
                    style={{ 
                      width: '64px', height: '36px', flexShrink: 0, padding: '0 0.35rem', fontWeight: 800, fontSize: '0.95rem', 
                      color: '#17382E', background: '#F4FBF7', border: '1.5px solid #A7F3D0', 
                      borderRadius: '8px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' 
                    }}
                  />
                  <input
                    type="text"
                    value={selectedBooth.booth.name}
                    onChange={(e) => handleUpdateBooth({ ...selectedBooth.booth, name: e.target.value })}
                    placeholder="Tên gian hàng..."
                    style={{ 
                      flex: 1, minWidth: 0, height: '36px', padding: '0 0.75rem', fontWeight: 650, fontSize: '0.95rem', 
                      color: '#1F2937', background: '#F9FAFB', border: '1px solid #E5E7EB', 
                      borderRadius: '8px', outline: 'none', boxSizing: 'border-box' 
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedBooth(null); }}
                    style={{
                      width: '32px',
                      height: '32px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#F3F4F6',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#6B7280',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Đóng (Esc)"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* 2x2 Grid Form Info Card */}
                <div 
                  className="bpop-info" 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '0.75rem 0.9rem', 
                    background: '#F8FAF9', 
                    padding: '0.9rem 1rem', 
                    borderRadius: '12px',
                    border: '1px solid #E5ECE8'
                  }}
                >
                  {/* Row 1, Col 1: Trạng thái */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#556B65', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Trạng thái
                    </label>
                    <select
                      value={selectedBooth.booth.status}
                      disabled
                      style={{ 
                        width: '100%', height: '34px', padding: '0 0.5rem', borderRadius: '6px', 
                        border: '1px solid #D1D5DB', fontSize: '0.84rem', background: '#FFFFFF',
                        color: '#111827', fontWeight: 600, outline: 'none', cursor: 'pointer', boxSizing: 'border-box'
                      }}
                    >
                      <option value="available">Còn trống</option>
                      <option value="pending">Chờ duyệt</option>
                      <option value="assigned">Đã thuê</option>
                    </select>
                  </div>

                  {/* Row 1, Col 2: Đơn vị */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#556B65', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Đơn vị tham gia
                    </label>
                    <input
                      type="text"
                      value={selectedBooth.booth.orgName || ''}
                      readOnly
                      placeholder="Chưa có đơn vị..."
                      style={{ 
                        width: '100%', height: '34px', padding: '0 0.6rem', borderRadius: '6px', 
                        border: '1px solid #D1D5DB', fontSize: '0.84rem', background: '#FFFFFF',
                        color: '#111827', fontWeight: 500, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Row 2, Col 1: Khu vực */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#556B65', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Khu vực
                    </label>
                    <input
                      type="text"
                      value={selectedBooth.booth.zone || ''}
                      onChange={(e) => handleUpdateBooth({ ...selectedBooth.booth, zone: e.target.value })}
                      placeholder="Khu A, Khu B..."
                      style={{ 
                        width: '100%', height: '34px', padding: '0 0.6rem', borderRadius: '6px', 
                        border: '1px solid #D1D5DB', fontSize: '0.84rem', background: '#FFFFFF',
                        color: '#374151', outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Row 2, Col 2: Kích thước */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#556B65', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Kích thước
                    </label>
                    <input
                      type="text"
                      value={selectedBooth.booth.dimensions || ''}
                      onChange={(e) => handleUpdateBooth({ ...selectedBooth.booth, dimensions: e.target.value })}
                      placeholder="3m x 3m..."
                      style={{ 
                        width: '100%', height: '34px', padding: '0 0.6rem', borderRadius: '6px', 
                        border: '1px solid #D1D5DB', fontSize: '0.84rem', background: '#FFFFFF',
                        color: '#374151', outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {selectedBooth.booth.registeredDate && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.25rem', borderTop: '1px dashed #E2EAE5' }}>
                      <span style={{ fontSize: '0.75rem', color: '#556B65', fontWeight: 600 }}>Ngày đăng ký:</span>
                      <span style={{ fontSize: '0.82rem', color: '#111827', fontWeight: 600 }}>
                        {selectedBooth.booth.registeredDate}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="bpop-actions" style={{ marginTop: '1.1rem', display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteBooth(selectedBooth.booth.id)}
                    style={{ 
                      background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', 
                      borderRadius: '8px', padding: '0.45rem 0.9rem', display: 'flex', 
                      alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', 
                      cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' 
                    }}
                  >
                    <Trash2 size={14} />
                    Xóa
                  </button>
                  <button
                    type="button"
                    className="bpop-btn-detail"
                    onClick={() => setSelectedBooth(null)}
                    style={{ 
                      flex: 1, background: '#17382E', color: '#FFFFFF', border: 'none', 
                      borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.88rem', 
                      cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(23, 56, 46, 0.15)'
                    }}
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 5. Integrated Table View Below the Map */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(23, 36, 33, 0.04)'
      }}>
        {/* Table Title & Filter Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#17382E', margin: 0 }}>
              {language === 'vi' ? 'Danh sách chi tiết gian hàng' : 'Booth Details List'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#556B65', margin: '0.25rem 0 0 0' }}>
              {selectedBooth 
                ? (language === 'vi' 
                    ? `Đang lọc hiển thị điểm đã chọn trên bản đồ: ${selectedBooth.booth.code} - ${selectedBooth.booth.name}`
                    : `Filtered to selected map marker: ${selectedBooth.booth.code} - ${selectedBooth.booth.name}`)
                : (language === 'vi'
                    ? 'Nhấp chọn điểm bất kỳ trên bản đồ để lọc nhanh gian hàng tương ứng'
                    : 'Click any point on the map to filter corresponding booth')}
            </p>
          </div>

          {selectedBooth && (
            <button
              type="button"
              className="btn-org-secondary"
              onClick={() => setSelectedBooth(null)}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RotateCcw size={13} />
              <span>{language === 'vi' ? 'Hiển thị tất cả gian hàng' : 'Show all booths'}</span>
            </button>
          )}
        </div>

        {/* Toolbar with Tabs and Search */}
        {!selectedBooth && (
          <div className="org-toolbar" style={{ marginBottom: '1rem' }}>
            <div className="org-tabs-bar" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button
                type="button"
                className={`org-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              >
                {language === 'vi' ? `Tất cả (${localBooths.length})` : `All (${localBooths.length})`}
              </button>
              <button
                type="button"
                className={`org-tab-btn ${activeTab === 'pending' ? 'is-active' : ''}`}
                onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
              >
                {language === 'vi' 
                  ? `Chờ duyệt (${localBooths.filter(b => b.status === 'pending').length})` 
                  : `Pending (${localBooths.filter(b => b.status === 'pending').length})`}
              </button>
              <button
                type="button"
                className={`org-tab-btn ${activeTab === 'assigned' ? 'is-active' : ''}`}
                onClick={() => { setActiveTab('assigned'); setCurrentPage(1); }}
              >
                {language === 'vi' 
                  ? `Đã thuê (${localBooths.filter(b => b.status === 'assigned').length})` 
                  : `Assigned (${localBooths.filter(b => b.status === 'assigned').length})`}
              </button>
            </div>

            <div className="org-toolbar-left" style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <div className="organizer-search-box" style={{ maxWidth: '220px' }}>
                <Search size={14} />
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Tìm kiếm gian hàng...' : 'Search booth...'}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <select
                value={selectedZone}
                onChange={(e) => { setSelectedZone(e.target.value); setCurrentPage(1); }}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #D6E0DB',
                  background: '#FFFFFF',
                  color: '#172421',
                  fontSize: '0.82rem'
                }}
              >
                <option value="all">{language === 'vi' ? 'Tất cả khu vực' : 'All Zones'}</option>
                <option value="Khu A">Khu A</option>
                <option value="Khu B">Khu B</option>
                <option value="Khu C">Khu C</option>
              </select>
            </div>
          </div>
        )}

        {/* Booth Table */}
        <div className="org-table-container" style={{ border: '1px solid #E2EAE5', borderRadius: '10px' }}>
          <table className="org-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Mã</th>
                <th>Tên gian hàng</th>
                <th>Đơn vị tham gia</th>
                <th>Khu vực</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBooths.length > 0 ? (
                paginatedBooths.map((b) => (
                  <tr 
                    key={b.id}
                    style={{ 
                      background: selectedBooth?.booth.id === b.id ? '#F0FDF4' : undefined,
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedBooth({ booth: b })}
                  >
                    <td>
                      <strong style={{ color: '#17382E', fontSize: '0.9rem' }}>{b.code}</strong>
                    </td>
                    <td>
                      <strong>{b.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.74rem', color: '#637771' }}>
                        {b.dimensions} • {b.areaType}
                      </span>
                    </td>
                    <td>
                      {b.orgName ? (
                        <span style={{ color: '#172421', fontWeight: 600 }}>{b.orgName}</span>
                      ) : (
                        <span style={{ color: '#8E9F97', fontStyle: 'italic' }}>Chưa đăng ký</span>
                      )}
                    </td>
                    <td>
                      <span style={{ background: '#F0F4F1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', color: '#17382E', fontWeight: 650 }}>
                        {b.zone}
                      </span>
                    </td>
                    <td>
                      {getStatusChip(b.status)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {b.status === 'pending' ? (
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn-org-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateBooth({ ...b, status: 'assigned', statusLabelVi: 'Đã thuê' });
                              if (onApproveBooth) onApproveBooth(b.id);
                            }}
                            title="Phê duyệt đăng ký"
                          >
                            <Check size={13} />
                            <span>Duyệt</span>
                          </button>
                          <button
                            type="button"
                            className="btn-org-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem', color: '#C84C32' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateBooth({ ...b, status: 'available', statusLabelVi: 'Còn trống', orgName: '' });
                              if (onRejectBooth) onRejectBooth(b.id);
                            }}
                            title="Từ chối"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-org-secondary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooth({ booth: b });
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                        >
                          <span>Xem vị trí</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                    {language === 'vi' ? 'Không tìm thấy gian hàng phù hợp.' : 'No booths found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination when showing all */}
        {!selectedBooth && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredBooths.length)} trong tổng số {filteredBooths.length} gian hàng
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className="organizer-icon-button"
                style={{ width: '28px', height: '28px' }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className="organizer-icon-button"
                style={{ width: '28px', height: '28px' }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ── Modal Thêm Gian Hàng Mới ── */}
      {isAddBoothModalOpen && (
        <div 
          className="organizer-modal-overlay" 
          onClick={() => setIsAddBoothModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 18, 14, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
        >
          <div 
            className="organizer-card" 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #EEF2F0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(23, 56, 46, 0.1)', color: '#17382E', display: 'grid', placeItems: 'center' }}>
                  <Store size={20} />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0, color: '#172421' }}>
                    {language === 'vi' ? 'Thêm gian hàng mới' : 'Add New Booth'}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#637771' }}>
                    {language === 'vi' ? 'Khai báo thông số và định vị gian hàng trên Đường Sách' : 'Define booth specs and allocation for Book Street'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBoothModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#8C9E98', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBoothSubmit} style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                    {language === 'vi' ? 'Mã gian hàng *' : 'Booth Code *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newBoothData.code}
                    onChange={(e) => setNewBoothData({ ...newBoothData, code: e.target.value })}
                    placeholder="VD: A-01"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #D5DFDC', fontSize: '0.9rem', fontWeight: 700, color: '#17382E', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                    {language === 'vi' ? 'Tên gian hàng *' : 'Booth Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newBoothData.name}
                    onChange={(e) => setNewBoothData({ ...newBoothData, name: e.target.value })}
                    placeholder="VD: Gian hàng Sách Văn học Kim Đồng"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #D5DFDC', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #EEF2F0' }}>
                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={() => setIsAddBoothModalOpen(false)}
                >
                  {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Save size={15} />
                  <span>{language === 'vi' ? 'Tạo gian hàng' : 'Create Booth'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
