import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  Lock,
  Mail,
  MailWarning,
  Phone,
  RefreshCw,
  Search,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import {
  ADMIN_ACCOUNT_STATUS_LABELS,
  ADMIN_ROLE_CODES,
  ADMIN_ROLE_LABELS,
  adminUserErrorMessage,
  adminUserInitials,
  adminUsersApi,
  isValidAdminReason,
  normalizeAdminReason,
  type AdminAccountStatus,
  type AdminRoleCode,
  type AdminUser,
  type AdminUserSort,
} from '../../services/adminUsersApi';
import { CompactPagination } from '../ui/CompactPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import './AdminAccounts.css';
import {
  confirmPasswordError,
  emailError,
  fullNameError,
  normalizeFullName,
  passwordError,
  phoneError,
  serverFieldErrors,
  usernameError,
  withoutEmpty,
  type AccountField,
  type AccountFieldErrors,
} from './adminAccountValidation';

const PAGE_SIZE = 20;
const SORT_LABELS: Record<AdminUserSort, string> = {
  'createdAt,desc': 'Mới tạo trước',
  'createdAt,asc': 'Cũ nhất trước',
  'username,asc': 'Tên đăng nhập A → Z',
  'username,desc': 'Tên đăng nhập Z → A',
};

const ROLE_BADGE_CLASS: Record<AdminRoleCode, string> = {
  PARTICIPANT: 'badge-role-participant',
  PARTNER: 'badge-role-partner',
  ORGANIZER: 'badge-role-organizer',
  ADMIN: 'badge-role-admin',
};

interface Filters {
  search: string;
  role: AdminRoleCode | '';
  status: AdminAccountStatus | '';
  sort: AdminUserSort;
}

const NO_FILTERS: Filters = { search: '', role: '', status: '', sort: 'createdAt,desc' };

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền xem danh sách tài khoản.';
  if (error instanceof ApiError && error.status === 400) return 'Bộ lọc chưa hợp lệ. Vui lòng kiểm tra lại.';
  return 'Không tải được danh sách tài khoản. Vui lòng thử lại.';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
}

interface CreateForm {
  username: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
}

const EMPTY_CREATE: CreateForm = { username: '', fullName: '', password: '', confirmPassword: '', email: '', phone: '' };

function createFormErrors(form: CreateForm): AccountFieldErrors {
  return withoutEmpty({
    username: usernameError(form.username),
    fullName: fullNameError(form.fullName),
    password: passwordError(form.password),
    confirmPassword: confirmPasswordError(form.password, form.confirmPassword),
    email: emailError(form.email),
    phone: phoneError(form.phone),
  });
}

/** Shows a field's error under the input and links it for screen readers. */
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <small id={id} className="adm-field-error">{message}</small> : null;
}

function fieldProps(errors: AccountFieldErrors, field: AccountField, id: string) {
  return {
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${id}-error` : undefined,
  };
}

const REASON_MIN = 10;
const REASON_MAX = 500;

export const AdminUserManagementView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.userId;

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '' });
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [createErrors, setCreateErrors] = useState<AccountFieldErrors>({});
  const [editErrors, setEditErrors] = useState<AccountFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const closeDialogs = () => {
    if (submitting) return;
    setCreateOpen(false);
    setEditTarget(null);
    setStatusTarget(null);
    setActionError('');
    setCreateErrors({});
    setEditErrors({});
  };
  useModalDismiss(createOpen || editTarget !== null || statusTarget !== null, closeDialogs);

  // Search is sent to the server after a short pause so that each keystroke does not start a request.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === filters.search) return undefined;
    const timer = window.setTimeout(() => {
      setFilters(current => ({ ...current, search: next }));
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search]);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Filter and page changes intentionally start a server refresh.
    setLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect -- A new request replaces any earlier failure.
    setError('');
    adminUsersApi.list({
      page,
      size: PAGE_SIZE,
      search: filters.search || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      sort: filters.sort,
    }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.content)) throw new Error('Invalid account response');
      setItems(result.content);
      setPages(result.totalPages);
      setTotal(result.totalElements);
    }).catch(cause => {
      if (!active) return;
      setItems([]);
      setPages(0);
      setTotal(0);
      setError(loadErrorMessage(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [filters, page, revision]);

  const changeFilter = (changes: Partial<Filters>) => {
    setFilters(current => ({ ...current, ...changes }));
    setPage(0);
  };
  const hasFilters = Boolean(filters.search || filters.role || filters.status);

  const replaceRow = (updated: AdminUser) => {
    setItems(current => current.map(item => (item.userId === updated.userId ? updated : item)));
  };

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateErrors({});
    setActionError('');
    setNotice('');
    setCreateOpen(true);
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = createFormErrors(createForm);
    setCreateErrors(invalid);
    setActionError('');
    if (Object.keys(invalid).length > 0) return;
    setSubmitting(true);
    try {
      const created = await adminUsersApi.create({
        username: createForm.username.trim(),
        fullName: normalizeFullName(createForm.fullName),
        password: createForm.password,
        confirmPassword: createForm.confirmPassword,
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      setNotice(created.email
        ? `Đã tạo tài khoản ${created.username}. Email xác minh đã được gửi tới ${created.email}. Hãy trao mật khẩu ban đầu cho người dùng qua kênh riêng.`
        : `Đã tạo tài khoản ${created.username}. Hãy trao mật khẩu ban đầu cho người dùng qua kênh riêng.`);
      setRevision(value => value + 1);
    } catch (cause) {
      const fields = serverFieldErrors(cause);
      setCreateErrors(fields);
      if (Object.keys(fields).length === 0) {
        setActionError(adminUserErrorMessage(cause, 'Không tạo được tài khoản. Vui lòng thử lại.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (target: AdminUser) => {
    setEditTarget(target);
    setEditForm({ fullName: target.fullName, phone: target.phone ?? '', email: target.email ?? '' });
    setEditErrors({});
    setActionError('');
    setNotice('');
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;
    const fullName = normalizeFullName(editForm.fullName);
    const invalid = withoutEmpty({
      fullName: fullNameError(editForm.fullName),
      phone: phoneError(editForm.phone),
      // An existing email can be replaced but not removed: the API has no way to clear it.
      email: editTarget.emailVerified ? '' : emailError(editForm.email, Boolean(editTarget.email)),
    });
    setEditErrors(invalid);
    setActionError('');
    if (Object.keys(invalid).length > 0) return;
    const changes: { fullName?: string; phone?: string; email?: string } = {};
    if (fullName !== editTarget.fullName) changes.fullName = fullName;
    if (editForm.phone.trim() !== (editTarget.phone ?? '')) changes.phone = editForm.phone.trim();
    if (!editTarget.emailVerified && editForm.email.trim() && editForm.email.trim() !== (editTarget.email ?? '')) {
      changes.email = editForm.email.trim();
    }
    if (Object.keys(changes).length === 0) {
      setEditTarget(null);
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      const updated = await adminUsersApi.update(editTarget.userId, changes);
      replaceRow(updated);
      setEditTarget(null);
      setNotice(changes.email
        ? `Đã cập nhật tài khoản ${updated.username}. Email xác minh mới sẽ được gửi tới ${updated.email}.`
        : `Đã cập nhật tài khoản ${updated.username}.`);
    } catch (cause) {
      const fields = serverFieldErrors(cause);
      setEditErrors(fields);
      if (Object.keys(fields).length === 0) {
        setActionError(adminUserErrorMessage(cause, 'Không lưu được thay đổi. Vui lòng thử lại.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openStatus = (target: AdminUser) => {
    setStatusTarget(target);
    setReason('');
    setActionError('');
    setNotice('');
  };

  const submitStatus = async () => {
    if (!statusTarget) return;
    if (!isValidAdminReason(reason)) {
      setActionError(`Lý do cần có từ ${REASON_MIN} đến ${REASON_MAX} ký tự.`);
      return;
    }
    const nextStatus: AdminAccountStatus = statusTarget.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    setSubmitting(true);
    setActionError('');
    try {
      const updated = await adminUsersApi.updateStatus(statusTarget.userId, nextStatus, normalizeAdminReason(reason));
      replaceRow(updated);
      if (filters.status && filters.status !== updated.status) setRevision(value => value + 1);
      setStatusTarget(null);
      setNotice(updated.status === 'DISABLED'
        ? `Đã khóa tài khoản ${updated.username}. Các phiên đăng nhập hiện có không còn sử dụng được.`
        : `Đã mở khóa tài khoản ${updated.username}. Người dùng cần đăng nhập lại.`);
    } catch (cause) {
      setActionError(adminUserErrorMessage(cause, 'Không đổi được trạng thái tài khoản. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Counted the way the server counts it: surrounding and repeated spaces do not count.
  const reasonLength = Array.from(normalizeAdminReason(reason)).length;

  const lockBlockedReason = (target: AdminUser): string => {
    if (target.status === 'ACTIVE' && target.userId === currentUserId) return 'Bạn không thể tự khóa tài khoản của mình.';
    return '';
  };

  return (
    <div className="adm-users-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Quản lý Tài khoản</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Tra cứu, tạo, cập nhật và khóa hoặc mở khóa tài khoản người dùng. Vai trò được quản lý ở trang Vai trò.
          </p>
        </div>
        <div className="adm-page-header-actions">
          <button type="button" className="adm-btn adm-btn-primary" onClick={openCreate}>
            <UserPlus size={16} />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="adm-card adm-notice-card" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      <div className="adm-card adm-filter-card">
        <div className="adm-filter-bar">
          <SearchFieldLabel className="adm-search-group">
            <div className="adm-search-input-wrap">
              <Search size={16} className="adm-search-icon" />
              <input
                type="text"
                aria-label="Tìm tài khoản"
                placeholder="Tìm theo tên đăng nhập, họ tên hoặc email..."
                maxLength={100}
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                className="adm-filter-search"
              />
              {searchInput && (
                <button type="button" className="adm-search-clear" aria-label="Xóa từ khóa" onClick={() => setSearchInput('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </SearchFieldLabel>

          <WorkspaceFieldLabel className="adm-status-field" label="Vai trò">
            <div className="adm-select-wrap">
              <Filter size={14} />
              <select
                aria-label="Lọc theo vai trò"
                className="adm-filter-select"
                value={filters.role}
                onChange={event => changeFilter({ role: event.target.value as Filters['role'] })}
              >
                <option value="">Tất cả vai trò</option>
                {ADMIN_ROLE_CODES.map(role => <option key={role} value={role}>{ADMIN_ROLE_LABELS[role]}</option>)}
              </select>
            </div>
          </WorkspaceFieldLabel>

          <WorkspaceFieldLabel className="adm-status-field" label="Trạng thái">
            <div className="adm-select-wrap">
              <select
                aria-label="Lọc theo trạng thái"
                className="adm-filter-select"
                value={filters.status}
                onChange={event => changeFilter({ status: event.target.value as Filters['status'] })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">{ADMIN_ACCOUNT_STATUS_LABELS.ACTIVE}</option>
                <option value="DISABLED">{ADMIN_ACCOUNT_STATUS_LABELS.DISABLED}</option>
              </select>
            </div>
          </WorkspaceFieldLabel>

          <WorkspaceFieldLabel className="adm-status-field" label="Sắp xếp">
            <div className="adm-select-wrap">
              <select
                aria-label="Sắp xếp tài khoản"
                className="adm-filter-select"
                value={filters.sort}
                onChange={event => changeFilter({ sort: event.target.value as AdminUserSort })}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </WorkspaceFieldLabel>

          {hasFilters && (
            <button
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={() => {
                setSearchInput('');
                changeFilter({ search: '', role: '', status: '' });
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      <div className="adm-card adm-table-card">
        {loading && <p className="app-loading-state" role="status">Đang tải danh sách tài khoản...</p>}
        {!loading && error && (
          <div className="adm-table-empty" role="alert">
            <p>{error}</p>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setRevision(value => value + 1)}>
              <RefreshCw size={14} />
              <span>Thử lại</span>
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="adm-table-empty">
            <AlertCircle size={32} />
            <p>{hasFilters ? 'Không có tài khoản nào khớp với bộ lọc.' : 'Chưa có tài khoản nào.'}</p>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="adm-table-summary">
              <span>Có <strong>{total}</strong> tài khoản phù hợp</span>
            </div>
            <div className="adm-table-responsive">
              <table className="adm-table adm-accounts-table">
                <thead>
                  <tr>
                    <th>TÀI KHOẢN</th>
                    <th>LIÊN HỆ</th>
                    <th>VAI TRÒ</th>
                    <th>TRẠNG THÁI</th>
                    <th>NGÀY TẠO</th>
                    <th className="adm-th-actions">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(account => {
                    const isSelf = account.userId === currentUserId;
                    const lockBlocked = lockBlockedReason(account);
                    return (
                      <tr key={account.userId} className={account.status === 'DISABLED' ? 'adm-row-locked' : ''}>
                        <td>
                          <div className="adm-user-cell">
                            <div className="adm-user-avatar-sm">{adminUserInitials(account.fullName)}</div>
                            <div>
                              <div className="adm-user-name">{account.fullName}</div>
                              <div className="adm-user-code">@{account.username} · ID {account.userId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="adm-contact-cell">
                            <div className="adm-contact-item">
                              {account.email && !account.emailVerified ? <MailWarning size={13} /> : <Mail size={13} />}
                              <span title={account.email ?? undefined}>{account.email || 'Chưa có email'}</span>
                            </div>
                            {account.email && (
                              <div className="adm-contact-item">
                                <span className={`adm-badge-status ${account.emailVerified ? 'badge-status-active' : 'badge-status-pending'}`}>
                                  {account.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                                </span>
                              </div>
                            )}
                            {account.phone && (
                              <div className="adm-contact-item">
                                <Phone size={13} />
                                <span>{account.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="adm-role-list">
                            {account.roles.map(role => (
                              <span key={role} className={`adm-badge-role ${ROLE_BADGE_CLASS[role]}`}>{ADMIN_ROLE_LABELS[role]}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`adm-badge-status ${account.status === 'DISABLED' ? 'badge-status-locked' : 'badge-status-active'}`}>
                            <span className="adm-status-dot"></span>
                            {ADMIN_ACCOUNT_STATUS_LABELS[account.status]}
                          </span>
                        </td>
                        <td>
                          <div className="adm-time-cell">
                            <Clock size={13} />
                            <span>{formatDate(account.createdAt)}</span>
                          </div>
                        </td>
                        <td className="adm-td-actions">
                          <div className="adm-action-buttons">
                            <button
                              type="button"
                              className="adm-icon-btn"
                              aria-label={`Chỉnh sửa ${account.username}`}
                              title={isSelf ? 'Hãy cập nhật thông tin của bạn ở trang Hồ sơ.' : 'Chỉnh sửa thông tin'}
                              disabled={isSelf}
                              onClick={() => openEdit(account)}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              className={`adm-icon-btn ${account.status === 'DISABLED' ? 'btn-unlock' : 'btn-lock'}`}
                              aria-label={`${account.status === 'DISABLED' ? 'Mở khóa' : 'Khóa'} ${account.username}`}
                              title={lockBlocked || (account.status === 'DISABLED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản')}
                              disabled={Boolean(lockBlocked)}
                              onClick={() => openStatus(account)}
                            >
                              {account.status === 'DISABLED' ? <Unlock size={15} /> : <Lock size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!loading && !error && pages > 1 && (
        <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} />
      )}

      {createOpen && (
        <div className="adm-modal-overlay" onClick={closeDialogs}>
          <section
            className="adm-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-create-user-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="admin-create-user-title" className="adm-modal-title">Thêm tài khoản</h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialogs}><X size={18} /></button>
            </div>
            <form onSubmit={submitCreate} noValidate>
              <div className="adm-modal-body">
                <p className="adm-confirm-text">
                  Tài khoản mới chỉ có vai trò Người tham gia và email chưa xác minh. Bạn cần trao mật khẩu ban đầu cho người dùng qua kênh riêng.
                </p>
                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-create-username">Tên đăng nhập *</label>
                    <input
                      id="admin-create-username"
                      className="adm-form-input"
                      autoComplete="off"
                      maxLength={20}
                      value={createForm.username}
                      {...fieldProps(createErrors, 'username', 'admin-create-username')}
                      onChange={event => {
                        setCreateForm({ ...createForm, username: event.target.value });
                        setCreateErrors(current => ({ ...current, username: undefined }));
                      }}
                    />
                    <FieldError id="admin-create-username-error" message={createErrors.username} />
                    {!createErrors.username && <small className="adm-form-hint">3–20 ký tự, bắt đầu bằng chữ cái, chỉ gồm chữ không dấu và số.</small>}
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-create-fullname">Họ và tên *</label>
                    <input
                      id="admin-create-fullname"
                      className="adm-form-input"
                      maxLength={50}
                      value={createForm.fullName}
                      {...fieldProps(createErrors, 'fullName', 'admin-create-fullname')}
                      onChange={event => {
                        setCreateForm({ ...createForm, fullName: event.target.value });
                        setCreateErrors(current => ({ ...current, fullName: undefined }));
                      }}
                    />
                    <FieldError id="admin-create-fullname-error" message={createErrors.fullName} />
                  </div>
                </div>
                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-create-password">Mật khẩu ban đầu *</label>
                    <input
                      id="admin-create-password"
                      type="password"
                      className="adm-form-input"
                      autoComplete="new-password"
                      maxLength={64}
                      value={createForm.password}
                      {...fieldProps(createErrors, 'password', 'admin-create-password')}
                      onChange={event => {
                        setCreateForm({ ...createForm, password: event.target.value });
                        setCreateErrors(current => ({ ...current, password: undefined }));
                      }}
                    />
                    <FieldError id="admin-create-password-error" message={createErrors.password} />
                    {!createErrors.password && <small className="adm-form-hint">8–64 ký tự.</small>}
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-create-confirm">Xác nhận mật khẩu *</label>
                    <input
                      id="admin-create-confirm"
                      type="password"
                      className="adm-form-input"
                      autoComplete="new-password"
                      maxLength={64}
                      value={createForm.confirmPassword}
                      {...fieldProps(createErrors, 'confirmPassword', 'admin-create-confirm')}
                      onChange={event => {
                        setCreateForm({ ...createForm, confirmPassword: event.target.value });
                        setCreateErrors(current => ({ ...current, confirmPassword: undefined }));
                      }}
                    />
                    <FieldError id="admin-create-confirm-error" message={createErrors.confirmPassword} />
                  </div>
                </div>
                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-create-email">Email</label>
                    <input
                      id="admin-create-email"
                      type="email"
                      className="adm-form-input"
                      maxLength={255}
                      value={createForm.email}
                      {...fieldProps(createErrors, 'email', 'admin-create-email')}
                      onChange={event => {
                        setCreateForm({ ...createForm, email: event.target.value });
                        setCreateErrors(current => ({ ...current, email: undefined }));
                      }}
                    />
                    <FieldError id="admin-create-email-error" message={createErrors.email} />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-create-phone">Số điện thoại</label>
                    <input
                      id="admin-create-phone"
                      type="tel"
                      className="adm-form-input"
                      maxLength={20}
                      value={createForm.phone}
                      {...fieldProps(createErrors, 'phone', 'admin-create-phone')}
                      onChange={event => {
                        setCreateForm({ ...createForm, phone: event.target.value });
                        setCreateErrors(current => ({ ...current, phone: undefined }));
                      }}
                    />
                    <FieldError id="admin-create-phone-error" message={createErrors.phone} />
                  </div>
                </div>
                {actionError && <p className="adm-form-error" role="alert">{actionError}</p>}
              </div>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={closeDialogs} disabled={submitting}>Hủy</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editTarget && (
        <div className="adm-modal-overlay" onClick={closeDialogs}>
          <section
            className="adm-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-user-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="admin-edit-user-title" className="adm-modal-title">Cập nhật tài khoản @{editTarget.username}</h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialogs}><X size={18} /></button>
            </div>
            <form onSubmit={submitEdit} noValidate>
              <div className="adm-modal-body">
                <div className="adm-form-group">
                  <label className="adm-form-label" htmlFor="admin-edit-fullname">Họ và tên *</label>
                  <input
                    id="admin-edit-fullname"
                    className="adm-form-input"
                    maxLength={50}
                    value={editForm.fullName}
                    {...fieldProps(editErrors, 'fullName', 'admin-edit-fullname')}
                    onChange={event => {
                      setEditForm({ ...editForm, fullName: event.target.value });
                      setEditErrors(current => ({ ...current, fullName: undefined }));
                    }}
                  />
                  <FieldError id="admin-edit-fullname-error" message={editErrors.fullName} />
                </div>
                <div className="adm-form-row">
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-edit-phone">Số điện thoại</label>
                    <input
                      id="admin-edit-phone"
                      type="tel"
                      className="adm-form-input"
                      maxLength={20}
                      placeholder="Để trống để xóa số điện thoại"
                      value={editForm.phone}
                      {...fieldProps(editErrors, 'phone', 'admin-edit-phone')}
                      onChange={event => {
                        setEditForm({ ...editForm, phone: event.target.value });
                        setEditErrors(current => ({ ...current, phone: undefined }));
                      }}
                    />
                    <FieldError id="admin-edit-phone-error" message={editErrors.phone} />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label" htmlFor="admin-edit-email">Email</label>
                    <input
                      id="admin-edit-email"
                      type="email"
                      className="adm-form-input"
                      maxLength={255}
                      disabled={editTarget.emailVerified}
                      value={editForm.email}
                      {...fieldProps(editErrors, 'email', 'admin-edit-email')}
                      onChange={event => {
                        setEditForm({ ...editForm, email: event.target.value });
                        setEditErrors(current => ({ ...current, email: undefined }));
                      }}
                    />
                    <FieldError id="admin-edit-email-error" message={editErrors.email} />
                    <small className="adm-form-hint">
                      {editTarget.emailVerified
                        ? 'Email đã xác minh nên không thể thay đổi.'
                        : 'Đổi email chưa xác minh sẽ hủy liên kết xác minh cũ và gửi liên kết mới.'}
                    </small>
                  </div>
                </div>
                {actionError && <p className="adm-form-error" role="alert">{actionError}</p>}
              </div>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={closeDialogs} disabled={submitting}>Hủy</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {statusTarget && (
        <div className="adm-modal-overlay" onClick={closeDialogs}>
          <section
            className="adm-modal-content adm-dialog-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-status-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="admin-status-title" className="adm-modal-title">
                {statusTarget.status === 'DISABLED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
              </h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialogs}><X size={18} /></button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-confirm-text">
                {statusTarget.status === 'DISABLED'
                  ? <>Mở khóa tài khoản <strong>{statusTarget.fullName}</strong> (@{statusTarget.username}). Người dùng sẽ cần đăng nhập lại; các phiên cũ không được khôi phục.</>
                  : <>Khóa tài khoản <strong>{statusTarget.fullName}</strong> (@{statusTarget.username}). Các phiên đăng nhập hiện có sẽ ngừng hoạt động từ yêu cầu tiếp theo. Dữ liệu nghiệp vụ của tài khoản được giữ nguyên.</>}
              </p>
              <div className="adm-form-group">
                <label className="adm-form-label" htmlFor="admin-status-reason">Lý do (10–500 ký tự) *</label>
                <textarea
                  id="admin-status-reason"
                  className="adm-form-input"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  aria-describedby="admin-status-reason-hint"
                  onChange={event => { setReason(event.target.value); setActionError(''); }}
                />
                <small id="admin-status-reason-hint" className="adm-form-hint">
                  {reasonLength < REASON_MIN
                    ? `Cần thêm ít nhất ${REASON_MIN - reasonLength} ký tự (${reasonLength}/${REASON_MAX}). Lý do được ghi vào nhật ký hệ thống.`
                    : `${reasonLength}/${REASON_MAX} ký tự. Lý do được ghi vào nhật ký hệ thống.`}
                </small>
              </div>
              {actionError && <p className="adm-form-error" role="alert">{actionError}</p>}
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-secondary" onClick={closeDialogs} disabled={submitting}>Hủy</button>
              <button
                type="button"
                className={`adm-btn ${statusTarget.status === 'DISABLED' ? 'adm-btn-primary' : 'adm-btn-danger'}`}
                disabled={submitting || !isValidAdminReason(reason)}
                onClick={submitStatus}
              >
                {submitting ? 'Đang xử lý...' : statusTarget.status === 'DISABLED' ? 'Xác nhận mở khóa' : 'Xác nhận khóa'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
