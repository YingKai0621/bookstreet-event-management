import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { CreatePhysicalBoothInput, PhysicalBooth, UpdatePhysicalBoothInput } from '../../types/booth';
import { BoothMapCanvas, type PopoverBoothData } from '../booth-map/BoothMapCanvas';
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
  mapX: '',
  mapY: '',
  description: '',
  note: '',
  active: true,
};

function getCategoryLabel(categoryCode: string | null | undefined, language: Language): string {
  if (!categoryCode) return language === 'vi' ? 'Chưa phân loại' : 'Uncategorized';
  const found = CATEGORY_OPTIONS.find(c => c.code === categoryCode);
  if (found) return language === 'vi' ? found.labelVi : found.labelEn;
  return categoryCode;
}

export const OrganizerBoothManagementView: React.FC<Props> = ({
  language,
  onOpenRequests,
}) => {
  const [booths, setBooths] = useState<PhysicalBooth[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyBoothId, setBusyBoothId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filter & Search States
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'map'>('table');

  // Physical map state. Event availability and pricing deliberately do not live here.
  const [draftCoords, setDraftCoords] = useState<Record<number, { x: number; y: number }>>({});
  const [activePopover, setActivePopover] = useState<PopoverBoothData | null>(null);
  const [isSavingMap, setIsSavingMap] = useState(false);
  const [customMapUrl, setCustomMapUrl] = useState<string | undefined>();

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBooth, setEditingBooth] = useState<PhysicalBooth | null>(null);
  const [formData, setFormData] = useState<BoothFormData>(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Detail Modal
  const [viewingBooth, setViewingBooth] = useState<PhysicalBooth | null>(null);

  const loadBoothData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const physicalBooths = await boothApi.listAllPhysicalBooths();
      setBooths(physicalBooths);
      setDraftCoords({});
      setActivePopover(null);
    } catch (err) {
      console.warn('Could not load booth catalog data', err);
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tải danh sách gian hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoothData();
  }, [loadBoothData]);

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

  const mapMarkers = useMemo<BoothMapMarker[]>(() => filteredBooths.flatMap(booth => {
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
    }];
  }), [draftCoords, filteredBooths]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingBooth(null);
    setFormData(INITIAL_FORM);
    setErrorMessage('');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (booth: PhysicalBooth) => {
    setEditingBooth(booth);
    setFormData({
      code: booth.code,
      name: booth.name,
      categoryCode: booth.categoryCode || 'LITERATURE',
      mapX: booth.mapX !== null && booth.mapX !== undefined ? String(booth.mapX) : '',
      mapY: booth.mapY !== null && booth.mapY !== undefined ? String(booth.mapY) : '',
      description: booth.description || '',
      note: booth.note || '',
      active: booth.active,
    });
    setErrorMessage('');
    setIsFormModalOpen(true);
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
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
    try {
      if (editingBooth) {
        // UPDATE
        const updatePayload: UpdatePhysicalBoothInput = {
          name: trimmedName,
          categoryCode: formData.categoryCode,
          description: formData.description.trim() || null,
          note: formData.note.trim() || null,
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
          maxCapacity: 1,
          mapX: mapXVal,
          mapY: mapYVal,
        };
        await boothApi.createPhysicalBooth(createPayload);
        setSuccessMessage(`Đã thêm mới thành công gian hàng "${createPayload.code}".`);
      }

      setIsFormModalOpen(false);
      await loadBoothData();
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
    const boothId = Number(markerId.replace('booth-', ''));
    if (!Number.isFinite(boothId)) return;
    setDraftCoords(current => ({ ...current, [boothId]: { x, y } }));
    setActivePopover(current => current?.boothId === boothId ? { ...current, x, y } : current);
  };

  const handleOpenMapPopover = (marker: BoothMapMarker) => {
    const booth = booths.find(item => item.boothId === marker.boothId);
    if (!booth) return;
    setActivePopover({
      boothId: booth.boothId,
      code: booth.code,
      name: booth.name,
      status: booth.active ? 'PHYSICAL' : 'PHYSICAL_INACTIVE',
      x: marker.x,
      y: marker.y,
    });
  };

  const handleSaveMapPopover = async (data: PopoverBoothData) => {
    setErrorMessage('');
    try {
      await boothApi.updatePhysicalBooth(data.boothId, {
        code: data.code,
        name: data.name,
        mapX: data.x,
        mapY: data.y,
      });
      setSuccessMessage(`Đã cập nhật thông tin vật lý của gian "${data.code}".`);
      await loadBoothData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật gian hàng trên sơ đồ.');
    }
  };

  const handleSaveAllMap = async () => {
    const boothIds = Object.keys(draftCoords).map(Number);
    if (!boothIds.length) {
      setSuccessMessage('Tất cả vị trí gian hàng đã được đồng bộ.');
      return;
    }
    setIsSavingMap(true);
    setErrorMessage('');
    try {
      await Promise.all(boothIds.map(boothId => boothApi.updatePhysicalBooth(boothId, {
        mapX: draftCoords[boothId].x,
        mapY: draftCoords[boothId].y,
      })));
      setSuccessMessage(`Đã lưu tọa độ của ${boothIds.length} gian hàng.`);
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
          <h1>{language === 'vi' ? 'Quản lý Gian hàng' : 'Booth Management Catalog'}</h1>
          <p>
            {language === 'vi'
              ? 'Quản lý toàn bộ danh mục gian hàng vật lý hiện có tại Đường Sách và phân loại danh mục.'
              : 'Manage physical booth inventory, categories, and active statuses across the Book Street.'}
          </p>
        </div>

        <div className="booth-crud-header-actions">
          <button
            type="button"
            className="btn-org-secondary"
            onClick={() => void loadBoothData()}
            disabled={loading}
            title={language === 'vi' ? 'Làm mới danh sách' : 'Refresh'}
          >
            <RefreshCw size={15} className={loading ? 's2-spin' : ''} />
            <span>{language === 'vi' ? 'Làm mới' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className={`btn-org-secondary booth-map-action ${viewMode === 'map' ? 'is-active' : ''}`}
            onClick={() => setViewMode('map')}
            aria-pressed={viewMode === 'map'}
          >
            <MapPin size={18} />
            <span>{language === 'vi' ? 'Sơ đồ gian hàng' : 'Booth Map'}</span>
          </button>

          {onOpenRequests && (
            <button
              type="button"
              className="btn-org-secondary"
              onClick={onOpenRequests}
            >
              <Store size={15} />
              <span>{language === 'vi' ? 'Yêu cầu đối tác' : 'Partner Requests'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn-org-primary"
            onClick={handleOpenCreateModal}
          >
            <Plus size={16} />
            <span>{language === 'vi' ? 'Thêm gian hàng mới' : 'Add New Booth'}</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY STAT CARDS */}
      <div className="booth-kpi-grid">
        <div className="booth-kpi-card">
          <div className="booth-kpi-icon-box total">
            <Store size={24} />
          </div>
          <div className="booth-kpi-info">
            <span>{language === 'vi' ? 'Tổng số gian hàng' : 'Total Booths'}</span>
            <strong>{totalBoothsCount}</strong>
          </div>
        </div>

        <div className="booth-kpi-card">
          <div className="booth-kpi-icon-box active">
            <Sparkles size={24} />
          </div>
          <div className="booth-kpi-info">
            <span>{language === 'vi' ? 'Đang hoạt động' : 'Active'}</span>
            <strong style={{ color: '#166534' }}>{activeBoothsCount}</strong>
          </div>
        </div>

        <div className="booth-kpi-card">
          <div className="booth-kpi-icon-box inactive">
            <AlertCircle size={24} />
          </div>
          <div className="booth-kpi-info">
            <span>{language === 'vi' ? 'Tạm ngưng' : 'Inactive'}</span>
            <strong style={{ color: '#991B1B' }}>{inactiveBoothsCount}</strong>
          </div>
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

      {/* 3. TOOLBAR & FILTERS */}
      <div className="booth-crud-toolbar">
        <div className="booth-toolbar-left">
          {/* Search Box */}
          <div className="booth-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm theo mã gian (A01), tên, ghi chú...' : 'Search by code, name, note...'}
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="booth-filter-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
            <option value="active">{language === 'vi' ? 'Đang hoạt động' : 'Active Only'}</option>
            <option value="inactive">{language === 'vi' ? 'Tạm ngưng' : 'Inactive Only'}</option>
          </select>
        </div>

        <div className="booth-toolbar-right">
          <div className="booth-view-toggle">
            <button
              type="button"
              className={`booth-view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
              onClick={() => setViewMode('table')}
              title={language === 'vi' ? 'Dạng bảng' : 'Table View'}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={`booth-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={language === 'vi' ? 'Dạng thẻ lưới' : 'Grid Cards View'}
            >
              <Grid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT LIST / TABLE */}
      {loading ? (
        <div className="s2-loading">
          <Loader2 size={32} className="s2-spin" />
          <p>{language === 'vi' ? 'Đang tải danh sách gian hàng...' : 'Loading booths...'}</p>
        </div>
      ) : filteredBooths.length === 0 ? (
        <div className="s2-empty-state">
          <Store size={48} />
          <h3>{language === 'vi' ? 'Không tìm thấy gian hàng nào' : 'No booths found'}</h3>
          <p>
            {language === 'vi'
              ? 'Thử thay đổi từ khóa tìm kiếm, bộ lọc hoặc thêm gian hàng mới vào danh mục.'
              : 'Try changing search keywords, filters, or create a new booth in catalog.'}
          </p>
          <button type="button" className="btn-org-primary" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            <span>{language === 'vi' ? 'Tạo gian hàng đầu tiên' : 'Create First Booth'}</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
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
              {filteredBooths.map(booth => {
                const isBusy = busyBoothId === booth.boothId;

                return (
                  <tr key={booth.boothId}>
                    {/* Code */}
                    <td>
                      <span className="booth-code-pill">
                        <Store size={12} />
                        {booth.code}
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
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="booth-grid-cards">
          {filteredBooths.map(booth => {
            const isBusy = busyBoothId === booth.boothId;

            return (
              <div key={booth.boothId} className="booth-card-item">
                <div className="booth-card-top">
                  <span className="booth-code-pill">
                    <Store size={13} />
                    {booth.code}
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
      ) : (
        <div className="booth-physical-map-panel">
          <div className="booth-physical-map-heading">
            <div>
              <h2>Sơ đồ gian hàng vật lý</h2>
              <p>Kéo để cập nhật tọa độ. Trạng thái thuê và giá được cấu hình riêng trong từng sự kiện.</p>
            </div>
            <span>{mapMarkers.length}/{filteredBooths.length} gian đã có tọa độ</span>
          </div>
          <BoothMapCanvas
            markers={mapMarkers}
            activePopoverData={activePopover}
            onOpenPopover={handleOpenMapPopover}
            onClosePopover={() => setActivePopover(null)}
            onSavePopover={handleSaveMapPopover}
            onPositionChange={handleMapPositionChange}
            onSaveAllMap={handleSaveAllMap}
            onUploadMapImage={handleUploadMapImage}
            isSavingAll={isSavingMap}
            hasUnsavedChanges={Object.keys(draftCoords).length > 0}
            editable
            customMapUrl={customMapUrl}
            statusScope="physical"
            ariaLabel="Sơ đồ danh mục gian hàng vật lý"
            emptyMessage="Chưa có gian hàng nào với tọa độ hợp lệ để hiển thị trên sơ đồ."
          />
        </div>
      )}

      {/* 5. CREATE / EDIT BOOTH MODAL */}
      {isFormModalOpen && (
        <div className="booth-modal-backdrop" onClick={() => !formSubmitting && setIsFormModalOpen(false)}>
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
                onClick={() => !formSubmitting && setIsFormModalOpen(false)}
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

              <div className="booth-form-group">
                <label htmlFor="physical-booth-map-x">Tọa độ X trên sơ đồ (%)</label>
                <input
                  id="physical-booth-map-x"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0–100"
                  value={formData.mapX}
                  onChange={e => setFormData({ ...formData, mapX: e.target.value })}
                  disabled={formSubmitting}
                />
              </div>

              <div className="booth-form-group">
                <label htmlFor="physical-booth-map-y">Tọa độ Y trên sơ đồ (%)</label>
                <input
                  id="physical-booth-map-y"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0–100"
                  value={formData.mapY}
                  onChange={e => setFormData({ ...formData, mapY: e.target.value })}
                  disabled={formSubmitting}
                />
              </div>

              {/* Status Switch (Edit only) */}
              <div className="booth-form-group full-width" style={{ justifyContent: 'center' }}>
                <label style={{ marginBottom: '0.4rem' }}>{language === 'vi' ? 'Trạng thái hoạt động' : 'Active Status'}</label>
                <label className="booth-status-switch">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    disabled={formSubmitting}
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
                  disabled={formSubmitting}
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
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                >
                  {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn-org-primary"
                  disabled={formSubmitting}
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
        <div className="booth-modal-backdrop" onClick={() => setViewingBooth(null)}>
          <div className="booth-modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="booth-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="booth-code-pill" style={{ fontSize: '1rem' }}>
                  {viewingBooth.code}
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
