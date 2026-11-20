import { Building2, Eye, Lock, RefreshCw, Search, Unlock, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  adminOrganizationError,
  adminOrganizationsApi,
  isValidOrganizationReason,
  normalizeOrganizationReason,
  type AdminOrganizationSort,
  type AdminOrganizationStatus,
  type AdminPartnerOrganization,
} from '../../services/adminOrganizationsApi';
import { CompactPagination } from '../ui/CompactPagination';
import './AdminOrganizations.css';

const PAGE_SIZE = 20;
const SORT_LABELS: Record<AdminOrganizationSort, string> = {
  'name,asc': 'Tên A → Z',
  'name,desc': 'Tên Z → A',
  'createdAt,desc': 'Mới tạo trước',
  'createdAt,asc': 'Cũ nhất trước',
};

const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

export const AdminOrganizationsView: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminOrganizationStatus | ''>('');
  const [sort, setSort] = useState<AdminOrganizationSort>('name,asc');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<AdminPartnerOrganization[]>([]);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AdminPartnerOrganization | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [statusTarget, setStatusTarget] = useState<AdminPartnerOrganization | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const closeDialogs = () => {
    if (submitting) return;
    setDetail(null);
    setStatusTarget(null);
    setReason('');
    setDetailError('');
    setActionError('');
  };
  useModalDismiss(detail !== null || statusTarget !== null, closeDialogs);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return undefined;
    const timer = window.setTimeout(() => {
      setSearch(next);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    adminOrganizationsApi.list({ page, size: PAGE_SIZE, search: search || undefined, status: status || undefined, sort })
      .then(result => {
        if (!active) return;
        if (!Array.isArray(result.content)) throw new Error('Invalid organization response');
        setItems(result.content);
        setPages(result.totalPages);
        setTotal(result.totalElements);
      })
      .catch(cause => {
        if (!active) return;
        setItems([]);
        setPages(0);
        setTotal(0);
        setError(adminOrganizationError(cause, 'Không tải được danh sách tổ chức. Vui lòng thử lại.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, revision, search, sort, status]);

  const hasFilters = Boolean(search || status);

  const openDetail = async (organization: AdminPartnerOrganization) => {
    setDetail(organization);
    setDetailLoading(true);
    setDetailError('');
    try {
      setDetail(await adminOrganizationsApi.detail(organization.partnerOrganizationId));
    } catch (cause) {
      setDetailError(adminOrganizationError(cause, 'Không tải được chi tiết tổ chức.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openStatus = (organization: AdminPartnerOrganization) => {
    setStatusTarget(organization);
    setReason('');
    setActionError('');
    setNotice('');
  };

  const submitStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusTarget) return;
    if (!isValidOrganizationReason(reason)) {
      setActionError('Lý do cần có từ 10 đến 500 ký tự.');
      return;
    }
    const nextStatus: AdminOrganizationStatus = statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setSubmitting(true);
    setActionError('');
    try {
      const updated = await adminOrganizationsApi.changeStatus(
        statusTarget.partnerOrganizationId,
        nextStatus,
        normalizeOrganizationReason(reason),
      );
      setItems(current => current.map(item => item.partnerOrganizationId === updated.partnerOrganizationId ? updated : item));
      setDetail(current => current?.partnerOrganizationId === updated.partnerOrganizationId ? updated : current);
      setStatusTarget(null);
      setReason('');
      setNotice(`Đã ${nextStatus === 'INACTIVE' ? 'khóa' : 'mở khóa'} tổ chức ${updated.name}.`);
      setRevision(value => value + 1);
    } catch (cause) {
      setActionError(adminOrganizationError(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="adm-organizations-view">
    <div className="adm-page-header">
      <div>
        <h1 className="adm-page-title workspace-page-title">Tổ chức đối tác</h1>
        <p className="adm-page-subtitle workspace-page-subtitle">Xem hồ sơ và kiểm soát quyền tạo công việc mới của tổ chức đối tác.</p>
      </div>
      <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setRevision(value => value + 1)} disabled={loading}>
        <RefreshCw size={16} /> Làm mới
      </button>
    </div>

    {notice && <p className="adm-notice-card" role="status">{notice}</p>}

    <div className="admin-card adm-filter-card">
      <div className="adm-filter-bar">
        <label className="adm-search-group">
          <span className="sr-only">Tìm tổ chức hoặc người đại diện</span>
          <Search size={17} />
          <input className="adm-filter-search" type="search" value={searchInput} maxLength={100}
            placeholder="Tìm tên tổ chức, tài khoản hoặc người đại diện"
            onChange={event => setSearchInput(event.target.value)} />
        </label>
        <label className="adm-status-field">
          <span className="sr-only">Lọc trạng thái tổ chức</span>
          <select className="adm-filter-select" value={status} onChange={event => { setStatus(event.target.value as AdminOrganizationStatus | ''); setPage(0); }}>
            <option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Đã khóa</option>
          </select>
        </label>
        <label className="adm-status-field">
          <span className="sr-only">Sắp xếp tổ chức</span>
          <select className="adm-filter-select" value={sort} onChange={event => { setSort(event.target.value as AdminOrganizationSort); setPage(0); }}>
            {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </div>

    <div className="admin-card adm-table-card">
      {loading ? <div className="adm-table-empty" role="status">Đang tải danh sách tổ chức…</div>
        : error ? <div className="adm-table-empty" role="alert"><p>{error}</p><button className="adm-btn adm-btn-secondary" type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
          : items.length === 0 ? <div className="adm-table-empty"><Building2 size={28} /><p>{hasFilters ? 'Không có tổ chức phù hợp với bộ lọc.' : 'Chưa có tổ chức đối tác nào.'}</p></div>
            : <>
              <div className="adm-table-summary">Có <strong>{total}</strong> tổ chức phù hợp</div>
              <div className="adm-table-responsive"><table className="adm-table">
                <thead><tr><th>TỔ CHỨC</th><th>NGƯỜI ĐẠI DIỆN</th><th>LIÊN HỆ</th><th>TRẠNG THÁI</th><th className="adm-th-actions">THAO TÁC</th></tr></thead>
                <tbody>{items.map(organization => <tr key={organization.partnerOrganizationId} className={organization.status === 'INACTIVE' ? 'adm-row-locked' : ''}>
                  <td><strong>{organization.name}</strong><div className="adm-user-code">{organization.categoryCode} · ID {organization.partnerOrganizationId}</div></td>
                  <td><strong>{organization.representative.fullName}</strong><div className="adm-user-code">@{organization.representative.username}</div></td>
                  <td><div>{organization.contactEmail || 'Chưa có email'}</div><div className="adm-user-code">{organization.contactPhone || 'Chưa có số điện thoại'}</div></td>
                  <td><span className={`adm-badge-status ${organization.status === 'ACTIVE' ? 'badge-status-active' : 'badge-status-locked'}`}><span className="adm-status-dot" />{organization.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
                  <td className="adm-td-actions"><div className="adm-action-buttons">
                    <button type="button" className="adm-icon-btn" aria-label={`Xem chi tiết ${organization.name}`} onClick={() => void openDetail(organization)}><Eye size={15} /></button>
                    <button type="button" className={`adm-icon-btn ${organization.status === 'ACTIVE' ? 'btn-lock' : 'btn-unlock'}`} aria-label={`${organization.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'} ${organization.name}`} onClick={() => openStatus(organization)}>{organization.status === 'ACTIVE' ? <Lock size={15} /> : <Unlock size={15} />}</button>
                  </div></td>
                </tr>)}</tbody>
              </table></div>
            </>}
    </div>
    {!loading && !error && pages > 1 && <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} />}

    {detail && <div className="adm-modal-overlay" onClick={closeDialogs}><section className="adm-modal-content adm-org-detail" role="dialog" aria-modal="true" aria-labelledby="admin-org-detail-title" onClick={event => event.stopPropagation()}>
      <div className="adm-modal-header"><h3 id="admin-org-detail-title" className="adm-modal-title">Chi tiết tổ chức</h3><button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialogs}><X size={18} /></button></div>
      <div className="adm-modal-body">{detailLoading ? <p role="status">Đang tải chi tiết…</p> : detailError ? <p className="adm-form-error" role="alert">{detailError}</p> : <dl className="adm-org-detail-grid">
        <dt>Tên tổ chức</dt><dd>{detail.name}</dd><dt>Trạng thái</dt><dd>{detail.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</dd>
        <dt>Mô tả</dt><dd>{detail.description || 'Chưa cập nhật'}</dd><dt>Danh mục</dt><dd>{detail.categoryCode}</dd>
        <dt>Người đại diện</dt><dd>{detail.representative.fullName} (@{detail.representative.username})</dd><dt>Vai trò Đối tác</dt><dd>{detail.representative.hasPartnerRole ? 'Có' : 'Không'}</dd>
        <dt>Email</dt><dd>{detail.contactEmail || 'Chưa cập nhật'}</dd><dt>Điện thoại</dt><dd>{detail.contactPhone || 'Chưa cập nhật'}</dd>
        <dt>Địa chỉ</dt><dd>{detail.address || 'Chưa cập nhật'}</dd><dt>Cập nhật</dt><dd>{formatDate(detail.updatedAt)}</dd>
      </dl>}</div>
      <div className="adm-modal-footer"><button type="button" className="adm-btn adm-btn-secondary" onClick={closeDialogs}>Đóng</button><button type="button" className="adm-btn adm-btn-primary" onClick={() => { setDetail(null); openStatus(detail); }}>{detail.status === 'ACTIVE' ? 'Khóa tổ chức' : 'Mở khóa tổ chức'}</button></div>
    </section></div>}

    {statusTarget && <div className="adm-modal-overlay" onClick={closeDialogs}><section className="adm-modal-content adm-dialog-content" role="dialog" aria-modal="true" aria-labelledby="admin-org-status-title" onClick={event => event.stopPropagation()}>
      <div className="adm-modal-header"><h3 id="admin-org-status-title" className="adm-modal-title">{statusTarget.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'} {statusTarget.name}</h3><button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialogs}><X size={18} /></button></div>
      <form onSubmit={submitStatus}><div className="adm-modal-body"><p className="adm-confirm-text">{statusTarget.status === 'ACTIVE' ? 'Tổ chức sẽ không thể tạo công việc mới; dữ liệu hiện có vẫn được giữ nguyên.' : 'Tổ chức sẽ được phép tạo công việc mới trở lại.'}</p>
        <div className="adm-form-group"><label className="adm-form-label" htmlFor="admin-org-reason">Lý do *</label><textarea id="admin-org-reason" className="adm-form-textarea" rows={4} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} required /><small className="adm-form-hint">Từ 10 đến 500 ký tự.</small></div>
        {actionError && <p className="adm-form-error" role="alert">{actionError}</p>}
      </div><div className="adm-modal-footer"><button type="button" className="adm-btn adm-btn-secondary" disabled={submitting} onClick={closeDialogs}>Hủy</button><button type="submit" className="adm-btn adm-btn-primary" disabled={submitting || !isValidOrganizationReason(reason)}>{submitting ? 'Đang lưu…' : 'Xác nhận'}</button></div></form>
    </section></div>}
  </div>;
};
