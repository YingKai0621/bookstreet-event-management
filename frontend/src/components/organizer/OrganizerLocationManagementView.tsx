import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { organizerApi } from '../../services/organizerApi';
import type {
  CreateOrganizerLocationRequest,
  OrganizerLocationResponse,
} from '../../types/activity';
import '../admin/FacilityManagementView.css';
import './OrganizerLocationManagementView.css';

type SharedLocationType = 'STAGE' | 'WORKSHOP' | 'AREA';
type LocationStatusFilter = 'all' | 'active' | 'inactive';

interface LocationForm {
  code: string;
  name: string;
  locationType: SharedLocationType;
  maxCapacity: string;
  description: string;
  mapX: string;
  mapY: string;
  active: boolean;
}

const PAGE_SIZE = 10;
const EMPTY_FORM: LocationForm = {
  code: '',
  name: '',
  locationType: 'STAGE',
  maxCapacity: '',
  description: '',
  mapX: '',
  mapY: '',
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

function nullableCoordinate(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

export function OrganizerLocationManagementView() {
  const [rows, setRows] = useState<OrganizerLocationResponse[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [type, setType] = useState<SharedLocationType | ''>('');
  const [statusFilter, setStatusFilter] = useState<LocationStatusFilter>('all');
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
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
      setTotalPages(response.totalPages);
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
      mapX: location.mapX === null ? '' : String(location.mapX),
      mapY: location.mapY === null ? '' : String(location.mapY),
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
    if (form.description.trim().length > 5000) return 'Mô tả không được vượt quá 5.000 ký tự.';
    for (const [label, value] of [['X', form.mapX], ['Y', form.mapY]]) {
      if (value.trim() === '') continue;
      const coordinate = Number(value);
      if (!Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100) return `Tọa độ ${label} phải nằm trong khoảng 0–100.`;
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(value.trim())) return `Tọa độ ${label} chỉ được có tối đa 2 chữ số thập phân.`;
    }
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
        mapX: nullableCoordinate(form.mapX),
        mapY: nullableCoordinate(form.mapY),
      };
      if (editing === 'new') {
        await organizerApi.createActivityLocation({
          ...common,
          locationType: form.locationType,
        } satisfies CreateOrganizerLocationRequest);
        setNotice('Đã thêm địa điểm tổ chức mới.');
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

  const currentCapacity = rows.reduce((sum, row) => sum + row.maxCapacity, 0);

  return (
    <section className="facility-page organizer-location-page">
      <header className="facility-heading">
        <div>
          <span className="facility-eyebrow">HOẠT ĐỘNG / KHÔNG GIAN DÙNG CHUNG</span>
          <h1>Địa điểm tổ chức</h1>
          <p>Quản lý sân khấu, phòng workshop và khu vực dùng chung cho các hoạt động.</p>
        </div>
        <button type="button" className="facility-button primary" onClick={openCreate}><Plus size={18} />Thêm địa điểm</button>
      </header>

      <div className="facility-summary">
        <div className="facility-stat"><span className="facility-stat-icon"><Building2 size={24} /></span><div><span>Tổng trong danh mục</span><strong>{loading || error ? '—' : totalElements}<small>địa điểm</small></strong></div></div>
        <div className="facility-stat"><span className="facility-stat-icon gold"><Users size={24} /></span><div><span>Sức chứa trên trang hiện tại</span><strong>{loading || error ? '—' : currentCapacity.toLocaleString('vi-VN')}<small>người</small></strong></div></div>
      </div>

      {notice && <div className="facility-notice" role="status">{notice}</div>}
      <div className="facility-panel">
        <div className="facility-toolbar organizer-location-toolbar">
          <label className="facility-search"><Search size={18} /><input aria-label="Tìm địa điểm" placeholder="Tìm theo mã, tên hoặc mô tả…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
          <label className="facility-filter"><MapPin size={17} /><select aria-label="Lọc loại địa điểm" value={type} onChange={event => { setType(event.target.value as SharedLocationType | ''); setPage(0); }}><option value="">Tất cả loại</option><option value="STAGE">Sân khấu</option><option value="WORKSHOP">Phòng workshop</option><option value="AREA">Khu vực</option></select></label>
          <label className="facility-filter"><select aria-label="Lọc trạng thái" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as LocationStatusFilter); setPage(0); }}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Tạm ngưng</option></select></label>
          <button type="button" className="facility-button" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="Tải lại danh sách"><RefreshCw size={17} /></button>
        </div>

        {error ? <div className="facility-empty" role="alert"><p>{error}</p><button type="button" className="facility-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
          : loading ? <div className="facility-empty" role="status">Đang tải danh sách…</div>
            : rows.length === 0 ? <div className="facility-empty"><Building2 size={38} /><h3>Không có địa điểm phù hợp</h3><p>Thử thay đổi từ khóa hoặc bộ lọc đang chọn.</p><button type="button" className="facility-button" onClick={() => { setSearch(''); setType(''); setStatusFilter('all'); setPage(0); }}>Xóa bộ lọc</button></div>
              : <div className="facility-table-scroll"><table><caption className="facility-sr-only">Danh sách địa điểm tổ chức</caption><thead><tr><th>Mã và tên</th><th>Loại</th><th>Sức chứa</th><th>Vị trí bản đồ</th><th>Trạng thái</th><th className="facility-actions">Thao tác</th></tr></thead><tbody>{rows.map(location => <tr key={location.locationId}><td><div className="facility-name"><span className="facility-row-icon"><Building2 size={19} /></span><span><strong>{location.name}</strong><small>{location.code}</small></span></div></td><td><span className="organizer-location-type">{TYPE_LABELS[location.locationType as SharedLocationType]}</span></td><td><span className="facility-quantity">{location.maxCapacity.toLocaleString('vi-VN')}</span> <span className="facility-muted">người</span></td><td>{location.mapX === null || location.mapY === null ? <span className="facility-muted">Chưa đặt</span> : `${location.mapX}, ${location.mapY}`}</td><td><span className={`organizer-location-status ${location.active ? 'is-active' : 'is-inactive'}`}><i />{location.active ? 'Đang hoạt động' : 'Tạm ngưng'}</span></td><td><div className="facility-row-actions"><button type="button" onClick={() => openEdit(location)} aria-label={`Sửa ${location.name}`} title="Chỉnh sửa"><Pencil size={17} /></button></div></td></tr>)}</tbody></table></div>}

        {!loading && !error && <footer className="facility-table-footer organizer-location-footer"><span>Hiển thị {rows.length} / {totalElements} địa điểm</span>{totalPages > 1 && <div><button type="button" onClick={() => setPage(value => value - 1)} disabled={page === 0}><ChevronLeft size={17} /></button><span>Trang {page + 1}/{totalPages}</span><button type="button" onClick={() => setPage(value => value + 1)} disabled={page >= totalPages - 1}><ChevronRight size={17} /></button></div>}</footer>}
      </div>

      <dialog ref={dialog} className="facility-dialog organizer-location-dialog" aria-labelledby="location-dialog-title" onCancel={event => { event.preventDefault(); close(); }}>
        <form onSubmit={save}>
          <div className="facility-dialog-heading"><div><span className="facility-eyebrow">KHÔNG GIAN HOẠT ĐỘNG</span><h2 id="location-dialog-title">{editing === 'new' ? 'Thêm địa điểm' : 'Chỉnh sửa địa điểm'}</h2></div><button type="button" disabled={saving} className="facility-close" onClick={close} aria-label="Đóng"><X size={20} /></button></div>
          <div className="facility-fields organizer-location-fields">
            <label>Mã địa điểm <span>*</span><input autoFocus required maxLength={30} value={form.code} onChange={event => setField('code', event.target.value.toUpperCase())} placeholder="Ví dụ: STAGE-A" /><small>Chỉ dùng A–Z, 0–9, dấu “-” hoặc “_”.</small></label>
            <label>Tên địa điểm <span>*</span><input required maxLength={100} value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Ví dụ: Sân khấu trung tâm" /></label>
            <label>Loại địa điểm <span>*</span><select required disabled={editing !== 'new'} value={form.locationType} onChange={event => setField('locationType', event.target.value as SharedLocationType)}><option value="STAGE">Sân khấu</option><option value="WORKSHOP">Phòng workshop</option><option value="AREA">Khu vực</option></select><small>Không thể đổi loại sau khi đã tạo.</small></label>
            <label>Sức chứa tối đa <span>*</span><input type="number" required min="1" step="1" value={form.maxCapacity} onChange={event => setField('maxCapacity', event.target.value)} placeholder="Ví dụ: 120" /></label>
            <label>Tọa độ X<input type="number" min="0" max="100" step="0.01" value={form.mapX} onChange={event => setField('mapX', event.target.value)} placeholder="0–100" /></label>
            <label>Tọa độ Y<input type="number" min="0" max="100" step="0.01" value={form.mapY} onChange={event => setField('mapY', event.target.value)} placeholder="0–100" /></label>
            <label className="organizer-location-wide">Mô tả<textarea maxLength={5000} rows={4} value={form.description} onChange={event => setField('description', event.target.value)} placeholder="Mô tả vị trí, tiện ích hoặc lưu ý sử dụng…" /><small>{form.description.length}/5000</small></label>
            {editing !== 'new' && <label className="organizer-location-active organizer-location-wide"><input type="checkbox" checked={form.active} onChange={event => setField('active', event.target.checked)} /><span><strong>Cho phép sử dụng địa điểm</strong><small>Không thể tạm ngưng nếu địa điểm đang được một hoạt động hiện tại hoặc tương lai sử dụng.</small></span></label>}
          </div>
          {formError && <p className="facility-error" role="alert">{formError}</p>}
          <div className="facility-dialog-footer"><button type="button" className="facility-button" disabled={saving} onClick={close}>Hủy</button><button type="submit" className="facility-button primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu địa điểm'}</button></div>
        </form>
      </dialog>
    </section>
  );
}
