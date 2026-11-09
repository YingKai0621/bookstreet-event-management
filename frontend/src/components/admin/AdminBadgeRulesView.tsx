import { Award, Edit2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { badgeAdminApi } from '../../services/badgeAdminApi';
import { ApiError } from '../../services/apiError';
import type { AdminBadge, AdminBadgeInput, RewardManagementPage } from '../../types/rewardManagement';
import { ListPagination } from '../ui/ListPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { ImageUrlField } from '../ui/ImageUrlField';
import { contentImageApi } from '../../services/contentImageApi';
import './AdminBadgeRulesView.css';

function message(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'BADGE_NAME_CONFLICT') return 'Tên huy hiệu đã được sử dụng. Vui lòng chọn tên khác.';
    if (error.code === 'BADGE_NOT_ACTIVE') return 'Huy hiệu đang tạm dừng. Hãy kích hoạt trước khi đồng bộ.';
    if (error.code === 'BADGE_NOT_FOUND') return 'Không tìm thấy huy hiệu. Hãy làm mới danh sách.';
    if (error.status === 403) return 'Bạn không có quyền quản lý huy hiệu hoặc phiên làm việc cần được tải lại.';
  }
  return error instanceof Error ? error.message : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
}

function inputOf(badge: AdminBadge): AdminBadgeInput {
  return { name: badge.name, description: badge.description, iconUrl: badge.iconUrl, requiredPoints: badge.requiredPoints, isActive: badge.isActive };
}

export function AdminBadgeRulesView() {
  const [catalog, setCatalog] = useState<{ key: string; data: RewardManagementPage<AdminBadge> | null; error: string } | null>(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [sort, setSort] = useState('');
  const [reload, setReload] = useState(0);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<AdminBadgeInput>({ name: '', description: null, iconUrl: null, requiredPoints: 10, isActive: false });
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(modalOpen, () => { if (!saving && !imageUploading) setModalOpen(false); });
  const requestKey = `${page}|${search}|${active}|${sort}|${reload}`;
  const loading = catalog?.key !== requestKey;
  const data = loading ? null : catalog.data;
  const loadError = loading ? '' : catalog.error;

  useEffect(() => {
    let current = true;
    badgeAdminApi.list({ page, size: 20, sort: sort || undefined, search: search || undefined, active: active === 'all' ? undefined : active === 'true' })
      .then(result => { if (current) setCatalog({ key: requestKey, data: result, error: '' }); })
      .catch(error => { if (current) setCatalog({ key: requestKey, data: null, error: message(error) }); });
    return () => { current = false; };
  }, [page, search, active, sort, reload, requestKey]);

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previous?.focus();
  }, [modalOpen]);

  function openCreate() {
    setEditing(null); setForm({ name: '', description: null, iconUrl: null, requiredPoints: 10, isActive: false });
    setFormError(''); setFieldErrors({}); setModalOpen(true);
  }

  async function edit(badge: AdminBadge) {
    setBusyId(badge.badgeId); setActionError('');
    try {
      const latest = await badgeAdminApi.detail(badge.badgeId);
      setEditing(latest.badgeId); setForm(inputOf(latest)); setFormError(''); setFieldErrors({}); setModalOpen(true);
    } catch (error) { setActionError(message(error)); }
    finally { setBusyId(null); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (imageUploading) return;
    setSaving(true); setFormError(''); setFieldErrors({});
    try {
      const result = editing === null ? await badgeAdminApi.create(form) : await badgeAdminApi.update(editing, form);
      setModalOpen(false); setReload(value => value + 1);
      setNotice(result.synchronizationTriggered ? `Đã lưu “${result.badge.name}” và bắt đầu đồng bộ phần thưởng. Làm mới để xem tiến độ.` : `Đã lưu “${result.badge.name}”.`);
    } catch (error) {
      setFormError(message(error));
      if (error instanceof ApiError) setFieldErrors(Object.fromEntries(error.fieldErrors.map(field => [field.field, field.message])));
    } finally { setSaving(false); }
  }

  async function toggle(badge: AdminBadge) {
    setBusyId(badge.badgeId); setActionError(''); setNotice('');
    try {
      const latest = await badgeAdminApi.detail(badge.badgeId);
      const result = await badgeAdminApi.update(badge.badgeId, { ...inputOf(latest), isActive: !latest.isActive });
      setNotice(result.synchronizationTriggered ? 'Đã kích hoạt huy hiệu và bắt đầu đồng bộ phần thưởng.' : 'Đã tạm dừng huy hiệu. Lịch sử đã đạt vẫn được giữ lại.');
      setReload(value => value + 1);
    } catch (error) { setActionError(message(error)); }
    finally { setBusyId(null); }
  }

  async function synchronize(badge: AdminBadge) {
    setBusyId(badge.badgeId); setActionError(''); setNotice('');
    try {
      const result = await badgeAdminApi.synchronize(badge.badgeId);
      setNotice(`“${badge.name}”: đã xét ${result.processedCount} người, cấp mới ${result.awardedCount} huy hiệu. ${result.completed ? 'Đã đồng bộ đầy đủ.' : `Còn ${result.remainingEligibleCount} người đủ điều kiện; hệ thống tiếp tục xử lý. Bạn có thể làm mới hoặc đồng bộ tiếp nếu bị gián đoạn.`}`);
      setReload(value => value + 1);
    } catch (error) { setActionError(`${message(error)} Có thể thử đồng bộ lại; các phần thưởng đã cấp sẽ được giữ nguyên.`); }
    finally { setBusyId(null); }
  }

  function submitSearch(event: FormEvent) { event.preventDefault(); setSearch(searchInput.trim()); setPage(0); }
  const fieldError = (field: string) => fieldErrors[field] ? <small className="badge-field-error" id={`badge-error-${field}`}>{fieldErrors[field]}</small> : null;

  return <div className="adm-badges-view badge-management">
    <div className="adm-page-header"><div><h1 className="adm-page-title workspace-page-title">Quản lý huy hiệu</h1><p className="adm-page-subtitle workspace-page-subtitle">Thiết lập ngưỡng điểm và đồng bộ huy hiệu cho người tham gia đủ điều kiện.</p></div>
      <div className="adm-page-header-actions"><button type="button" className="adm-btn adm-btn-secondary" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={16} /> Làm mới</button><button type="button" className="adm-btn adm-btn-primary" onClick={openCreate}><Plus size={16} /> Thêm huy hiệu</button></div></div>
    {notice && <div className="badge-notice" role="status">{notice}</div>}
    {actionError && <div className="badge-error" role="alert">{actionError}</div>}
    <div className="badge-catalog-filters">
      <SearchFieldLabel className="badge-search-group"><form onSubmit={submitSearch}><div className="badge-search-control"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Tìm huy hiệu" placeholder="Tìm theo tên huy hiệu" maxLength={100} value={searchInput} onChange={event => setSearchInput(event.target.value)} /></div><button type="submit" className="adm-btn adm-btn-secondary">Tìm kiếm</button></form></SearchFieldLabel>
      <label>Trạng thái<select value={active} onChange={event => { setActive(event.target.value); setPage(0); }}><option value="all">Tất cả</option><option value="true">Đang áp dụng</option><option value="false">Tạm dừng</option></select></label>
      <label>Sắp xếp<select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="">Mới tạo nhất</option><option value="name,asc">Tên A–Z</option><option value="requiredPoints,asc">Ngưỡng điểm tăng dần</option><option value="requiredPoints,desc">Ngưỡng điểm giảm dần</option><option value="updatedAt,desc">Mới cập nhật</option></select></label>
    </div>
    {loading && <p className="badge-empty" role="status">Đang tải huy hiệu...</p>}
    {loadError && <div className="badge-error" role="alert"><p>{loadError}</p><button className="adm-btn adm-btn-secondary" onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
    {!loading && !loadError && data && <>
      <div className="admin-section-caption"><div><h2>Danh sách huy hiệu</h2><p>Tiến độ được cập nhật khi tải danh sách hoặc làm mới.</p></div><span>{data.totalElements} huy hiệu</span></div>
      {data.content.length === 0 ? <div className="badge-empty"><Award size={32} /><h3>Chưa có huy hiệu phù hợp</h3><p>Thêm huy hiệu đầu tiên hoặc thay đổi bộ lọc.</p></div> : <div className="badge-catalog-grid">{data.content.map(badge => <article className="badge-catalog-card" key={badge.badgeId}>
        <div className="badge-card-heading">{badge.iconUrl ? <img src={badge.iconUrl} alt="" referrerPolicy="no-referrer" /> : <span className="badge-card-icon"><Award size={30} /></span>}<span className={`badge-state ${badge.isActive ? 'active' : ''}`}>{badge.isActive ? 'Đang áp dụng' : 'Tạm dừng'}</span></div>
        <h3>{badge.name}</h3><p className="badge-description">{badge.description || 'Chưa có mô tả.'}</p>
        <dl><div><dt>Ngưỡng điểm</dt><dd>{badge.requiredPoints.toLocaleString('vi-VN')}</dd></div><div><dt>Đã được cấp</dt><dd>{badge.awardedUserCount.toLocaleString('vi-VN')} người</dd></div><div><dt>Chờ đồng bộ</dt><dd>{badge.remainingEligibleCount.toLocaleString('vi-VN')} người</dd></div></dl>
        <p className={`badge-sync-state ${badge.remainingEligibleCount ? 'pending' : ''}`}>{!badge.isActive ? 'Tạm dừng cấp mới · giữ lịch sử đã đạt' : badge.remainingEligibleCount > 0 ? 'Còn người đủ điều kiện chưa nhận huy hiệu' : 'Đã đồng bộ theo ngưỡng hiện tại'}</p>
        <div className="badge-card-actions"><button type="button" className="adm-btn adm-btn-secondary" aria-label={`Sửa ${badge.name}`} onClick={() => void edit(badge)} disabled={busyId !== null}><Edit2 size={15} /> Sửa</button>
          <button type="button" className="adm-btn adm-btn-secondary" onClick={() => void toggle(badge)} disabled={busyId !== null}>{badge.isActive ? 'Tạm dừng' : 'Kích hoạt'}</button>
          {badge.isActive && <button type="button" className="adm-btn adm-btn-primary" onClick={() => void synchronize(badge)} disabled={busyId !== null}><RefreshCw size={15} />{busyId === badge.badgeId ? 'Đang xử lý...' : 'Đồng bộ phần thưởng'}</button>}</div>
      </article>)}</div>}
      <ListPagination page={page + 1} pages={data.totalPages} onPage={value => setPage(value - 1)} disabled={loading} />
    </>}
    {modalOpen && <div className="adm-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !saving && !imageUploading) setModalOpen(false); }}>
      <div className="adm-modal-content badge-editor" role="dialog" aria-modal="true" aria-labelledby="badge-editor-title" ref={dialogRef} onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
        if (!focusable?.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}><div className="adm-modal-header"><h2 className="adm-modal-title" id="badge-editor-title">{editing === null ? 'Thêm huy hiệu' : 'Chỉnh sửa huy hiệu'}</h2><button type="button" className="adm-modal-close" aria-label="Đóng" disabled={saving || imageUploading} onClick={() => setModalOpen(false)}><X size={22} /></button></div>
        <form onSubmit={event => void save(event)}><fieldset disabled={saving || imageUploading}><div className="adm-modal-body">
          <label className="adm-form-group">Tên huy hiệu<input className="adm-form-input" required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'badge-error-name' : undefined} />{fieldError('name')}</label>
          <div className="adm-form-row"><label className="adm-form-group">Ngưỡng điểm<input className="adm-form-input" type="number" min={1} max={2147483647} step={1} required value={Number.isNaN(form.requiredPoints) ? '' : form.requiredPoints} onChange={event => setForm({ ...form, requiredPoints: event.target.valueAsNumber })} />{fieldError('requiredPoints')}</label>
            <label className="adm-form-group">Trạng thái áp dụng<select className="adm-form-select" value={String(form.isActive)} onChange={event => setForm({ ...form, isActive: event.target.value === 'true' })}><option value="false">Tạm dừng</option><option value="true">Đang áp dụng</option></select>{fieldError('isActive')}</label></div>
          <label className="adm-form-group">Mô tả<textarea className="adm-form-textarea" rows={3} maxLength={1000} value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value || null })} />{fieldError('description')}</label>
          <ImageUrlField value={form.iconUrl || ''} onChange={iconUrl => setForm(current => ({ ...current, iconUrl: iconUrl || null }))} uploadFile={contentImageApi.uploadBadge} disabled={saving || imageUploading} onBusyChange={setImageUploading} />
          {fieldError('iconUrl')}
          <p className="adm-form-hint">Kích hoạt hoặc giảm ngưỡng điểm đang áp dụng sẽ tự đồng bộ cho người đủ điều kiện. Tăng ngưỡng hoặc tạm dừng vẫn giữ các huy hiệu đã đạt.</p>
          {formError && <div className="badge-error" role="alert">{formError}</div>}
        </div><div className="adm-modal-footer"><button type="button" className="adm-btn adm-btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button><button type="submit" className="adm-btn adm-btn-primary">{saving ? 'Đang lưu...' : 'Lưu huy hiệu'}</button></div></fieldset></form>
      </div>
    </div>}
  </div>;
}
