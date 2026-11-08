import { AlertCircle, CheckCircle2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import {
  ADMIN_ACCOUNT_STATUS_LABELS,
  ADMIN_MANAGEABLE_ROLES,
  ADMIN_ROLE_LABELS,
  adminUserErrorMessage,
  adminUserInitials,
  adminUsersApi,
  type AdminManageableRole,
  type AdminRoleCode,
  type AdminUser,
} from '../../services/adminUsersApi';
import { CompactPagination } from '../ui/CompactPagination';
import { SearchFieldLabel } from '../ui/SearchFieldLabel';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';
import './AdminAccounts.css';

const PAGE_SIZE = 20;

const ROLE_BADGE_CLASS: Record<AdminRoleCode, string> = {
  PARTICIPANT: 'badge-role-participant',
  PARTNER: 'badge-role-partner',
  ORGANIZER: 'badge-role-organizer',
  ADMIN: 'badge-role-admin',
};

interface PendingChange {
  account: AdminUser;
  role: AdminManageableRole;
  action: 'assign' | 'remove';
}

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền quản lý vai trò.';
  return 'Không tải được danh sách tài khoản. Vui lòng thử lại.';
}

/**
 * The reason an action is unavailable, using only what the screen knows. Checks that need other data,
 * such as open Events or an active organization, are explained from the server's answer instead.
 */
function unavailableReason(account: AdminUser, role: AdminManageableRole, currentUserId?: number): string {
  if (account.roles.includes(role)) {
    if (role === 'ADMIN' && account.userId === currentUserId) return 'Bạn không thể tự gỡ vai trò Quản trị viên của mình.';
    return '';
  }
  if (account.status !== 'ACTIVE') return 'Tài khoản đang bị khóa nên không thể gán vai trò.';
  if (!account.email) return 'Tài khoản chưa có email. Cần email đã xác minh để gán vai trò.';
  if (!account.emailVerified) return 'Email chưa được xác minh. Cần email đã xác minh để gán vai trò.';
  return '';
}

export const AdminRolesView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.userId;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminManageableRole | ''>('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const closeDialog = () => {
    if (submitting) return;
    setPending(null);
    setActionError('');
  };
  useModalDismiss(pending !== null, closeDialog);

  // Search is sent to the server after a short pause, and only a changed term returns to the first page.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return undefined;
    const timer = window.setTimeout(() => {
      setSearch(next);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Filter and page changes intentionally start a server refresh.
    setLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect -- A new request replaces any earlier failure.
    setError('');
    adminUsersApi.list({
      page,
      size: PAGE_SIZE,
      search: search || undefined,
      role: roleFilter || undefined,
      sort: 'username,asc',
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
  }, [search, roleFilter, page, revision]);

  const hasFilters = Boolean(search || roleFilter);

  const request = (account: AdminUser, role: AdminManageableRole) => {
    setNotice('');
    setActionError('');
    setPending({ account, role, action: account.roles.includes(role) ? 'remove' : 'assign' });
  };

  const confirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    setActionError('');
    try {
      const updated = pending.action === 'assign'
        ? await adminUsersApi.assignRole(pending.account.userId, pending.role)
        : await adminUsersApi.removeRole(pending.account.userId, pending.role);
      setItems(current => current.map(item => (item.userId === updated.userId ? updated : item)));
      if (roleFilter && !updated.roles.includes(roleFilter)) setRevision(value => value + 1);
      setNotice(pending.action === 'assign'
        ? `Đã gán vai trò ${ADMIN_ROLE_LABELS[pending.role]} cho ${updated.username}. Vai trò có hiệu lực sau khi người dùng đăng nhập lại.`
        : `Đã gỡ vai trò ${ADMIN_ROLE_LABELS[pending.role]} khỏi ${updated.username}. Quyền này ngừng hiệu lực ngay từ yêu cầu tiếp theo.`);
      setPending(null);
    } catch (cause) {
      setActionError(adminUserErrorMessage(cause, 'Không cập nhật được vai trò. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-users-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Vai trò</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Gán hoặc gỡ vai trò Đối tác, Ban tổ chức và Quản trị viên cho từng tài khoản. Vai trò Người tham gia luôn được giữ.
          </p>
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
          <WorkspaceFieldLabel className="adm-status-field" label="Đang giữ vai trò">
            <div className="adm-select-wrap">
              <select
                aria-label="Lọc theo vai trò đang giữ"
                className="adm-filter-select"
                value={roleFilter}
                onChange={event => {
                  setRoleFilter(event.target.value as AdminManageableRole | '');
                  setPage(0);
                }}
              >
                <option value="">Tất cả tài khoản</option>
                {ADMIN_MANAGEABLE_ROLES.map(role => <option key={role} value={role}>{ADMIN_ROLE_LABELS[role]}</option>)}
              </select>
            </div>
          </WorkspaceFieldLabel>
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
          <div className="adm-table-responsive">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>TÀI KHOẢN</th>
                  <th>TRẠNG THÁI</th>
                  <th>VAI TRÒ HIỆN TẠI</th>
                  <th>GÁN HOẶC GỠ</th>
                </tr>
              </thead>
              <tbody>
                {items.map(account => (
                  <tr key={account.userId} className={account.status === 'DISABLED' ? 'adm-row-locked' : ''}>
                    <td>
                      <div className="adm-user-cell">
                        <div className="adm-user-avatar-sm">{adminUserInitials(account.fullName)}</div>
                        <div>
                          <div className="adm-user-name">{account.fullName}</div>
                          <div className="adm-user-code">
                            @{account.username} · {account.email
                              ? (account.emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh')
                              : 'Chưa có email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`adm-badge-status ${account.status === 'DISABLED' ? 'badge-status-locked' : 'badge-status-active'}`}>
                        <span className="adm-status-dot"></span>
                        {ADMIN_ACCOUNT_STATUS_LABELS[account.status]}
                      </span>
                    </td>
                    <td>
                      <div className="adm-role-list">
                        {account.roles.map(role => (
                          <span key={role} className={`adm-badge-role ${ROLE_BADGE_CLASS[role]}`}>{ADMIN_ROLE_LABELS[role]}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="adm-role-actions">
                        {ADMIN_MANAGEABLE_ROLES.map(role => {
                          const holds = account.roles.includes(role);
                          const blocked = unavailableReason(account, role, currentUserId);
                          return (
                            <div key={role} className="adm-role-action">
                              <button
                                type="button"
                                className={`adm-btn ${holds ? 'adm-btn-secondary' : 'adm-btn-primary'}`}
                                aria-label={`${holds ? 'Gỡ' : 'Gán'} vai trò ${ADMIN_ROLE_LABELS[role]} cho ${account.username}`}
                                disabled={Boolean(blocked)}
                                title={blocked || undefined}
                                onClick={() => request(account, role)}
                              >
                                {holds ? `Gỡ ${ADMIN_ROLE_LABELS[role]}` : `Gán ${ADMIN_ROLE_LABELS[role]}`}
                              </button>
                              {blocked && <small>{blocked}</small>}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && pages > 1 && (
        <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} />
      )}

      {pending && (
        <div className="adm-modal-overlay" onClick={closeDialog}>
          <section
            className="adm-modal-content adm-dialog-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-role-change-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="admin-role-change-title" className="adm-modal-title">
                <ShieldCheck size={18} /> {pending.action === 'assign' ? 'Gán vai trò' : 'Gỡ vai trò'}
              </h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialog}><X size={18} /></button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-confirm-text">
                {pending.action === 'assign'
                  ? <>Gán vai trò <strong>{ADMIN_ROLE_LABELS[pending.role]}</strong> cho <strong>{pending.account.fullName}</strong> (@{pending.account.username}). Vai trò có hiệu lực sau khi người dùng đăng nhập lại.</>
                  : <>Gỡ vai trò <strong>{ADMIN_ROLE_LABELS[pending.role]}</strong> khỏi <strong>{pending.account.fullName}</strong> (@{pending.account.username}). Quyền này ngừng hiệu lực ngay từ yêu cầu tiếp theo; dữ liệu đã có được giữ nguyên.</>}
              </p>
              {actionError && <p className="adm-form-error" role="alert">{actionError}</p>}
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-secondary" onClick={closeDialog} disabled={submitting}>Hủy</button>
              <button
                type="button"
                className={`adm-btn ${pending.action === 'assign' ? 'adm-btn-primary' : 'adm-btn-danger'}`}
                disabled={submitting}
                onClick={confirm}
              >
                {submitting ? 'Đang xử lý...' : pending.action === 'assign' ? 'Xác nhận gán' : 'Xác nhận gỡ'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
