import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  AlertCircle,
  Check,
  Clock3,
  DollarSign,
  Edit3,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { BoothRequest, CreatePhysicalBoothInput, EventBooth, PhysicalBooth, UpdatePhysicalBoothInput } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import { BoothMapCanvas, type PopoverBoothData } from '../booth-map/BoothMapCanvas';
import type { BoothMapMarker } from '../booth-map/boothMapModel';
import './Sprint2Booth.css';
import './OrganizerBoothManagementView.css';

const CATEGORY_OPTIONS: Array<{ code: string; labelVi: string; labelEn: string }> = [
  { code: 'MANGA_COMICS', labelVi: 'Truyện tranh & Manga', labelEn: 'Manga & Comics' },
  { code: 'LITERATURE', labelVi: 'Văn học & Nghệ thuật', labelEn: 'Literature & Art' },
  { code: 'TECHNOLOGY_SCIENCE', labelVi: 'Công nghệ & Khởi nghiệp', labelEn: 'Tech & Innovation' },
  { code: 'CHILDREN', labelVi: 'Sách Thiếu nhi', labelEn: 'Children Books' },
  { code: 'ART_CULTURE', labelVi: 'Nghệ thuật & Văn hóa', labelEn: 'Art & Culture' },
  { code: 'HISTORY_SOCIETY', labelVi: 'Lịch sử & Xã hội', labelEn: 'History & Society' },
];

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
  code: '',
  name: '',
  description: '',
  maxCapacity: '1',
  mapX: '',
  mapY: '',
  categoryCode: 'LITERATURE',
  note: '',
  active: true,
};

const requestStatusLabel: Record<BoothRequest['status'], string> = {
  PENDING: 'Chờ duyệt',
  SELECTED: 'Đã chọn / Giữ chỗ',
  COMPLETED: 'Đã hoàn tất',
  PAYMENT_EXPIRED: 'Hết hạn giữ chỗ',
  NOT_SELECTED: 'Không được chọn',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
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
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export const Sprint2BoothWorkspace: React.FC<Props> = ({ events, selectedEventId }) => {
  const [tab, setTab] = useState<'map' | 'requests' | 'configuration'>('map');
  const [physicalBooths, setPhysicalBooths] = useState<PhysicalBooth[]>([]);
  const [eventBooths, setEventBooths] = useState<EventBooth[]>([]);
  const [requests, setRequests] = useState<BoothRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyKey, setBusyKey] = useState('');

  // Map & Popover States
  const [draftCoords, setDraftCoords] = useState<Record<number, { x: number; y: number }>>({});
  const [activePopover, setActivePopover] = useState<PopoverBoothData | null>(null);
  const [isSavingAllMap, setIsSavingAllMap] = useState(false);
  const [customMapUrl, setCustomMapUrl] = useState<string | undefined>(undefined);

  // Add / Edit Booth Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [boothForm, setBoothForm] = useState<BoothFormState>({ ...EMPTY_FORM });

  // Request Filter & Reject Modal
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'SELECTED' | 'OTHER'>('ALL');
  const [rejectingRequest, setRejectingRequest] = useState<BoothRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  useModalDismiss(showAddModal, () => { if (busyKey !== 'create-booth') setShowAddModal(false); });
  useModalDismiss(Boolean(rejectingRequest), () => setRejectingRequest(null));

  const eventId = selectedEventId !== 'all' ? selectedEventId : events[0]?.id || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const physicalList = await boothApi.listAllPhysicalBooths();
      setPhysicalBooths(physicalList);

      if (eventId) {
        const [configurations, eventRequests] = await Promise.all([
          boothApi.listEventBoothConfigurations(eventId),
          boothApi.listAllOrganizerRequests(eventId),
        ]);
        const configurationByBoothId = new Map(
          configurations.map(configuration => [configuration.booth.boothId, configuration]),
        );
        setEventBooths(physicalList.map(booth => configurationByBoothId.get(booth.boothId) || {
          eventBoothConfigId: null,
          eventId: Number(eventId),
          booth,
          rentalPrice: null,
          enabled: false,
          availability: 'AVAILABLE' as const,
        }));
        setRequests(eventRequests);
      } else {
        setEventBooths(physicalList.map(booth => ({
          eventBoothConfigId: null,
          eventId: 0,
          booth,
          rentalPrice: null,
          enabled: booth.active,
          availability: booth.active ? 'AVAILABLE' : 'UNAVAILABLE',
        })));
        setRequests([]);
      }
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

  // Auto-dismiss success message
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  const configurationByBooth = useMemo(
    () => new Map(eventBooths.map(row => [row.booth.boothId, row])),
    [eventBooths],
  );

  // Map request partner names by boothId
  const partnerByBoothId = useMemo(() => {
    const map = new Map<number, string>();
    requests.forEach(req => {
      if (req.status === 'SELECTED' || req.status === 'COMPLETED' || req.status === 'PENDING') {
        map.set(req.boothId, req.partnerOrganizationName);
      }
    });
    return map;
  }, [requests]);

  // Markers for BoothMapCanvas
  const markers = useMemo<BoothMapMarker[]>(() => {
    return physicalBooths.flatMap(booth => {
      const configured = configurationByBooth.get(booth.boothId);
      const draft = draftCoords[booth.boothId];

      const x = draft ? draft.x : booth.mapX;
      const y = draft ? draft.y : booth.mapY;

      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
        return [];
      }

      let status: 'AVAILABLE' | 'ASSIGNED' | 'ON_HOLD' | 'UNAVAILABLE' = 'AVAILABLE';
      if (!booth.active) {
        status = 'UNAVAILABLE';
      } else if (configured) {
        status = configured.availability;
      }

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
  }, [physicalBooths, configurationByBooth, draftCoords]);

  // Update marker position on drag
  const handlePositionChange = (markerId: string, newX: number, newY: number) => {
    const boothId = Number(markerId.replace('booth-', ''));
    if (isNaN(boothId)) return;

    setDraftCoords(prev => ({
      ...prev,
      [boothId]: { x: newX, y: newY },
    }));

    // If popover is open for this booth, keep popover coordinates synchronized
    if (activePopover && activePopover.boothId === boothId) {
      setActivePopover(prev => prev ? { ...prev, x: newX, y: newY } : null);
    }
  };

  // Open Popover when a marker is clicked
  const handleOpenPopover = (marker: BoothMapMarker) => {
    const booth = physicalBooths.find(b => b.boothId === marker.boothId);
    const configured = configurationByBooth.get(marker.boothId);
    const partnerName = partnerByBoothId.get(marker.boothId) || '';

    const draft = draftCoords[marker.boothId];
    const currentX = draft ? draft.x : marker.x;
    const currentY = draft ? draft.y : marker.y;

    setActivePopover({
      boothId: marker.boothId,
      code: marker.code,
      name: booth?.name || marker.name,
      status: (configured?.availability || (booth?.active ? 'AVAILABLE' : 'UNAVAILABLE')) as any,
      partnerName,
      x: currentX,
      y: currentY,
    });
  };

  // Save Popover form changes (name, status, partner)
  const handleSavePopover = async (data: PopoverBoothData) => {
    setError('');
    setSuccess('');
    try {
      const updatePayload: UpdatePhysicalBoothInput = {
        code: data.code,
        name: data.name,
        mapX: data.x,
        mapY: data.y,
        active: data.status !== 'UNAVAILABLE',
      };
      await boothApi.updatePhysicalBooth(data.boothId, updatePayload);

      // If event configuration exists, update event availability/status
      if (eventId && data.status) {
        const existingConfig = configurationByBooth.get(data.boothId);
        await boothApi.configureEventBooth(
          eventId,
          data.boothId,
          existingConfig?.rentalPrice ?? 2000000,
          data.status !== 'UNAVAILABLE',
        );
      }

      setSuccess(`Đã đồng bộ thông tin gian hàng "${data.code}" thành công.`);
      setActivePopover(null);
      await loadData();
    } catch (err) {
      setError(apiMessage(err));
    }
  };

  // Delete / Deactivate Booth
  const handleDeleteBooth = async (boothId: number) => {
    const booth = physicalBooths.find(b => b.boothId === boothId);
    if (!window.confirm(`Bạn có chắc chắn muốn xóa/tạm ngưng gian hàng "${booth?.code || boothId}" khỏi sơ đồ?`)) return;

    setError('');
    try {
      await boothApi.updatePhysicalBooth(boothId, { active: false });
      setSuccess(`Đã tạm ngưng gian hàng "${booth?.code || boothId}".`);
      setActivePopover(null);
      await loadData();
    } catch (err) {
      setError(apiMessage(err));
    }
  };

  // Save all changed map coordinates to backend
  const handleSaveAllMap = async () => {
    const changedBoothIds = Object.keys(draftCoords).map(Number);
    if (changedBoothIds.length === 0) {
      setSuccess('Tất cả vị trí gian hàng đã đồng bộ.');
      return;
    }

    setIsSavingAllMap(true);
    setError('');
    setSuccess('');
    try {
      await Promise.all(
        changedBoothIds.map(boothId => {
          const coords = draftCoords[boothId];
          return boothApi.updatePhysicalBooth(boothId, {
            mapX: coords.x,
            mapY: coords.y,
          });
        }),
      );
      setDraftCoords({});
      setSuccess(`Đã lưu thành công tọa độ ${changedBoothIds.length} gian hàng lên sơ đồ.`);
      await loadData();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setIsSavingAllMap(false);
    }
  };

  // Upload custom map image
  const handleUploadMapImage = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setCustomMapUrl(objectUrl);
    setSuccess(`Đã tải lên sơ đồ mới: ${file.name}`);
  };

  // Create new booth submit
  const handleCreateNewBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = boothForm.code.trim().toUpperCase();
    const name = boothForm.name.trim();

    if (!code || !name) {
      setError('Vui lòng nhập đầy đủ mã và tên gian hàng.');
      return;
    }

    const mapX = boothForm.mapX === '' ? 50 : Number(boothForm.mapX);
    const mapY = boothForm.mapY === '' ? 50 : Number(boothForm.mapY);

    setBusyKey('create-booth');
    try {
      const createInput: CreatePhysicalBoothInput = {
        code,
        name,
        description: boothForm.description.trim() || null,
        maxCapacity: 1,
        mapX: isNaN(mapX) ? 50 : mapX,
        mapY: isNaN(mapY) ? 50 : mapY,
        categoryCode: boothForm.categoryCode || 'LITERATURE',
        note: boothForm.note.trim() || null,
      };
      await boothApi.createPhysicalBooth(createInput);
      setSuccess(`Đã tạo gian hàng "${code}" và định vị trên bản đồ.`);
      setShowAddModal(false);
      setBoothForm({ ...EMPTY_FORM });
      await loadData();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusyKey('');
    }
  };

  // Approval flow: Select / Approve partner request
  const handleSelectRequest = async (request: BoothRequest) => {
    if (!eventId || !window.confirm(`Duyệt và cấp giữ chỗ cho đối tác "${request.partnerOrganizationName}" tại gian "${request.boothCode}"?`)) return;
    setBusyKey(`request-${request.boothRequestId}`);
    setError('');
    try {
      await boothApi.selectRequest(eventId, request.boothRequestId);
      setSuccess(`Đã duyệt chọn gian "${request.boothCode}" cho "${request.partnerOrganizationName}".`);
      await loadData();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusyKey('');
    }
  };

  // Approval flow: Reject partner request
  const handleRejectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !rejectingRequest || !reviewNote.trim()) return;
    setBusyKey(`request-${rejectingRequest.boothRequestId}`);
    try {
      await boothApi.rejectRequest(eventId, rejectingRequest.boothRequestId, reviewNote.trim());
      setRejectingRequest(null);
      setReviewNote('');
      setSuccess('Đã từ chối yêu cầu thuê gian hàng.');
      await loadData();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusyKey('');
    }
  };

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'PENDING'), [requests]);
  const selectedRequests = useMemo(() => requests.filter(r => r.status === 'SELECTED' || r.status === 'COMPLETED'), [requests]);
  const otherRequests = useMemo(() => requests.filter(r => r.status !== 'PENDING' && r.status !== 'SELECTED' && r.status !== 'COMPLETED'), [requests]);

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'PENDING') return pendingRequests;
    if (requestFilter === 'SELECTED') return selectedRequests;
    if (requestFilter === 'OTHER') return otherRequests;
    return requests;
  }, [requests, requestFilter, pendingRequests, selectedRequests, otherRequests]);

  return (
    <section className="s2-booth-page" aria-labelledby="organizer-booth-title">
      {/* 1. HEADER SECTION (MATCHING SCREENSHOT 1) */}
      <header className="s2-booth-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 id="organizer-booth-title" className="organizer-view-title" style={{ fontSize: '1.75rem' }}>
            Sơ đồ & Quản lý vị trí gian hàng
          </h1>
          <p className="organizer-view-sub" style={{ marginTop: '0.35rem', fontSize: '0.92rem' }}>
            Kéo thả để cập nhật vị trí tọa độ, chỉnh sửa thông tin hoặc thêm/xóa gian hàng. Dữ liệu sẽ đồng bộ tức thì lên Landing Page và Portal Gian hàng.
          </p>
        </div>

        <button
          type="button"
          className="btn-org-primary"
          onClick={() => {
            setBoothForm({ ...EMPTY_FORM });
            setShowAddModal(true);
          }}
          style={{ padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}
        >
          <span>+ Thêm gian hàng</span>
        </button>
      </header>

      {error && <div className="s2-alert s2-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
      {success && <div className="s2-alert s2-alert-success" role="status"><Check size={18} />{success}</div>}

      {/* 2. WORKSPACE TABS */}
      <nav className="s2-tabs" aria-label="Điều hướng sơ đồ và yêu cầu">
        <button
          type="button"
          className={tab === 'map' ? 'is-active' : ''}
          onClick={() => setTab('map')}
        >
          <MapPin size={16} />
          <span>Sơ đồ bản đồ gian hàng</span>
          <span className="tab-count">{markers.length}</span>
        </button>

        <button
          type="button"
          className={tab === 'requests' ? 'is-active' : ''}
          onClick={() => setTab('requests')}
        >
          <Clock3 size={16} />
          <span>Duyệt yêu cầu thuê gian hàng</span>
          <span className={`tab-count ${pendingRequests.length > 0 ? 'tab-count-alert' : ''}`}>
            {pendingRequests.length > 0 ? pendingRequests.length : requests.length}
          </span>
        </button>

        <button
          type="button"
          className={tab === 'configuration' ? 'is-active' : ''}
          onClick={() => setTab('configuration')}
        >
          <DollarSign size={16} />
          <span>Cấu hình sự kiện & Giá</span>
          <span className="tab-count">{eventBooths.filter(r => r.enabled).length}</span>
        </button>
      </nav>

      {loading ? (
        <div className="s2-loading"><Loader2 className="s2-spin" size={26} />Đang tải sơ đồ gian hàng...</div>
      ) : (
        <>
          {/* TAB 1: SƠ ĐỒ & BẢN ĐỒ GIAN HÀNG (FULL WIDTH INTERACTIVE MAP CANVAS) */}
          {tab === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <BoothMapCanvas
                markers={markers}
                activePopoverData={activePopover}
                onOpenPopover={handleOpenPopover}
                onClosePopover={() => setActivePopover(null)}
                onSavePopover={handleSavePopover}
                onDeleteBooth={handleDeleteBooth}
                onPositionChange={handlePositionChange}
                onSaveAllMap={handleSaveAllMap}
                onUploadMapImage={handleUploadMapImage}
                isSavingAll={isSavingAllMap}
                hasUnsavedChanges={Object.keys(draftCoords).length > 0}
                editable={true}
                customMapUrl={customMapUrl}
                ariaLabel="Sơ đồ mặt bằng Đường Sách tương tác"
                emptyMessage="Chưa có gian hàng nào trên bản đồ. Nhấn '+ Thêm gian hàng' để tạo gian mới."
              />
            </div>
          )}

          {/* TAB 2: LUỒNG DUYỆT YÊU CẦU THUÊ GIAN HÀNG (APPROVAL FLOW) */}
          {tab === 'requests' && (
            <div className="s2-panel">
              <div className="s2-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Duyệt yêu cầu thuê gian hàng từ đối tác</h2>
                </div>
                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={() => void loadData()}
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
                  <span>Làm mới danh sách</span>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="s2-filter-tabs">
                <button
                  type="button"
                  className={`s2-filter-tab ${requestFilter === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setRequestFilter('ALL')}
                >
                  Tất cả ({requests.length})
                </button>
                <button
                  type="button"
                  className={`s2-filter-tab ${requestFilter === 'PENDING' ? 'is-active' : ''}`}
                  onClick={() => setRequestFilter('PENDING')}
                >
                  Chờ duyệt ({pendingRequests.length})
                </button>
                <button
                  type="button"
                  className={`s2-filter-tab ${requestFilter === 'SELECTED' ? 'is-active' : ''}`}
                  onClick={() => setRequestFilter('SELECTED')}
                >
                  Đã cấp giữ chỗ ({selectedRequests.length})
                </button>
                <button
                  type="button"
                  className={`s2-filter-tab ${requestFilter === 'OTHER' ? 'is-active' : ''}`}
                  onClick={() => setRequestFilter('OTHER')}
                >
                  Đã từ chối / Đã rút ({otherRequests.length})
                </button>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="s2-empty">
                  <Store size={36} />
                  <p>Không có yêu cầu thuê gian hàng nào trong danh mục này.</p>
                </div>
              ) : (
                <div className="s2-request-list">
                  {filteredRequests.map(req => (
                    <div className={`s2-request-card ${req.status === 'PENDING' ? 'is-pending' : ''}`} key={req.boothRequestId}>
                      <div className="s2-request-header">
                        <div className="s2-request-title-area">
                          <div className="s2-request-title-row">
                            <span className={`s2-status request-${req.status.toLowerCase()}`}>
                              {requestStatusLabel[req.status] || req.status}
                            </span>
                            <span className="s2-request-partner-name">{req.partnerOrganizationName}</span>
                            <span className="s2-request-booth-tag">Gian {req.boothCode}</span>
                          </div>
                          <div className="s2-request-meta">
                            <Clock3 size={13} />
                            <span>Nộp lúc: {dateTime(req.submittedAt)}</span>
                          </div>
                        </div>

                        {req.status === 'PENDING' && (
                          <div className="s2-request-actions">
                            <button
                              type="button"
                              className="btn-request-reject"
                              onClick={() => {
                                setRejectingRequest(req);
                                setReviewNote('');
                              }}
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              className="btn-request-approve"
                              onClick={() => handleSelectRequest(req)}
                              disabled={busyKey === `request-${req.boothRequestId}`}
                            >
                              <Check size={15} />
                              <span>Duyệt & Cấp giữ chỗ</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {req.hold && (
                        <div className="s2-hold-card" style={{ marginTop: '0.4rem' }}>
                          <div className="s2-hold-summary">
                            <div className="s2-hold-summary-main">
                              <span className="s2-hold-price-label">Giá giữ chỗ:</span>
                              <strong className="s2-hold-price-val">{money(req.hold.lockedRentalPrice)}</strong>
                              <span className={`s2-hold-status-badge status-${req.hold.status.toLowerCase()}`}>
                                Trạng thái: {req.hold.status}
                              </span>
                            </div>
                            <div className="s2-hold-meta-row">
                              <span className="s2-hold-meta-point">
                                <Clock3 size={13} />
                                <span>Tạo: {dateTime(req.hold.createdAt)}</span>
                              </span>
                              <span className="s2-hold-meta-point highlight">
                                <Clock3 size={13} />
                                <span>Hạn thanh toán: {dateTime(req.hold.expiresAt)}</span>
                              </span>
                              {req.hold.releasedAt && (
                                <span className="s2-hold-meta-point">
                                  <span>Giải phóng: {dateTime(req.hold.releasedAt)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {req.requestNote && (
                        <div className="s2-request-note-box">
                          <div className="s2-note-header">
                            <MessageSquare size={14} />
                            <strong>Ghi chú đăng ký:</strong>
                          </div>
                          <div className="s2-note-text">{req.requestNote}</div>
                        </div>
                      )}

                      {req.reviewNote && (
                        <div className="s2-request-review-box">
                          <div className="s2-review-header">
                            <ShieldCheck size={14} />
                            <strong>Phản hồi từ BQL:</strong>
                          </div>
                          <div className="s2-review-text">{req.reviewNote}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CẤU HÌNH SỰ KIỆN & GIÁ */}
          {tab === 'configuration' && (
            <div className="s2-panel">
              <div className="s2-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Cấu hình gian hàng & Giá sự kiện</h2>
                  <p>Thiết lập giá thuê và trạng thái mở đăng ký cho từng gian hàng trong sự kiện.</p>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
                  Đã mở: <strong style={{ color: '#0F6B41' }}>{eventBooths.filter(r => r.enabled).length}</strong> / {eventBooths.length} gian hàng
                </div>
              </div>

              <div className="s2-config-list">
                {eventBooths.map(row => (
                  <div className="s2-config-row" key={row.booth.boothId}>
                    <div className="s2-config-identity">
                      <div className="s2-booth-badge">{row.booth.code}</div>
                      <div className="s2-config-info">
                        <h3>{row.booth.name}</h3>
                        <p>{row.booth.categoryCode || 'Chưa phân loại'}</p>
                      </div>
                    </div>

                    <div className="s2-config-status">
                      <span className={`s2-status ${row.availability.toLowerCase()}`}>
                        {row.availability === 'AVAILABLE' ? 'Còn trống' : row.availability === 'ASSIGNED' ? 'Đã thuê' : row.availability === 'ON_HOLD' ? 'Chờ duyệt' : 'Tạm khóa'}
                      </span>
                    </div>

                    <div className="s2-config-price">
                      <label>Giá thuê (VNĐ)</label>
                      <div className="s2-price-input-wrapper">
                        <input
                          type="number"
                          min="0"
                          step="100000"
                          defaultValue={row.rentalPrice ?? ''}
                          placeholder="2,000,000"
                          onBlur={async e => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val >= 0 && eventId) {
                              await boothApi.configureEventBooth(eventId, row.booth.boothId, val, row.enabled);
                              setSuccess(`Đã cập nhật giá thuê cho ${row.booth.code}.`);
                            }
                          }}
                        />
                        <span className="s2-price-currency">₫</span>
                      </div>
                    </div>

                    <label className="s2-switch-wrapper">
                      <div className="s2-switch">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={async e => {
                            if (eventId) {
                              await boothApi.configureEventBooth(eventId, row.booth.boothId, row.rentalPrice ?? 2000000, e.target.checked);
                              setSuccess(`Đã ${e.target.checked ? 'mở' : 'tắt'} gian hàng ${row.booth.code}.`);
                              await loadData();
                            }
                          }}
                        />
                        <span className="s2-slider"></span>
                      </div>
                      <span className="s2-switch-label">{row.enabled ? 'Mở đăng ký' : 'Tạm khóa'}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. MODAL THÊM GIAN HÀNG MỚI */}
      {showAddModal && (
        <div className="booth-modal-backdrop" onClick={() => busyKey !== 'create-booth' && setShowAddModal(false)}>
          <div className="booth-modal-box" onClick={e => e.stopPropagation()}>
            <div className="booth-modal-header">
              <h2>Thêm gian hàng mới vào sơ đồ</h2>
              <button
                type="button"
                className="booth-modal-close-btn"
                onClick={() => busyKey !== 'create-booth' && setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateNewBooth} className="booth-form-grid">
              {/* Booth Code */}
              <div className="booth-form-group">
                <label>
                  Mã gian hàng <span className="required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: A01, B02, C10"
                  value={boothForm.code}
                  onChange={e => setBoothForm({ ...boothForm, code: e.target.value.toUpperCase() })}
                  disabled={busyKey === 'create-booth'}
                  required
                />
              </div>

              {/* Category */}
              <div className="booth-form-group">
                <label>
                  Thể loại / Chuyên mục <span className="required">*</span>
                </label>
                <select
                  value={boothForm.categoryCode}
                  onChange={e => setBoothForm({ ...boothForm, categoryCode: e.target.value })}
                  disabled={busyKey === 'create-booth'}
                  required
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat.code} value={cat.code}>
                      {cat.labelVi}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booth Name */}
              <div className="booth-form-group full-width">
                <label>
                  Tên gian hàng <span className="required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Gian Hàng A01 - Sách Thiếu Nhi & Truyện Tranh"
                  value={boothForm.name}
                  onChange={e => setBoothForm({ ...boothForm, name: e.target.value })}
                  disabled={busyKey === 'create-booth'}
                  required
                />
              </div>

              {/* Description */}
              <div className="booth-form-group full-width">
                <label>Mô tả vị trí & không gian</label>
                <textarea
                  placeholder="Mô tả diện tích gian, lối đi, mái che, khu vực xung quanh..."
                  value={boothForm.description}
                  onChange={e => setBoothForm({ ...boothForm, description: e.target.value })}
                  disabled={busyKey === 'create-booth'}
                  rows={3}
                />
              </div>

              {/* Technical Note */}
              <div className="booth-form-group full-width">
                <label>Ghi chú kỹ thuật & trang thiết bị</label>
                <textarea
                  placeholder="Ví dụ: Cung cấp sẵn 2 bàn trưng bày, ổ cắm điện 220V, wifi công suất cao..."
                  value={boothForm.note}
                  onChange={e => setBoothForm({ ...boothForm, note: e.target.value })}
                  disabled={busyKey === 'create-booth'}
                  rows={2}
                />
              </div>

              {/* Form Footer */}
              <div className="booth-modal-footer full-width" style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={busyKey === 'create-booth'}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  disabled={busyKey === 'create-booth'}
                >
                  {busyKey === 'create-booth' ? (
                    <>
                      <Loader2 size={16} className="s2-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Thêm gian hàng</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL TỪ CHỐI YÊU CẦU */}
      {rejectingRequest && (
        <div className="s2-modal-backdrop" onClick={() => setRejectingRequest(null)}>
          <div className="s2-modal s2-modal-small" onClick={e => e.stopPropagation()}>
            <div className="s2-modal-header">
              <h2>Từ chối yêu cầu thuê gian hàng</h2>
              <button type="button" onClick={() => setRejectingRequest(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRejectRequest} className="s2-stack-form">
              <p>Bạn sắp từ chối yêu cầu của <strong>{rejectingRequest.partnerOrganizationName}</strong> cho gian <strong>{rejectingRequest.boothCode}</strong>.</p>
              <label>
                Lý do từ chối *
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Nhập lý do từ chối để gửi thông báo cho đối tác..."
                  required
                />
              </label>
              <div className="s2-modal-actions">
                <button type="button" className="btn-org-secondary" onClick={() => setRejectingRequest(null)}>Hủy</button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  style={{ background: '#991B1B' }}
                  disabled={busyKey.startsWith('request-') || !reviewNote.trim()}
                >
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
