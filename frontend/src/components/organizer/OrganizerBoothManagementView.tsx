import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import { useListPagination } from '../../hooks/useListPagination';
import { CompactPagination } from '../ui/CompactPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import { ImageUrlField } from '../ui/ImageUrlField';
import {
  AlertCircle,
  Check,
  Edit3,
  Eye,
  Grid,
  List,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import { organizerApi } from '../../services/organizerApi';
import type { Language } from '../../types';
import type { OrganizerLocationResponse } from '../../types/activity';
import type { CreatePhysicalBoothInput, PhysicalBooth, UpdatePhysicalBoothInput } from '../../types/booth';
import { BoothMapCanvas, type MapPopoverData } from '../booth-map/BoothMapCanvas';
import type { BoothMapMarker } from '../booth-map/boothMapModel';
import './OrganizerBoothManagementView.css';

interface Props {
  language: Language;
  onOpenRequests?: () => void;
}

interface BoothFormData {
  code: string;
  name: string;
  categoryCode: string;
  mapX: string;
  mapY: string;
  description: string;
  note: string;
  imageUrl: string;
  active: boolean;
}

const CATEGORY_OPTIONS: Array<{ code: string; labelVi: string; labelEn: string }> = [
  { code: 'MANGA_COMICS', labelVi: 'Truyện tranh & Manga', labelEn: 'Manga & Comics' },
  { code: 'LITERATURE', labelVi: 'Văn học & Nghệ thuật', labelEn: 'Literature & Art' },
  { code: 'TECHNOLOGY_SCIENCE', labelVi: 'Công nghệ & Khởi nghiệp', labelEn: 'Tech & Innovation' },
  { code: 'CHILDREN', labelVi: 'Sách Thiếu nhi', labelEn: 'Children Books' },
  { code: 'ART_CULTURE', labelVi: 'Nghệ thuật & Văn hóa', labelEn: 'Art & Culture' },
  { code: 'HISTORY_SOCIETY', labelVi: 'Lịch sử & Xã hội', labelEn: 'History & Society' },
  { code: 'EDUCATION', labelVi: 'Giáo dục & Kỹ năng', labelEn: 'Education & Skills' },
  { code: 'OTHER', labelVi: 'Gian hàng tổng hợp', labelEn: 'General / Other' },
];

const INITIAL_FORM: BoothFormData = {
  code: '',
  name: '',
  categoryCode: 'LITERATURE',
  mapX: '50',
  mapY: '50',
  description: '',
  note: '',
  imageUrl: '',
  active: true,
};

const LOCATION_TYPE_LABELS = {
  STAGE: 'Sân khấu',
  WORKSHOP: 'Phòng workshop',
  AREA: 'Khu vực',
} as const;

function getCategoryLabel(categoryCode: string | null | undefined, language: Language): string {
  if (!categoryCode) return language === 'vi' ? 'Chưa phân loại' : 'Uncategorized';
  const found = CATEGORY_OPTIONS.find(c => c.code === categoryCode);
  if (found) return language === 'vi' ? found.labelVi : found.labelEn;
  return categoryCode;
}

export const OrganizerBoothManagementView: React.FC<Props> = ({
  language,
}) => {
  const [mapSearchParams] = useSearchParams();
  const targetLocationId = Number(mapSearchParams.get('locationId')) || null;
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const [booths, setBooths] = useState<PhysicalBooth[]>([]);
  const [locations, setLocations] = useState<OrganizerLocationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyBoothId, setBusyBoothId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  // Filter & Search States
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  // View Modes: activeMode ('list' | 'map') and listLayout ('table' | 'grid')
  const [activeMode, setActiveMode] = useState<'list' | 'map'>(() => mapSearchParams.get('view') === 'map' ? 'map' : 'list');
  const [listLayout, setListLayout] = useState<'table' | 'grid'>('table');

  // Physical map state. Event availability and pricing deliberately do not live here.
  const [draftCoords, setDraftCoords] = useState<Record<number, { x: number; y: number }>>({});
  const [locationDraftCoords, setLocationDraftCoords] = useState<Record<number, { x: number; y: number }>>({});
  const [activePopover, setActivePopover] = useState<MapPopoverData | null>(null);
  const [isSavingMap, setIsSavingMap] = useState(false);
  const [newlyCreatedBoothId, setNewlyCreatedBoothId] = useState<number | null>(null);
  const [customMapUrl, setCustomMapUrl] = useState<string | undefined>();

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBooth, setEditingBooth] = useState<PhysicalBooth | null>(null);
  const [formData, setFormData] = useState<BoothFormData>(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const temporaryImageUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const deleteUploadedImageQuietly = useCallback(async (imageUrl: string | null) => {
    if (!imageUrl) return;
    try {
      await boothApi.deleteUploadedBoothImage(imageUrl);
    } catch (error) {
      console.warn('Could not clean up an unused booth image', error);
    }
  }, []);

  const closeFormModal = useCallback(() => {
    if (formSubmitting || imageUploading) return;
    const temporaryImageUrl = temporaryImageUrlRef.current;
    temporaryImageUrlRef.current = null;
    setIsFormModalOpen(false);
    void deleteUploadedImageQuietly(temporaryImageUrl);
  }, [deleteUploadedImageQuietly, formSubmitting, imageUploading]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const temporaryImageUrl = temporaryImageUrlRef.current;
      temporaryImageUrlRef.current = null;
      void deleteUploadedImageQuietly(temporaryImageUrl);
    };
  }, [deleteUploadedImageQuietly]);

  // Detail Modal
  const [viewingBooth, setViewingBooth] = useState<PhysicalBooth | null>(null);
  useModalDismiss(isFormModalOpen, closeFormModal);
  useModalDismiss(Boolean(viewingBooth), () => setViewingBooth(null));
  const formBackdropHandlers = useBackdropClick(closeFormModal);
  const detailBackdropHandlers = useBackdropClick(() => setViewingBooth(null));

  const loadBoothData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    setLoadError('');
    setAccessDenied(false);
    try {
      const [physicalBooths, locationPage] = await Promise.all([
        boothApi.listAllPhysicalBooths(),
        organizerApi.listActivityLocations({ page: 0, size: 100, sort: 'code,asc' }),
      ]);
      const remainingPages = await Promise.all(Array.from({ length: Math.max(0, locationPage.totalPages - 1) }, (_, index) =>
        organizerApi.listActivityLocations({ page: index + 1, size: 100, sort: 'code,asc' })));
      const allLocations = [locationPage, ...remainingPages].flatMap(result => result.content);
      setBooths(physicalBooths);
      setLocations(allLocations);
      setDraftCoords({});
      const target = allLocations.find(location => location.locationId === targetLocationId);
      setLocationDraftCoords(target && (target.mapX === null || target.mapY === null)
        ? { [target.locationId]: { x: 50, y: 50 } } : {});
      setActivePopover(null);
    } catch (err) {
      console.warn('Could not load booth catalog data', err);
      setAccessDenied(err instanceof ApiError && err.status === 403);
      setLoadError(err instanceof Error ? err.message : 'Không thể tải danh sách gian hàng.');
    } finally {
      setLoading(false);
    }
  }, [targetLocationId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This effect starts the catalog's initial guarded remote-data load.
    void loadBoothData();
  }, [loadBoothData]);

  useEffect(() => {
    if (!loading && activeMode === 'map' && (targetLocationId || newlyCreatedBoothId)) {
      mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, targetLocationId, newlyCreatedBoothId, activeMode]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // KPIs
  const totalBoothsCount = booths.length;
  const activeBoothsCount = booths.filter(b => b.active).length;
  const inactiveBoothsCount = totalBoothsCount - activeBoothsCount;

  // Filtered List
  const filteredBooths = useMemo(() => {
    return booths.filter(booth => {
      const matchesSearch =
        booth.code.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
        booth.name.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
        (booth.description && booth.description.toLowerCase().includes(searchKeyword.toLowerCase().trim())) ||
        (booth.note && booth.note.toLowerCase().includes(searchKeyword.toLowerCase().trim()));

      const matchesStatus =
        filterStatus === 'all' ? true : filterStatus === 'active' ? booth.active : !booth.active;

      return matchesSearch && matchesStatus;
    });
  }, [booths, searchKeyword, filterStatus]);
  const pagination = useListPagination(filteredBooths);

  const mapMarkers = useMemo<BoothMapMarker[]>(() => {
    const boothMarkers: BoothMapMarker[] = booths.flatMap(booth => {
      const draft = draftCoords[booth.boothId];
      const x = draft?.x ?? booth.mapX;
      const y = draft?.y ?? booth.mapY;
      if (
        x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)
        || x < 0 || x > 100 || y < 0 || y > 100
      ) return [];
      return [{
        id: `booth-${booth.boothId}`,
        boothId: booth.boothId,
        code: booth.code,
        name: booth.name,
        x,
        y,
        status: booth.active ? 'PHYSICAL' : 'PHYSICAL_INACTIVE',
        kind: 'BOOTH',
      }];
    });
    const locationMarkers: BoothMapMarker[] = locations.flatMap(location => {
      const draft = locationDraftCoords[location.locationId];
      const x = draft?.x ?? location.mapX;
      const y = draft?.y ?? location.mapY;
      if (
        x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)
        || x < 0 || x > 100 || y < 0 || y > 100
      ) return [];
      return [{
        id: `location-${location.locationId}`,
        boothId: -location.locationId,
        locationId: location.locationId,
        code: location.code,
        name: location.name,
        x,
        y,
        status: location.active ? 'PHYSICAL' as const : 'PHYSICAL_INACTIVE' as const,
        kind: location.locationType,
      }];
    });
    return [...boothMarkers, ...locationMarkers];
  }, [booths, draftCoords, locationDraftCoords, locations]);

  const handleSwitchToListView = () => {
    if (activeMode === 'list') return;
    const hasUnsavedChanges = Object.keys(draftCoords).length > 0
      || Object.keys(locationDraftCoords).length > 0;
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        language === 'vi'
          ? 'Bạn có thay đổi tọa độ sơ đồ chưa được lưu. Bạn có chắc chắn muốn quay về danh sách? (Dữ liệu chưa lưu vẫn được giữ tạm thời)'
          : 'You have unsaved coordinate changes on the map. Switch to List view anyway?'
      );
      if (!confirmLeave) return;
    }
    setActiveMode('list');
  };

  const handleSwitchToMapView = () => {
    if (activeMode === 'map') return;
    setActiveMode('map');
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    temporaryImageUrlRef.current = null;
    setEditingBooth(null);
    setFormData(INITIAL_FORM);
    setErrorMessage('');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (booth: PhysicalBooth) => {
    temporaryImageUrlRef.current = null;
    setEditingBooth(booth);
    setFormData({
      code: booth.code,
      name: booth.name,
      categoryCode: booth.categoryCode || 'LITERATURE',
      mapX: booth.mapX !== null && booth.mapX !== undefined ? String(booth.mapX) : '',
      mapY: booth.mapY !== null && booth.mapY !== undefined ? String(booth.mapY) : '',
      description: booth.description || '',
      note: booth.note || '',
      imageUrl: booth.imageUrl || '',
      active: booth.active,
    });
    setErrorMessage('');
    setIsFormModalOpen(true);
  };

  const handleBoothImageUpload = async (file: File): Promise<string> => {
    setErrorMessage('');
    const imageUrl = await boothApi.uploadBoothImage(file);
    if (!mountedRef.current) {
      void deleteUploadedImageQuietly(imageUrl);
      return imageUrl;
    }
    const previousTemporaryImageUrl = temporaryImageUrlRef.current;
    temporaryImageUrlRef.current = imageUrl;
    void deleteUploadedImageQuietly(previousTemporaryImageUrl);
    return imageUrl;
  };

  const handleRemoveBoothImage = () => {
    const temporaryImageUrl = temporaryImageUrlRef.current;
    temporaryImageUrlRef.current = null;
    setFormData(current => ({ ...current, imageUrl: '' }));
    void deleteUploadedImageQuietly(temporaryImageUrl);
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSubmitting || imageUploading) return;
    setErrorMessage('');

    const trimmedCode = formData.code.trim().toUpperCase();
    const trimmedName = formData.name.trim();

    if (!trimmedCode) {
      setErrorMessage('Vui lòng nhập mã gian hàng (ví dụ: A01, B02).');
      return;
    }
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập tên gian hàng.');
      return;
    }

    const mapXVal = formData.mapX.trim() ? Number(formData.mapX) : null;
    const mapYVal = formData.mapY.trim() ? Number(formData.mapY) : null;

    if (mapXVal !== null && (!Number.isFinite(mapXVal) || mapXVal < 0 || mapXVal > 100)) {
      setErrorMessage('Tọa độ X phải nằm trong khoảng 0–100.');
      return;
    }
    if (mapYVal !== null && (!Number.isFinite(mapYVal) || mapYVal < 0 || mapYVal > 100)) {
      setErrorMessage('Tọa độ Y phải nằm trong khoảng 0–100.');
      return;
    }

    setFormSubmitting(true);
    let createdBooth: PhysicalBooth | null = null;
    try {
      if (editingBooth) {
        // UPDATE
        const updatePayload: UpdatePhysicalBoothInput = {
          name: trimmedName,
          categoryCode: formData.categoryCode,
          description: formData.description.trim() || null,
          note: formData.note.trim() || null,
          imageUrl: formData.imageUrl.trim() || null,
          maxCapacity: editingBooth.maxCapacity || 1,
          mapX: mapXVal,
          mapY: mapYVal,
          active: formData.active,
        };
        await boothApi.updatePhysicalBooth(editingBooth.boothId, updatePayload);
        setSuccessMessage(`Đã cập nhật thành công gian hàng "${editingBooth.code}".`);
      } else {
        // CREATE
        const createPayload: CreatePhysicalBoothInput = {
          code: trimmedCode,
          name: trimmedName,
          categoryCode: formData.categoryCode,
          description: formData.description.trim() || null,
          note: formData.note.trim() || null,
          imageUrl: formData.imageUrl.trim() || null,
          maxCapacity: 1,
          mapX: mapXVal ?? 50,
          mapY: mapYVal ?? 50,
        };
        const created = await boothApi.createPhysicalBooth(createPayload);
        createdBooth = created;
        setSuccessMessage(`Đã thêm mới thành công gian hàng "${createPayload.code}".`);
      }

      const nowPersistedImageUrl = temporaryImageUrlRef.current;
      temporaryImageUrlRef.current = null;
      const replacedImageUrl = editingBooth?.imageUrl
        && editingBooth.imageUrl !== formData.imageUrl.trim()
        ? editingBooth.imageUrl
        : null;
      setIsFormModalOpen(false);
      if (replacedImageUrl && replacedImageUrl !== nowPersistedImageUrl) {
        void deleteUploadedImageQuietly(replacedImageUrl);
      }
      await loadBoothData();

      if (createdBooth) {
        setActiveMode('map');
        setNewlyCreatedBoothId(createdBooth.boothId);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.fieldErrors.map(f => f.message).join(' ') || err.message);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Thao tác không thành công.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick Toggle Active Status
  const handleToggleActive = async (booth: PhysicalBooth) => {
    setBusyBoothId(booth.boothId);
    setErrorMessage('');
    try {
      const newActive = !booth.active;
      await boothApi.updatePhysicalBooth(booth.boothId, { active: newActive });
      setSuccessMessage(`Đã ${newActive ? 'kích hoạt mở' : 'tạm ngưng'} gian hàng "${booth.code}".`);
      setBooths(prev => prev.map(b => (b.boothId === booth.boothId ? { ...b, active: newActive } : b)));
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'BOOTH_HAS_ACTIVE_HOLD' || err.message.includes('Active Hold'))) {
        setErrorMessage(`Gian hàng "${booth.code}" đang có giữ chỗ/đăng ký của đối tác trong sự kiện nên không thể tạm ngưng.`);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái gian hàng.');
      }
    } finally {
      setBusyBoothId(null);
    }
  };

  const handleMapPositionChange = (markerId: string, x: number, y: number) => {
    if (markerId.startsWith('location-')) {
      const locationId = Number(markerId.replace('location-', ''));
      if (!Number.isFinite(locationId)) return;
      setLocationDraftCoords(current => ({ ...current, [locationId]: { x, y } }));
      setActivePopover(current => current?.markerId === markerId ? { ...current, x, y } : current);
      return;
    }
    const boothId = Number(markerId.replace('booth-', ''));
    if (!Number.isFinite(boothId)) return;
    setDraftCoords(current => ({ ...current, [boothId]: { x, y } }));
    setActivePopover(current => current?.markerId === markerId ? { ...current, x, y } : current);
  };

  const handleOpenMapPopover = (marker: BoothMapMarker) => {
    if (marker.locationId !== undefined) {
      const location = locations.find(item => item.locationId === marker.locationId);
      if (!location) return;
      setActivePopover({
        markerId: marker.id,
        resourceId: location.locationId,
        resourceType: 'location',
        code: location.code,
        name: location.name,
        status: location.active ? 'PHYSICAL' : 'PHYSICAL_INACTIVE',
        resourceLabel: LOCATION_TYPE_LABELS[location.locationType as keyof typeof LOCATION_TYPE_LABELS],
        x: marker.x,
        y: marker.y,
      });
      return;
    }
    const booth = booths.find(item => item.boothId === marker.boothId);
    if (!booth) return;
    setActivePopover({
      markerId: marker.id,
      resourceId: booth.boothId,
      resourceType: 'booth',
      code: booth.code,
      name: booth.name,
      status: booth.active ? 'PHYSICAL' : 'PHYSICAL_INACTIVE',
      resourceLabel: 'Gian hàng',
      x: marker.x,
      y: marker.y,
    });
  };

  const handleSaveMapPopover = async (data: MapPopoverData) => {
    setErrorMessage('');
    try {
      if (data.resourceType === 'location') {
        await organizerApi.updateActivityLocation(data.resourceId, {
          code: data.code,
          name: data.name,
          mapX: data.x,
          mapY: data.y,
        });
        setSuccessMessage(`Đã cập nhật địa điểm "${data.name}" trên sơ đồ.`);
      } else {
        await boothApi.updatePhysicalBooth(data.resourceId, {
          code: data.code,
          name: data.name,
          mapX: data.x,
          mapY: data.y,
        });
        setSuccessMessage(`Đã cập nhật thông tin vật lý của gian "${data.code}".`);
      }
      await loadBoothData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật không gian trên sơ đồ.');
    }
  };

  const handleSaveAllMap = async () => {
    const boothIds = Object.keys(draftCoords).map(Number);
    const locationIds = Object.keys(locationDraftCoords).map(Number);
    if (!boothIds.length && !locationIds.length) {
      setSuccessMessage('Tất cả vị trí trên sơ đồ đã được đồng bộ.');
      return;
    }
    setIsSavingMap(true);
    setErrorMessage('');
    try {
      await Promise.all([
        ...boothIds.map(boothId => boothApi.updatePhysicalBooth(boothId, {
          mapX: draftCoords[boothId].x,
          mapY: draftCoords[boothId].y,
        })),
        ...locationIds.map(locationId => organizerApi.updateActivityLocation(locationId, {
          mapX: locationDraftCoords[locationId].x,
          mapY: locationDraftCoords[locationId].y,
        })),
      ]);
      setSuccessMessage(
        locationIds.length > 0 && boothIds.length === 0
          ? `Đã lưu tọa độ của ${locationIds.length} địa điểm.`
          : `Đã lưu tọa độ của ${boothIds.length} vị trí.`
      );
      await loadBoothData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể lưu tọa độ sơ đồ.');
    } finally {
      setIsSavingMap(false);
    }
  };

  const handleUploadMapImage = (file: File) => {
    setCustomMapUrl(URL.createObjectURL(file));
    setSuccessMessage(`Đã tải bản đồ xem trước: ${file.name}`);
  };

  useEffect(() => () => {
    if (customMapUrl) URL.revokeObjectURL(customMapUrl);
  }, [customMapUrl]);

  return (
    <div className="booth-crud-page">
      {/* 1. HEADER SECTION */}
      <div className="booth-crud-header">
        <div className="booth-crud-title-group">
          <h1 className="workspace-page-title">{language === 'vi' ? 'Quản lý Gian hàng' : 'Booth Management Catalog'}</h1>
          <p className="workspace-page-subtitle">
            {language === 'vi'
              ? 'Quản lý danh mục và vị trí gian hàng tại Đường Sách.'
              : 'Manage booth catalog and physical locations across the Book Street.'}
          </p>

          {/* Mode Switcher: Danh sách gian hàng | Sơ đồ không gian */}
          <div className="booth-mode-switcher" aria-label={language === 'vi' ? 'Chế độ xem gian hàng' : 'Booth view modes'}>
            <button
              type="button"
              className={`booth-mode-btn ${activeMode === 'list' ? 'is-active' : ''}`}
              onClick={handleSwitchToListView}
              aria-pressed={activeMode === 'list'}
            >
              <Store size={16} />
              <span>{language === 'vi' ? 'Danh sách gian hàng' : 'Booth List'}</span>
            </button>
            <button
              type="button"
              className={`booth-mode-btn ${activeMode === 'map' ? 'is-active' : ''}`}
              onClick={handleSwitchToMapView}
              aria-label={language === 'vi' ? 'Sơ đồ Không gian Đường Sách' : 'Book Street Space Map'}
              aria-pressed={activeMode === 'map'}
            >
              <MapPin size={16} />
              <span>{language === 'vi' ? 'Sơ đồ gian hàng' : 'Booth Map'}</span>
            </button>
          </div>
        </div>

        <div className="booth-crud-header-actions">
          <button
            type="button"
            className="btn-org-primary booth-primary-cta"
            onClick={handleOpenCreateModal}
            disabled={loading || Boolean(loadError)}
          >
            <Plus size={16} />
            <span>{language === 'vi' ? 'Thêm gian hàng mới' : 'Add New Booth'}</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY KPI STATS (Clean, Anti-AI-Slop, No decorative icons) */}
      <div className="booth-kpi-grid">
        <div className="booth-kpi-card">
          <span className="booth-kpi-number">{loading || loadError ? '—' : totalBoothsCount}</span>
          <span className="booth-kpi-label">{language === 'vi' ? 'Tổng số gian hàng' : 'Total Booths'}</span>
        </div>

        <div className="booth-kpi-card">
          <span className="booth-kpi-number is-active">{loading || loadError ? '—' : activeBoothsCount}</span>
          <span className="booth-kpi-label">{language === 'vi' ? 'Đang hoạt động' : 'Active'}</span>
        </div>

        <div className="booth-kpi-card">
          <span className="booth-kpi-number is-inactive">{loading || loadError ? '—' : inactiveBoothsCount}</span>
          <span className="booth-kpi-label">{language === 'vi' ? 'Tạm ngưng' : 'Inactive'}</span>
        </div>
      </div>

      {/* ALERT MESSAGES */}
      {errorMessage && (
        <div className="s2-alert s2-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="s2-alert s2-alert-success" role="status">
          <Check size={18} />
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {activeMode === 'map' ? (
        <div ref={mapPanelRef} className="booth-physical-map-panel">
          <div className="booth-physical-map-heading">
            <div>
              <h2>Sơ đồ không gian Đường Sách</h2>
              <p>Kéo gian hàng hoặc địa điểm tổ chức để cập nhật tọa độ, bấm vào điểm để chỉnh sửa nhanh.</p>
            </div>
            <span>{mapMarkers.length}/{booths.length + locations.length} vị trí đã có tọa độ</span>
          </div>
          <BoothMapCanvas
            markers={mapMarkers}
            selectedMarkerId={targetLocationId ? `location-${targetLocationId}` : undefined}
            newlyCreatedMarkerId={targetLocationId && locationDraftCoords[targetLocationId] ? `location-${targetLocationId}` : newlyCreatedBoothId ? `booth-${newlyCreatedBoothId}` : undefined}
            activePopoverData={activePopover}
            onOpenPopover={handleOpenMapPopover}
            onClosePopover={() => setActivePopover(null)}
            onSavePopover={handleSaveMapPopover}
            onPositionChange={handleMapPositionChange}
            onSaveAllMap={handleSaveAllMap}
            onUploadMapImage={handleUploadMapImage}
            isSavingAll={isSavingMap}
            hasUnsavedChanges={Object.keys(draftCoords).length > 0 || Object.keys(locationDraftCoords).length > 0}
            editable
            customMapUrl={customMapUrl}
            statusScope="physical"
            ariaLabel="Sơ đồ không gian Đường Sách"
            emptyMessage="Chưa có gian hàng hoặc địa điểm tổ chức nào với tọa độ hợp lệ."
          />
        </div>
      ) : (
        <>
          {/* 3. TOOLBAR & FILTERS */}
                    {!loadError && (
            <div className="booth-crud-toolbar">
              <div className="booth-toolbar-left">
                {/* Search Box */}
                <SearchFieldLabel className="booth-search-group"><div className="booth-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder={language === 'vi' ? 'Tìm theo mã gian (A01), tên, ghi chú...' : 'Search by code, name, note...'}
                    value={searchKeyword}
                    onChange={e => { setSearchKeyword(e.target.value); pagination.reset(); }}
                  />
                </div></SearchFieldLabel>

                {/* Status Filter */}
                <WorkspaceFieldLabel className="booth-status-field" label={language === 'vi' ? 'Trạng thái' : 'Status'}><select
                  className="booth-filter-select"
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value as 'all' | 'active' | 'inactive'); pagination.reset(); }}
                >
                  <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
                  <option value="active">{language === 'vi' ? 'Đang hoạt động' : 'Active Only'}</option>
                  <option value="inactive">{language === 'vi' ? 'Tạm ngưng' : 'Inactive Only'}</option>
                </select></WorkspaceFieldLabel>
              </div>

              <div className="booth-toolbar-right">
                <button
                  type="button"
                  className="btn-toolbar-refresh"
                  onClick={() => void loadBoothData()}
                  disabled={loading}
                  title={language === 'vi' ? 'Làm mới danh sách' : 'Refresh'}
                >
                  <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
                  <span>{language === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                </button>

                <div className="booth-view-toggle">
                  <button
                    type="button"
                    className={`booth-view-btn ${listLayout === 'table' ? 'is-active' : ''}`}
                    onClick={() => setListLayout('table')}
                    title={language === 'vi' ? 'Dạng bảng' : 'Table View'}
                  >
                    <List size={16} />
                  </button>
                  <button
                    type="button"
                    className={`booth-view-btn ${listLayout === 'grid' ? 'is-active' : ''}`}
                    onClick={() => setListLayout('grid')}
                    title={language === 'vi' ? 'Dạng thẻ lưới' : 'Grid Cards View'}
                  >
                    <Grid size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. MAIN CONTENT LIST / TABLE */}
          {loading ? (
            <div className="s2-loading">
              <Loader2 size={32} className="s2-spin" />
              <p>{language === 'vi' ? 'Đang tải danh sách gian hàng...' : 'Loading booths...'}</p>
            </div>
          ) : loadError ? (
            <section className="booth-catalog-state is-error" role="alert">
              <span className="booth-state-icon">{accessDenied ? <ShieldAlert size={30} /> : <AlertCircle size={30} />}</span>
              <h2>{accessDenied ? (language === 'vi' ? 'Chưa có quyền truy cập danh mục' : 'Catalog access is not permitted') : (language === 'vi' ? 'Không thể tải danh mục gian hàng' : 'Could not load booth catalog')}</h2>
              <p>{accessDenied ? (language === 'vi' ? 'Phiên đăng nhập hiện tại không được cấp quyền quản lý gian hàng. Nếu quyền tài khoản vừa thay đổi, hãy đăng xuất và đăng nhập lại.' : 'Your current session does not have booth management permission. Sign in again if your permissions recently changed.') : (language === 'vi' ? 'Dữ liệu chưa được tải. Vui lòng kiểm tra kết nối và thử lại.' : 'Data has not loaded. Check your connection and try again.')}</p>
              <button type="button" className="btn-org-secondary" onClick={() => void loadBoothData()}><RefreshCw size={16} />{language === 'vi' ? 'Thử tải lại' : 'Retry'}</button>
            </section>
          ) : filteredBooths.length === 0 ? (
            <div className="booth-catalog-state">
              <span className="booth-state-icon">{booths.length ? <Search size={30} /> : <Store size={30} />}</span>
              <h2>{booths.length ? (language === 'vi' ? 'Không có kết quả phù hợp' : 'No matching results') : (language === 'vi' ? 'Danh mục chưa có gian hàng' : 'No booths in the catalog yet')}</h2>
              <p>
                {booths.length ? (language === 'vi' ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ gian hàng.' : 'Try another keyword or clear your filters.') : (language === 'vi' ? 'Tạo gian hàng đầu tiên với mã, tên và vị trí để bắt đầu quản lý danh mục.' : 'Create your first booth with its code, name and location.')}
              </p>
              {booths.length ? <button type="button" className="btn-org-secondary" onClick={() => { setSearchKeyword(''); setFilterStatus('all'); pagination.reset(); }}><X size={16} />{language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}</button> : <button type="button" className="btn-org-primary" onClick={handleOpenCreateModal}><Plus size={16} /><span>{language === 'vi' ? 'Tạo gian hàng đầu tiên' : 'Create First Booth'}</span></button>}
            </div>
          ) : listLayout === 'table' ? (
            /* TABLE VIEW */
        <div className="booth-table-container">
          <table className="booth-table">
            <thead>
              <tr>
                <th>{language === 'vi' ? 'Mã gian' : 'Code'}</th>
                <th>{language === 'vi' ? 'Tên gian hàng' : 'Booth Name'}</th>
                <th>{language === 'vi' ? 'Thể loại' : 'Category'}</th>
                <th>{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th style={{ textAlign: 'right' }}>{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {pagination.items.map(booth => {
                const isBusy = busyBoothId === booth.boothId;

                return (
                  <tr key={booth.boothId}>
                    {/* Code */}
                    <td>
                      <span className="booth-code-pill">
                        <span className="booth-code-icon" aria-hidden="true"><Store size={15} /></span>
                        <strong>{booth.code}</strong>
                      </span>
                    </td>

                    {/* Name & Description */}
                    <td>
                      <div className="booth-name-cell">
                        <strong>{booth.name}</strong>
                        {booth.description ? (
                          <span>{booth.description}</span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#9CA3AF' }}>
                            {language === 'vi' ? 'Chưa có mô tả chi tiết' : 'No description'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="booth-category-badge">
                        {getCategoryLabel(booth.categoryCode, language)}
                      </span>
                    </td>

                    {/* Active Toggle Switch */}
                    <td>
                      <label className="booth-status-switch" title={language === 'vi' ? 'Bật/tắt hoạt động' : 'Toggle active'}>
                        <input
                          type="checkbox"
                          checked={booth.active}
                          disabled={isBusy}
                          onChange={() => void handleToggleActive(booth)}
                        />
                        <div className="booth-status-slider"></div>
                        <span className={`booth-status-label ${booth.active ? 'active' : 'inactive'}`}>
                          {isBusy ? '...' : booth.active ? (language === 'vi' ? 'Mở' : 'Active') : (language === 'vi' ? 'Đóng' : 'Inactive')}
                        </span>
                      </label>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="booth-actions-cell">
                        <button
                          type="button"
                          className="btn-booth-action"
                          onClick={() => setViewingBooth(booth)}
                          title={language === 'vi' ? 'Xem chi tiết' : 'View Detail'}
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          className="btn-booth-action edit"
                          onClick={() => handleOpenEditModal(booth)}
                          title={language === 'vi' ? 'Chỉnh sửa gian hàng' : 'Edit Booth'}
                        >
                          <Edit3 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          ) : (
            /* GRID CARDS VIEW */
        <div className="booth-grid-cards">
          {pagination.items.map(booth => {
            const isBusy = busyBoothId === booth.boothId;

            return (
              <div key={booth.boothId} className="booth-card-item">
                <div className="booth-card-top">
                  <span className="booth-code-pill">
                    <span className="booth-code-icon" aria-hidden="true"><Store size={15} /></span>
                    <strong>{booth.code}</strong>
                  </span>
                  <span className="booth-category-badge">
                    {getCategoryLabel(booth.categoryCode, language)}
                  </span>
                </div>

                <div>
                  <h3 className="booth-card-title">{booth.name}</h3>
                  <p className="booth-card-desc">
                    {booth.description || (language === 'vi' ? 'Gian hàng tiêu chuẩn tại Phố Sách Nguyễn Văn Bình.' : 'Standard book street booth.')}
                  </p>
                </div>

                <div className="booth-card-specs">
                  <div className="booth-spec-item">
                    <span className="booth-spec-label">{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
                    <span className="booth-spec-value" style={{ color: booth.active ? '#15803D' : '#991B1B' }}>
                      {booth.active ? '● Hoạt động' : '○ Tạm ngưng'}
                    </span>
                  </div>
                </div>

                <div className="booth-card-footer">
                  <label className="booth-status-switch">
                    <input
                      type="checkbox"
                      checked={booth.active}
                      disabled={isBusy}
                      onChange={() => void handleToggleActive(booth)}
                    />
                    <div className="booth-status-slider"></div>
                    <span className={`booth-status-label ${booth.active ? 'active' : 'inactive'}`}>
                      {booth.active ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </label>

                  <div className="booth-actions-cell">
                    <button
                      type="button"
                      className="btn-booth-action"
                      onClick={() => setViewingBooth(booth)}
                      title="Xem chi tiết"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-booth-action edit"
                      onClick={() => handleOpenEditModal(booth)}
                      title="Chỉnh sửa"
                    >
                      <Edit3 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}

          {/* Pagination */}
          {!loading && !loadError && filteredBooths.length > 0 && (
            <CompactPagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={pagination.setPage} />
          )}
        </>
      )}

      {/* 5. CREATE / EDIT BOOTH MODAL */}
      {isFormModalOpen && (
        <div className="booth-modal-backdrop" {...formBackdropHandlers}>
          <div className="booth-modal-box" onClick={e => e.stopPropagation()}>
            <div className="booth-modal-header">
              <h2>
                {editingBooth
                  ? (language === 'vi' ? `Chỉnh sửa Gian hàng "${editingBooth.code}"` : `Edit Booth "${editingBooth.code}"`)
                  : (language === 'vi' ? 'Thêm Gian hàng mới vào danh mục' : 'Add New Booth to Catalog')}
              </h2>
              <button
                type="button"
                className="booth-modal-close-btn"
                onClick={closeFormModal}
                disabled={formSubmitting || imageUploading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="booth-form-grid">
              {/* Booth Code */}
              <div className="booth-form-group">
                <label>
                  {language === 'vi' ? 'Mã gian hàng' : 'Booth Code'}
                  <span className="required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: A01, B02, C10"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  disabled={formSubmitting || !!editingBooth}
                  required
                />
                {editingBooth && (
                  <small style={{ color: '#6B7280', fontSize: '0.75rem' }}>
                    {language === 'vi' ? 'Mã định danh không thể thay đổi sau khi tạo.' : 'Booth code cannot be changed.'}
                  </small>
                )}
              </div>

              {/* Category */}
              <div className="booth-form-group">
                <label>
                  {language === 'vi' ? 'Thể loại / Chuyên mục' : 'Category'}
                  <span className="required">*</span>
                </label>
                <select
                  value={formData.categoryCode}
                  onChange={e => setFormData({ ...formData, categoryCode: e.target.value })}
                  disabled={formSubmitting}
                  required
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat.code} value={cat.code}>
                      {language === 'vi' ? cat.labelVi : cat.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booth Name */}
              <div className="booth-form-group full-width">
                <label>
                  {language === 'vi' ? 'Tên gian hàng' : 'Booth Name'}
                  <span className="required">*</span>
                </label>
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Ví dụ: Gian Hàng A01 - Sách Thiếu Nhi & Truyện Tranh' : 'Booth Name'}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  disabled={formSubmitting}
                  required
                />
              </div>

              <div className="booth-form-group full-width">
                <ImageUrlField
                  label={language === 'vi' ? 'Ảnh gian hàng' : 'Booth image'}
                  language={language}
                  value={formData.imageUrl}
                  onChange={imageUrl => setFormData(current => ({ ...current, imageUrl }))}
                  uploadFile={handleBoothImageUpload}
                  onBusyChange={setImageUploading}
                  disabled={formSubmitting}
                />
                {formData.imageUrl && <button type="button" className="btn-org-secondary booth-image-remove-button" onClick={handleRemoveBoothImage} disabled={formSubmitting || imageUploading}><Trash2 size={15} />{language === 'vi' ? 'Gỡ ảnh' : 'Remove'}</button>}
              </div>

              {/* Status Switch (Edit only) */}
              <div className="booth-form-group full-width" style={{ justifyContent: 'center' }}>
                <label style={{ marginBottom: '0.4rem' }}>{language === 'vi' ? 'Trạng thái hoạt động' : 'Active Status'}</label>
                <label className="booth-status-switch">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    disabled={formSubmitting || imageUploading}
                  />
                  <div className="booth-status-slider"></div>
                  <span className={`booth-status-label ${formData.active ? 'active' : 'inactive'}`}>
                    {formData.active ? (language === 'vi' ? 'Đang mở hoạt động' : 'Active') : (language === 'vi' ? 'Tạm ngưng hoạt động' : 'Inactive')}
                  </span>
                </label>
              </div>



              {/* Description */}
              <div className="booth-form-group full-width">
                <label>{language === 'vi' ? 'Mô tả vị trí & không gian' : 'Description'}</label>
                <textarea
                  placeholder={language === 'vi' ? 'Mô tả diện tích gian, lối đi, mái che, khu vực xung quanh...' : 'Location description, amenities...'}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  disabled={formSubmitting || imageUploading}
                  rows={3}
                />
              </div>

              {/* Technical Note */}
              <div className="booth-form-group full-width">
                <label>{language === 'vi' ? 'Ghi chú kỹ thuật & trang thiết bị' : 'Technical Notes'}</label>
                <textarea
                  placeholder={language === 'vi' ? 'Ví dụ: Cung cấp sẵn 2 bàn trưng bày, ổ cắm điện 220V, wifi công suất cao...' : 'Power outlets, display tables...'}
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  disabled={formSubmitting}
                  rows={2}
                />
              </div>

              {/* Form Footer */}
              <div className="booth-modal-footer full-width" style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={closeFormModal}
                  disabled={formSubmitting || imageUploading}
                >
                  {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  disabled={formSubmitting || imageUploading}
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 size={16} className="s2-spin" />
                      <span>{language === 'vi' ? 'Đang lưu...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{editingBooth ? (language === 'vi' ? 'Cập nhật' : 'Update') : (language === 'vi' ? 'Thêm gian hàng' : 'Create Booth')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. VIEW BOOTH DETAIL MODAL */}
      {viewingBooth && (
        <div className="booth-modal-backdrop" {...detailBackdropHandlers}>
          <div className="booth-modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="booth-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="booth-code-pill" style={{ fontSize: '1rem' }}>
                  <span className="booth-code-icon" aria-hidden="true"><Store size={16} /></span>
                  <strong>{viewingBooth.code}</strong>
                </span>
                <h2 style={{ margin: 0 }}>{viewingBooth.name}</h2>
              </div>
              <button
                type="button"
                className="booth-modal-close-btn"
                onClick={() => setViewingBooth(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {viewingBooth.imageUrl && (
                <img
                  className="booth-detail-image"
                  src={viewingBooth.imageUrl}
                  alt={viewingBooth.name}
                />
              )}
              <div className="booth-card-specs" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="booth-spec-item">
                  <span className="booth-spec-label">{language === 'vi' ? 'Thể loại' : 'Category'}</span>
                  <span className="booth-spec-value">{getCategoryLabel(viewingBooth.categoryCode, language)}</span>
                </div>
                <div className="booth-spec-item">
                  <span className="booth-spec-label">{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
                  <span className="booth-spec-value" style={{ color: viewingBooth.active ? '#15803D' : '#991B1B' }}>
                    {viewingBooth.active ? 'Đang mở' : 'Tạm ngưng'}
                  </span>
                </div>
              </div>

              <div>
                <strong style={{ color: '#17382E', fontSize: '0.9rem', display: 'block', marginBottom: '0.35rem' }}>
                  {language === 'vi' ? 'Mô tả vị trí & diện tích:' : 'Description:'}
                </strong>
                <p style={{ margin: 0, color: '#4B5563', lineHeight: 1.6, fontSize: '0.88rem', background: '#F9FAFB', padding: '0.75rem', borderRadius: '8px' }}>
                  {viewingBooth.description || (language === 'vi' ? 'Chưa có mô tả chi tiết.' : 'No description.')}
                </p>
              </div>

              <div>
                <strong style={{ color: '#17382E', fontSize: '0.9rem', display: 'block', marginBottom: '0.35rem' }}>
                  {language === 'vi' ? 'Ghi chú kỹ thuật & bàn giao:' : 'Technical Notes:'}
                </strong>
                <p style={{ margin: 0, color: '#4B5563', lineHeight: 1.6, fontSize: '0.88rem', background: '#F9FAFB', padding: '0.75rem', borderRadius: '8px' }}>
                  {viewingBooth.note || (language === 'vi' ? 'Chưa có ghi chú thiết bị.' : 'No technical notes.')}
                </p>
              </div>

              {(viewingBooth.mapX !== null || viewingBooth.mapY !== null) && (
                <div>
                  <strong style={{ color: '#17382E', fontSize: '0.9rem', display: 'block', marginBottom: '0.35rem' }}>
                    {language === 'vi' ? 'Tọa độ vị trí:' : 'Coordinates:'}
                  </strong>
                  <span style={{ fontSize: '0.86rem', color: '#6B7280' }}>
                    X: {viewingBooth.mapX ?? '—'}, Y: {viewingBooth.mapY ?? '—'}
                  </span>
                </div>
              )}
            </div>

            <div className="booth-modal-footer">
              <button
                type="button"
                className="btn-org-secondary"
                onClick={() => setViewingBooth(null)}
              >
                {language === 'vi' ? 'Đóng' : 'Close'}
              </button>
              <button
                type="button"
                className="btn-org-primary"
                onClick={() => {
                  const target = viewingBooth;
                  setViewingBooth(null);
                  handleOpenEditModal(target);
                }}
              >
                <Edit3 size={15} />
                <span>{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
