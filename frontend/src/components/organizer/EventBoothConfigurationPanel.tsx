import {
  AlertCircle,
  AlignLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Store,
  Tag,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '../../services/apiClient';
import { boothApi } from '../../services/boothApi';
import type { Language } from '../../types';
import type { EventBooth } from '../../types/booth';
import type { OrganizerEvent } from '../../types/organizer';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import { BoothIllustration } from './BoothIllustration';
import './Sprint2Booth.css';
import './OrganizerPortal.css';

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
  return 'Chưa mở cho thuê';
}

function formatPriceVnd(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'Chưa có giá';
  return `${price.toLocaleString('vi-VN')} đ`;
}

const PAGE_SIZE = 9;

export const EventBoothConfigurationPanel: React.FC<Props> = ({ language, event, onChanged }) => {
  const [rows, setRows] = useState<EventBooth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters, search & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'code_asc' | 'code_desc' | 'price_asc' | 'price_desc'>('latest');
  const [currentPage, setCurrentPage] = useState(1);

  // Selected booth for Detail & Configuration Drawer
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [draftPrice, setDraftPrice] = useState<string>('');
  const [draftEnabled, setDraftEnabled] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
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

      // If drawer was open, sync with updated row
      setSelectedBooth(prev => {
        if (!prev) return null;
        return nextRows.find(r => r.booth.boothId === prev.booth.boothId) || null;
      });
    } catch (caughtError) {
      if (generation !== generationRef.current || currentEventIdRef.current !== requestedEventId) return;
      setError(apiMessage(caughtError));
    } finally {
      if (generation === generationRef.current && currentEventIdRef.current === requestedEventId) setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The generation-guarded loader synchronizes this panel with the selected event.
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

  // Drawer keyboard & body lock
  useEffect(() => {
    if (!selectedBooth) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        setSelectedBooth(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBooth, isSaving]);

  // Open Drawer
  const openDrawer = (row: EventBooth) => {
    setSelectedBooth(row);
    setDraftPrice(row.rentalPrice !== null ? String(row.rentalPrice) : '');
    setDraftEnabled(row.enabled);
    setDrawerError('');
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setSelectedBooth(null);
    setDrawerError('');
  };

  // Save changes from Drawer
  const handleSaveDrawer = async () => {
    if (!selectedBooth) return;
    const trimmed = draftPrice.trim();
    const rentalPrice = Number(trimmed);

    if (!trimmed || !Number.isFinite(rentalPrice) || rentalPrice < 0) {
      setDrawerError('Giá thuê phải là một số không âm.');
      return;
    }

    if (rentalPrice > 0 && rentalPrice < 5000) {
      setDrawerError('Giá thuê phải bằng 0 (miễn phí) hoặc từ 5.000 VNĐ trở lên.');
      return;
    }

    const requestedEventId = event.id;
    const boothId = selectedBooth.booth.boothId;
    setIsSaving(true);
    setDrawerError('');

    try {
      const updated = await boothApi.configureEventBooth(
        requestedEventId,
        boothId,
        rentalPrice,
        draftEnabled,
      );

      if (currentEventIdRef.current !== requestedEventId) return;

      setRows(current => current.map(row => row.booth.boothId === updated.booth.boothId ? updated : row));
      setSelectedBooth(updated);
      setSuccess(`Đã lưu cấu hình gian ${updated.booth.code}.`);
      await onChanged?.();
    } catch (caughtError) {
      if (currentEventIdRef.current !== requestedEventId) return;
      setDrawerError(apiMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  // Mini statistics (Phễu vận hành: Tổng số gian -> Đã có giá thuê -> Đang cho thuê)
  const totalCount = rows.length;
  const configuredPriceCount = useMemo(
    () => rows.filter(row => row.rentalPrice !== null).length,
    [rows],
  );
  const enabledCount = useMemo(() => rows.filter(row => row.enabled).length, [rows]);

  // Unique categories for filter dropdown
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.booth.categoryCode) set.add(r.booth.categoryCode);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Filtering & Sorting
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rows.filter(row => {
      if (q) {
        const matchCode = row.booth.code.toLowerCase().includes(q);
        const matchName = row.booth.name.toLowerCase().includes(q);
        const matchCategory = (row.booth.categoryCode || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCategory) return false;
      }

      if (statusFilter === 'enabled' && !row.enabled) return false;
      if (statusFilter === 'disabled' && row.enabled) return false;

      if (categoryFilter !== 'all' && row.booth.categoryCode !== categoryFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'code_asc') return a.booth.code.localeCompare(b.booth.code);
      if (sortBy === 'code_desc') return b.booth.code.localeCompare(a.booth.code);
      if (sortBy === 'price_asc') return (a.rentalPrice ?? 0) - (b.rentalPrice ?? 0);
      if (sortBy === 'price_desc') return (b.rentalPrice ?? 0) - (a.rentalPrice ?? 0);
      return a.booth.boothId - b.booth.boothId;
    });
  }, [rows, searchQuery, statusFilter, categoryFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pagedRows = filteredRows.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  // Drawer Portal
  const drawerPortal = selectedBooth && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="org-booth-drawer-backdrop"
        onMouseDown={e => {
          if (e.target === e.currentTarget && !isSaving) closeDrawer();
        }}
      >
        <aside
          ref={drawerRef}
          className="org-booth-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booth-drawer-title"
        >
          {/* Drawer Header */}
          <header className="org-booth-drawer-header">
            <h2 id="booth-drawer-title">Chi tiết gian hàng</h2>
            <button
              ref={closeButtonRef}
              type="button"
              className="org-booth-drawer-close"
              onClick={closeDrawer}
              disabled={isSaving}
              aria-label="Đóng chi tiết gian hàng"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          {/* Drawer Body */}
          <div className="org-booth-drawer-body">
            {/* Top Large Booth Visual */}
            <div className="org-booth-drawer-visual">
              <BoothIllustration
                categoryCode={selectedBooth.booth.categoryCode}
                variant="drawer"
              />
            </div>

            {/* Booth Identity Badge & Title */}
            <div className="org-booth-drawer-identity">
              <div className="org-booth-drawer-tag-row">
                <span className="org-booth-code-pill">{selectedBooth.booth.code}</span>
                {selectedBooth.enabled ? (
                  <span className="org-booth-status-chip is-enabled">
                    <Check size={12} aria-hidden="true" />
                    <span>Đang cho thuê</span>
                  </span>
                ) : (
                  <span className="org-booth-status-chip is-disabled">
                    <Lock size={12} aria-hidden="true" />
                    <span>Chưa mở cho thuê</span>
                  </span>
                )}
                {selectedBooth.availability === 'ASSIGNED' && (
                  <span className="org-booth-sub-badge is-assigned">Đã thuê</span>
                )}
                {selectedBooth.availability === 'ON_HOLD' && (
                  <span className="org-booth-sub-badge is-on-hold">Đang giữ chỗ</span>
                )}
              </div>
              <h3 className="org-booth-drawer-name">{selectedBooth.booth.name}</h3>
              <span className="org-booth-drawer-category">
                {selectedBooth.booth.categoryCode || 'LITERATURE'}
              </span>
            </div>

            {/* Section D: Thông tin gian hàng (Read-only specs & description) */}
            <section className="org-booth-drawer-section">
              <h4 className="org-booth-drawer-section-title">Thông tin gian hàng</h4>
              <div className="org-booth-specs-grid">
                <div className="org-booth-spec-card">
                  <div className="org-booth-spec-icon-wrap">
                    <Users size={18} className="org-booth-spec-icon" aria-hidden="true" />
                  </div>
                  <div className="org-booth-spec-content">
                    <span className="org-booth-spec-label">Sức chứa tối đa</span>
                    <strong className="org-booth-spec-val">{selectedBooth.booth.maxCapacity} người</strong>
                  </div>
                </div>

                <div className="org-booth-spec-card">
                  <div className="org-booth-spec-icon-wrap">
                    <CircleDot size={18} className="org-booth-spec-icon" aria-hidden="true" />
                  </div>
                  <div className="org-booth-spec-content">
                    <span className="org-booth-spec-label">Tình trạng thực tế</span>
                    <strong className="org-booth-spec-val">{availabilityLabel(selectedBooth)}</strong>
                  </div>
                </div>
              </div>

              {/* Description item */}
              <div className="org-booth-desc-item">
                <div className="org-booth-spec-icon-wrap">
                  <AlignLeft size={18} className="org-booth-spec-icon" aria-hidden="true" />
                </div>
                <div className="org-booth-desc-content">
                  <span className="org-booth-spec-label">Mô tả</span>
                  <p className="org-booth-desc-text">
                    {selectedBooth.booth.description ||
                      'Gian hàng tiêu chuẩn, vị trí đẹp, phù hợp cho các đơn vị kinh doanh sách văn học.'}
                  </p>
                </div>
              </div>
            </section>

            {/* Section E: Cấu hình cho thuê (Actionable controls) */}
            <section className="org-booth-drawer-section is-config-section">
              <h4 className="org-booth-drawer-section-title">Cấu hình cho thuê</h4>

              {/* Switch */}
              <div className="org-booth-switch-control">
                <label className="s2-switch" htmlFor="drawer-enabled-switch">
                  <input
                    id="drawer-enabled-switch"
                    type="checkbox"
                    checked={draftEnabled}
                    disabled={isSaving}
                    onChange={e => setDraftEnabled(e.target.checked)}
                  />
                  <span className="s2-slider" />
                </label>
                <div className="org-booth-switch-text">
                  <strong>{draftEnabled ? 'Đang cho thuê' : 'Chưa mở cho thuê'}</strong>
                  <p>Bật để cho đối tác có thể đăng ký thuê gian hàng này.</p>
                </div>
              </div>

              {/* Rental Price */}
              <div className="org-booth-price-group">
                <label className="org-booth-drawer-label" htmlFor="drawer-rental-price">
                  Giá thuê trọn gói (VNĐ)
                </label>
                <div className="org-booth-price-field">
                  <input
                    id="drawer-rental-price"
                    type="number"
                    min="0"
                    step="100000"
                    value={draftPrice}
                    placeholder="Nhập giá thuê trọn gói"
                    disabled={isSaving}
                    onChange={e => setDraftPrice(e.target.value)}
                  />
                  <span className="org-booth-price-unit">VNĐ</span>
                </div>
                <small className="org-booth-field-hint">
                  Nhập 0 cho gian hàng miễn phí; giá có thu phí phải từ 5.000 VNĐ trở lên.
                </small>
              </div>
            </section>

            {/* Drawer Error Alert */}
            {drawerError && (
              <div className="s2-alert s2-alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{drawerError}</span>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <footer className="org-booth-drawer-footer">
            <button
              type="button"
              className="btn-org-secondary"
              onClick={closeDrawer}
              disabled={isSaving}
            >
              Đóng
            </button>
            <button
              type="button"
              className="btn-org-primary"
              onClick={() => void handleSaveDrawer()}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="s2-spin" aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </button>
          </footer>
        </aside>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="org-booth-management-panel">
      {/* 1. Header Area */}
      <div className="org-booth-header-row">
        <div>
          <span className="org-booth-eyebrow">
            {event.title} · {event.dateRange}
          </span>
          <h2 className="org-booth-main-title">
            {language === 'vi' ? 'Danh sách gian hàng cho thuê' : 'Event Booth Rental List'}
          </h2>
          <p className="org-booth-main-desc">
            {language === 'vi'
              ? 'Quản lý các gian hàng trong sự kiện. Cấu hình giá thuê và trạng thái cho thuê của từng gian hàng.'
              : 'Manage event booths, configure rental pricing and availability.'}
          </p>
        </div>
        <button
          type="button"
          className="btn-org-secondary"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 's2-spin' : ''} aria-hidden="true" />
          <span>{language === 'vi' ? 'Làm mới' : 'Refresh'}</span>
        </button>
      </div>

      {/* 2. Top Mini Statistics (Phễu vận hành: Tổng số gian -> Đã có giá thuê -> Đang cho thuê) */}
      <div className="org-booth-stats-row" aria-label="Thống kê gian hàng sự kiện">
        <div className="org-booth-stat-card">
          <div className="org-booth-stat-icon is-green">
            <Store size={20} aria-hidden="true" />
          </div>
          <div className="org-booth-stat-content">
            <span className="org-booth-stat-val">{totalCount} gian hàng</span>
            <span className="org-booth-stat-label">Tổng số gian hàng</span>
          </div>
        </div>

        <div className="org-booth-stat-card">
          <div className="org-booth-stat-icon is-gold">
            <Tag size={20} aria-hidden="true" />
          </div>
          <div className="org-booth-stat-content">
            <span className="org-booth-stat-val">{configuredPriceCount} gian hàng</span>
            <span className="org-booth-stat-label">Gian hàng đã cấu hình giá</span>
          </div>
        </div>

        <div className="org-booth-stat-card">
          <div className="org-booth-stat-icon is-green">
            <Check size={20} aria-hidden="true" />
          </div>
          <div className="org-booth-stat-content">
            <span className="org-booth-stat-val">{enabledCount} gian hàng</span>
            <span className="org-booth-stat-label">Gian hàng đang cho thuê</span>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="s2-alert s2-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="s2-alert s2-alert-success" role="status">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* 3. Toolbar (Search, Filter Pills, Category Select, Sort Select) */}
      <div className="org-booth-toolbar">
        {/* Search Input */}
        <WorkspaceFieldLabel className="org-booth-search-field" label="Tìm kiếm"><div className="org-booth-search-box">
          <Search size={16} className="org-booth-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Tìm kiếm gian hàng theo mã, tên..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Tìm kiếm gian hàng"
          />
        </div></WorkspaceFieldLabel>

        {/* Filter Pills */}
        <div className="org-booth-filter-pills" role="radiogroup" aria-label="Lọc theo trạng thái cho thuê">
          <button
            type="button"
            className={`org-booth-pill-btn ${statusFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => {
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`org-booth-pill-btn ${statusFilter === 'enabled' ? 'is-active' : ''}`}
            onClick={() => {
              setStatusFilter('enabled');
              setCurrentPage(1);
            }}
          >
            Đang cho thuê
          </button>
          <button
            type="button"
            className={`org-booth-pill-btn ${statusFilter === 'disabled' ? 'is-active' : ''}`}
            onClick={() => {
              setStatusFilter('disabled');
              setCurrentPage(1);
            }}
          >
            Chưa mở cho thuê
          </button>
        </div>

        {/* Category Select */}
        <WorkspaceFieldLabel className="org-booth-category-field" label="Loại gian hàng"><div className="org-booth-select-wrap">
          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Lọc theo loại gian hàng"
          >
            <option value="all">Tất cả loại gian hàng</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div></WorkspaceFieldLabel>

        {/* Sort Select */}
        <WorkspaceFieldLabel className="org-booth-sort-field" label="Sắp xếp"><div className="org-booth-select-wrap">
          <select
            value={sortBy}
            onChange={e => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            aria-label="Sắp xếp danh sách"
          >
            <option value="latest">Mới nhất</option>
            <option value="code_asc">Mã gian (A-Z)</option>
            <option value="code_desc">Mã gian (Z-A)</option>
            <option value="price_asc">Giá thuê: Thấp đến cao</option>
            <option value="price_desc">Giá thuê: Cao đến thấp</option>
          </select>
        </div></WorkspaceFieldLabel>
      </div>

      {/* 4. Content Area: Loading, Empty, or Card Grid */}
      {loading ? (
        <div className="s2-loading">
          <Loader2 className="s2-spin" size={26} aria-hidden="true" />
          <span>Đang tải cấu hình gian hàng...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="s2-empty">
          <Store size={36} aria-hidden="true" />
          <strong>Chưa có gian vật lý đang hoạt động</strong>
          <span>Hãy tạo hoặc kích hoạt gian tại màn hình Gian hàng.</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="s2-empty">
          <Search size={36} aria-hidden="true" />
          <strong>Không tìm thấy gian hàng phù hợp</strong>
          <span>Hãy thử từ khóa khác hoặc xóa bớt bộ lọc.</span>
        </div>
      ) : (
        <>
          {/* Card Grid (3 Columns) */}
          <div className="org-booth-card-grid">
            {pagedRows.map(row => {
              const hasAssignedOrHold = row.availability === 'ASSIGNED' || row.availability === 'ON_HOLD';

              return (
                <article
                  key={row.booth.boothId}
                  className="org-booth-card s2-config-row"
                  data-booth-id={row.booth.boothId}
                  onClick={() => openDrawer(row)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDrawer(row);
                    }
                  }}
                  role="button"
                  aria-label={`Xem và cấu hình gian ${row.booth.code}: ${row.booth.name}`}
                >
                  {/* Top Illustration Area */}
                  <div className="org-booth-card-thumb">
                    <BoothIllustration
                      code={row.booth.code}
                      categoryCode={row.booth.categoryCode}
                      variant="card"
                    />
                  </div>

                  {/* Card Content - 3 Tiers Layout */}
                  <div className="org-booth-card-body">
                    {/* TIER 1: Code Pill (Left) + Status Badges (Right) */}
                    <div className="org-booth-card-tier-top">
                      <span className="org-booth-code-pill">{row.booth.code}</span>
                      <div className="org-booth-card-badges">
                        {row.enabled ? (
                          <span className="org-booth-status-chip is-enabled">
                            <Check size={12} aria-hidden="true" />
                            <span>Đang cho thuê</span>
                          </span>
                        ) : (
                          <span className="org-booth-status-chip is-disabled">
                            <Lock size={12} aria-hidden="true" />
                            <span>Chưa mở cho thuê</span>
                          </span>
                        )}

                        {hasAssignedOrHold && (
                          <span
                            className={`org-booth-sub-badge ${row.availability === 'ASSIGNED' ? 'is-assigned' : 'is-on-hold'}`}
                          >
                            {row.availability === 'ASSIGNED' ? 'Đã thuê' : 'Đang giữ chỗ'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TIER 2: Booth Name (2 lines clamp) + Category */}
                    <div className="org-booth-card-tier-middle">
                      <h3 className="org-booth-card-name" title={row.booth.name}>
                        {row.booth.name}
                      </h3>
                      <span className="org-booth-card-category">
                        {row.booth.categoryCode || 'TIÊU CHUẨN'}
                      </span>
                    </div>

                    {/* TIER 3: Price + Single Configure Action */}
                    <div className="org-booth-card-tier-footer">
                      <div className="org-booth-price-display">
                        <span className="org-booth-price-label">Giá trọn gói</span>
                        <strong className="org-booth-price-num">
                          {formatPriceVnd(row.rentalPrice)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="btn-org-booth-configure"
                        onClick={e => {
                          e.stopPropagation();
                          openDrawer(row);
                        }}
                        aria-label={`Cấu hình gian ${row.booth.code}`}
                      >
                        Cấu hình
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* 5. Pagination */}
          {totalPages > 1 && (
            <footer className="org-booth-pagination">
              <button
                type="button"
                className="org-booth-page-nav"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={activePage === 1}
                aria-label="Trang trước"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>

              <div className="org-booth-page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`org-booth-page-num ${pageNum === activePage ? 'is-active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                    aria-label={`Trang ${pageNum}`}
                    aria-current={pageNum === activePage ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="org-booth-page-nav"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={activePage === totalPages}
                aria-label="Trang sau"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </footer>
          )}
        </>
      )}

      {/* Render Drawer via React Portal */}
      {drawerPortal}
    </div>
  );
};
