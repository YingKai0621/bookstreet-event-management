import { getPageCount, getPageOffset, toPageIndex, LIST_PAGE_SIZE } from '../../constants/pagination';
import { ListPagination } from '../ui/ListPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import {
  Building2,
  Check,
  Users,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { organizerApi } from '../../services/organizerApi';
import type {
  CreateOrganizerLocationRequest,
  OrganizerLocationResponse,
} from '../../types/activity';
import './OrganizerLocationManagementView.css';

type SharedLocationType = 'STAGE' | 'WORKSHOP' | 'AREA';
type LocationStatusFilter = 'all' | 'active' | 'inactive';

interface LocationForm {
  code: string;
  name: string;
  locationType: SharedLocationType;
  maxCapacity: string;
  description: string;
  active: boolean;
}

const PAGE_SIZE = LIST_PAGE_SIZE;
const DESCRIPTION_CHARACTER_LIMIT = 5000;
const CARD_DESCRIPTION_CHARACTER_LIMIT = 180;
const EMPTY_FORM: LocationForm = {
  code: '',
  name: '',
  locationType: 'STAGE',
  maxCapacity: '',
  description: '',
  active: true,
};

const TYPE_LABELS: Record<SharedLocationType, string> = {
  STAGE: 'Sân khấu',
  WORKSHOP: 'Phòng workshop',
  AREA: 'Khu vực',
};

function safeError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : '';
  if (!message || /JDBC|executing SQL|Hibernate|SQLException/i.test(message)) return fallback;
  return message;
}

function truncateCardDescription(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= CARD_DESCRIPTION_CHARACTER_LIMIT) return normalized;

  const candidate = normalized.slice(0, CARD_DESCRIPTION_CHARACTER_LIMIT);
  const lastSpace = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, lastSpace > 0 ? lastSpace : CARD_DESCRIPTION_CHARACTER_LIMIT).trimEnd()}…`;
}

export function OrganizerLocationManagementView() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrganizerLocationResponse[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [type, setType] = useState<SharedLocationType | ''>('');
  const [statusFilter, setStatusFilter] = useState<LocationStatusFilter>('all');
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<OrganizerLocationResponse | 'new' | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useModalDismiss(Boolean(editing), () => { if (!saving) setEditing(null); });

  useEffect(() => {
    let active = true;
    // The loading state follows this remote request lifecycle.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError('');
    const activeFilter = statusFilter === 'all' ? undefined : statusFilter === 'active';
    void organizerApi.listActivityLocations({
      page,
      size: PAGE_SIZE,
      sort: 'code,asc',
      type: type || undefined,
      active: activeFilter,
      search: deferredSearch || undefined,
    }).then(response => {
      if (!active) return;
      setRows(response.content);
      setTotalElements(response.totalElements);
      const lastPage = getPageCount(response.totalElements, PAGE_SIZE);
      if (page >= lastPage) setPage(toPageIndex(lastPage));
    }).catch(cause => {
      if (!active) return;
      setRows([]);
      setError(safeError(cause, 'Không tải được danh sách địa điểm. Vui lòng thử lại.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [deferredSearch, page, revision, statusFilter, type]);

  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setNotice('');
    setEditing('new');
  };

  const openEdit = (location: OrganizerLocationResponse) => {
    setForm({
      code: location.code,
      name: location.name,
      locationType: location.locationType as SharedLocationType,
      maxCapacity: String(location.maxCapacity),
      description: location.description || '',
      active: location.active,
    });
    setFormError('');
    setNotice('');
    setEditing(location);
  };

  const close = () => {
    if (saving) return;
    setEditing(null);
    setFormError('');
  };

  const setField = <K extends keyof LocationForm>(field: K, value: LocationForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setFormError('');
  };

  const validate = (): string => {
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim().replace(/\s+/g, ' ');
    const capacity = Number(form.maxCapacity);
    if (!/^[A-Z0-9_-]{1,30}$/.test(code)) return 'Mã gồm 1–30 ký tự A–Z, 0–9, dấu gạch ngang hoặc gạch dưới.';
    if (!name || name.length > 100) return 'Tên địa điểm phải có từ 1 đến 100 ký tự.';
    if (!Number.isInteger(capacity) || capacity < 1) return 'Sức chứa phải là số nguyên dương.';
    if (form.description.length > DESCRIPTION_CHARACTER_LIMIT) return 'Mô tả không được vượt quá 5.000 ký tự.';
    return '';
  };

  const save = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!editing || saving) return;
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const common = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim().replace(/\s+/g, ' '),
        description: form.description.trim() || null,
        maxCapacity: Number(form.maxCapacity),
      };
      if (editing === 'new') {
        const created = await organizerApi.createActivityLocation({
          ...common,
          locationType: form.locationType,
          mapX: null,
          mapY: null,
        } satisfies CreateOrganizerLocationRequest);
        setNotice('Đã thêm địa điểm tổ chức mới.');
        navigate(`/organizer/booths?view=map&locationId=${created.locationId}`);
      } else {
        await organizerApi.updateActivityLocation(editing.locationId, {
          ...common,
          active: form.active,
        });
        setNotice('Đã cập nhật địa điểm tổ chức.');
      }
      setEditing(null);
      setRevision(value => value + 1);
      window.dispatchEvent(new Event('duongsach:data-changed'));
    } catch (cause) {
      setFormError(safeError(cause, 'Không thể lưu địa điểm. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  };

  const hasFilters = Boolean(search.trim() || type || statusFilter !== 'all');
  const clearFilters = () => { setSearch(''); setType(''); setStatusFilter('all'); setPage(0); };


  return (
    <section className="org-dashboard organizer-location-page">
      <header className="org-dashboard-header venue-heading">
        <div>
          <h1 className="org-dashboard-title workspace-page-title">Địa điểm tổ chức</h1>
          <p className="org-dashboard-subtitle workspace-page-subtitle">Quản lý không gian tổ chức hoạt động tại đường sách.</p>
        </div>
        <button type="button" className="btn-org-primary" onClick={openCreate}><Plus size={18} />Thêm địa điểm</button>
      </header>

      {notice && <div className="venue-notice" role="status"><Check size={18} />{notice}</div>}
      <div className="org-dashboard-panel venue-panel" aria-busy={loading}>
        <div className="org-dashboard-panel-heading venue-list-heading">
          <div><h2>Danh sách địa điểm</h2><p>Tra cứu và cập nhật thông tin không gian dùng chung.</p></div>
          {hasFilters && <button type="button" className="org-dashboard-text-action" onClick={clearFilters}><X size={15} />Xóa bộ lọc</button>}
        </div>
        <div className="venue-toolbar organizer-location-toolbar">
          <SearchFieldLabel className="venue-search-group"><label className="venue-search"><Search size={18} /><input aria-label="Tìm địa điểm" placeholder="Tìm theo mã, tên hoặc mô tả…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label></SearchFieldLabel>
          <label className="venue-filter"><span>Loại địa điểm</span><select aria-label="Lọc loại địa điểm" value={type} onChange={event => { setType(event.target.value as SharedLocationType | ''); setPage(0); }}><option value="">Tất cả loại</option><option value="STAGE">Sân khấu</option><option value="WORKSHOP">Phòng workshop</option><option value="AREA">Khu vực</option></select></label>
          <label className="venue-filter"><span>Trạng thái</span><select aria-label="Lọc trạng thái" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as LocationStatusFilter); setPage(0); }}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Tạm ngưng</option></select></label>
          <button type="button" className="btn-org-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="Tải lại danh sách"><RefreshCw size={17} /></button>
        </div>

        {error ? <div className="venue-empty" role="alert"><p>{error}</p><button type="button" className="btn-org-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
          : loading ? <div className="venue-empty" role="status">Đang tải danh sách…</div>
            : rows.length === 0 ? <div className="venue-empty"><Building2 size={32} /><h3>{hasFilters ? 'Không tìm thấy địa điểm' : 'Chưa có địa điểm tổ chức'}</h3><p>{hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.' : 'Thêm địa điểm để bố trí không gian cho các hoạt động.'}</p><button type="button" className="btn-org-secondary" onClick={hasFilters ? clearFilters : openCreate}>{hasFilters ? 'Xóa bộ lọc' : 'Thêm địa điểm'}</button></div>
              : <div className="venue-table-scroll"><table className="venue-table booth-table">
                <caption className="venue-sr-only">Danh sách địa điểm tổ chức</caption>
                <thead><tr><th>Mã địa điểm</th><th>Tên địa điểm</th><th>Loại</th><th>Sức chứa</th><th>Trạng thái</th><th className="venue-actions">Thao tác</th></tr></thead>
                <tbody>{rows.map(location => <tr key={location.locationId}>
                  <td><span className="venue-code"><span className="venue-row-icon" aria-hidden="true"><Building2 size={15} /></span><strong>{location.code}</strong></span></td>
                  <td><div className="venue-name"><span><strong>{location.name}</strong>{location.description && <p className="venue-description">{truncateCardDescription(location.description)}</p>}</span></div></td>
                  <td data-label="Loại địa điểm"><span className="organizer-location-type">{TYPE_LABELS[location.locationType as SharedLocationType]}</span></td>
                  <td data-label="Sức chứa"><span className="venue-capacity"><Users size={14} /><strong>{location.maxCapacity.toLocaleString('vi-VN')}</strong><span>người</span></span></td>
                  <td data-label="Trạng thái"><span className={`organizer-location-status ${location.active ? 'is-active' : 'is-inactive'}`}><i />{location.active ? 'Đang hoạt động' : 'Tạm ngưng'}</span></td>
                  <td className="venue-action-cell"><div className="venue-row-actions"><button type="button" className="btn-booth-action edit" onClick={() => openEdit(location)} aria-label={`Sửa ${location.name}`} title="Chỉnh sửa"><Pencil size={15} /></button></div></td>
                </tr>)}</tbody>
              </table></div>}

        {!loading && !error && <footer className="venue-table-footer organizer-location-footer"><span>{totalElements === 0 ? '0 địa điểm' : `${getPageOffset(page + 1, PAGE_SIZE) + 1}–${getPageOffset(page + 1, PAGE_SIZE) + rows.length} trong ${totalElements} địa điểm`}</span><ListPagination page={page + 1} pages={getPageCount(totalElements, PAGE_SIZE)} onPage={value => setPage(toPageIndex(value))} /></footer>}
      </div>

      <dialog ref={dialog} className="venue-dialog organizer-location-dialog" aria-labelledby="location-dialog-title" onCancel={event => { event.preventDefault(); close(); }}>
        <form onSubmit={save}>
          <div className="org-dashboard-panel-heading venue-dialog-heading"><div><h2 id="location-dialog-title">{editing === 'new' ? 'Thêm địa điểm' : 'Chỉnh sửa địa điểm'}</h2><p>Thông tin dùng để sắp xếp địa điểm cho hoạt động.</p></div><button type="button" disabled={saving} className="venue-close" onClick={close} aria-label="Đóng"><X size={20} /></button></div>
          <div className="venue-fields organizer-location-fields">
            <label>Mã địa điểm <span>*</span><input autoFocus required maxLength={30} value={form.code} onChange={event => setField('code', event.target.value.toUpperCase())} placeholder="Ví dụ: STAGE-A" /><small>Chỉ dùng A–Z, 0–9, dấu “-” hoặc “_”.</small></label>
            <label>Tên địa điểm <span>*</span><input required maxLength={100} value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Ví dụ: Sân khấu trung tâm" /></label>
            <div className="organizer-location-details organizer-location-wide">
            <label>Loại địa điểm <span>*</span><select required disabled={editing !== 'new'} value={form.locationType} onChange={event => setField('locationType', event.target.value as SharedLocationType)}><option value="STAGE">Sân khấu</option><option value="WORKSHOP">Phòng workshop</option><option value="AREA">Khu vực</option></select><small>Không thể đổi loại sau khi đã tạo.</small></label>
            <label>Trạng thái <span>*</span><select value={String(form.active)} onChange={event => setField('active', event.target.value === 'true')}><option value="true">Đang hoạt động</option><option value="false">Tạm ngưng</option></select></label>
            <label>Sức chứa tối đa <span>*</span><input type="number" required min="1" step="1" value={form.maxCapacity} onChange={event => setField('maxCapacity', event.target.value)} placeholder="Ví dụ: 120" /></label>
            </div>
            <label className="organizer-location-wide">Mô tả<textarea rows={4} maxLength={DESCRIPTION_CHARACTER_LIMIT} value={form.description} onChange={event => setField('description', event.target.value)} placeholder="Mô tả vị trí, tiện ích hoặc lưu ý sử dụng…" /><small>{form.description.length.toLocaleString('vi-VN')}/{DESCRIPTION_CHARACTER_LIMIT.toLocaleString('vi-VN')} ký tự</small></label>
          </div>
          {formError && <p className="venue-error" role="alert">{formError}</p>}
          <div className="venue-dialog-footer">
            {editing && editing !== 'new' && <button type="button" className="btn-org-secondary" disabled={saving} onClick={() => navigate(`/organizer/booths?view=map&locationId=${editing.locationId}`)}><MapPin size={16} />Đặt vị trí trên bản đồ</button>}
            <button type="button" className="btn-org-secondary" disabled={saving} onClick={close}>Hủy</button><button type="submit" className="btn-org-primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu địa điểm'}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
