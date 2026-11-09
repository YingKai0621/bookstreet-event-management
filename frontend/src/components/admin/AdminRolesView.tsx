import { AlertCircle, CheckCircle2, ChevronDown, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
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
  changes: { role: AdminManageableRole; action: 'assign' | 'remove' }[];
  completed: number;
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

function RoleDropdown({ account, currentUserId, disabled, onApply }: {
  account: AdminUser;
  currentUserId?: number;
  disabled: boolean;
  onApply: (roles: AdminManageableRole[]) => void;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<AdminManageableRole[]>([]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const changed = ADMIN_MANAGEABLE_ROLES.some(role => selected.includes(role) !== account.roles.includes(role));

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      panel.current?.hidePopover();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return <div className="adm-role-dropdown">
    <button type="button" className="adm-role-dropdown-trigger" popoverTarget={id} aria-haspopup="dialog" aria-expanded={open}
      aria-label={`Chọn vai trò cho ${account.username}`} disabled={disabled}
      onClick={event => {
        if (open) return;
        setSelected(ADMIN_MANAGEABLE_ROLES.filter(role => account.roles.includes(role)));
        const rect = event.currentTarget.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 24);
        setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top: rect.bottom + 8 });
      }}>
      <ShieldCheck size={16} aria-hidden="true" />Chọn vai trò<ChevronDown size={16} aria-hidden="true" />
    </button>
    <div id={id} ref={panel} popover="auto" role="dialog" aria-label={`Vai trò của ${account.username}`}
      className="adm-role-dropdown-panel" style={{ top: position.top, left: position.left }}
      onToggle={event => {
        const visible = event.newState === 'open';
        setOpen(visible);
        if (visible && panel.current) {
          const rect = panel.current.getBoundingClientRect();
          if (rect.bottom > window.innerHeight - 12) setPosition(current => ({ ...current, top: Math.max(12, current.top - rect.height - 52) }));
        }
      }}>
      <div className="adm-role-dropdown-heading">Vai trò tài khoản<small>@{account.username}</small></div>
      <label className="adm-role-dropdown-option is-fixed"><input type="checkbox" checked disabled readOnly /><span>Người tham gia<small>Vai trò mặc định, luôn được giữ</small></span></label>
      {ADMIN_MANAGEABLE_ROLES.map(role => {
        const blocked = unavailableReason(account, role, currentUserId);
        return <label key={role} className={`adm-role-dropdown-option${blocked ? ' is-fixed' : ''}`}>
          <input type="checkbox" checked={selected.includes(role)} disabled={Boolean(blocked)} onChange={event => setSelected(current => event.target.checked ? [...current, role] : current.filter(item => item !== role))} />
          <span>{ADMIN_ROLE_LABELS[role]}{blocked && <small>{blocked}</small>}</span>
        </label>;
      })}
      <div className="adm-role-dropdown-footer"><button type="button" className="adm-btn adm-btn-secondary" onClick={() => panel.current?.hidePopover()}>Hủy</button><button type="button" className="adm-btn adm-btn-primary" disabled={!changed} onClick={() => { panel.current?.hidePopover(); onApply(selected); }}>Áp dụng</button></div>
    </div>
  </div>;
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

  const request = (account: AdminUser, selected: AdminManageableRole[]) => {
    setNotice('');
    setActionError('');
    const changes = ADMIN_MANAGEABLE_ROLES.filter(role => selected.includes(role) !== account.roles.includes(role))
      .map(role => ({ role, action: selected.includes(role) ? 'assign' as const : 'remove' as const }));
    if (changes.length) setPending({ account, changes, completed: 0 });
  };

  const confirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    setActionError('');
    let processed = 0;
    let updated = pending.account;
    try {
      for (const change of pending.changes) {
        updated = change.action === 'assign'
          ? await adminUsersApi.assignRole(updated.userId, change.role)
          : await adminUsersApi.removeRole(updated.userId, change.role);
        const result = updated;
        setItems(current => current.map(item => item.userId === result.userId ? result : item));
        processed += 1;
      }
      if (roleFilter) setRevision(value => value + 1);
      setNotice(`Đã cập nhật ${pending.completed + processed} thay đổi vai trò cho ${updated.username}. Vai trò được gán có hiệu lực sau khi đăng nhập lại; vai trò bị gỡ ngừng hiệu lực ngay từ yêu cầu tiếp theo.`);
      setPending(null);
    } catch (cause) {
      const completed = pending.completed + processed;
      setPending({ account: updated, changes: pending.changes.slice(processed), completed });
      setActionError(`${completed ? `Đã lưu ${completed} thay đổi. Các thay đổi còn lại chưa được lưu. ` : ''}${adminUserErrorMessage(cause, 'Không cập nhật được vai trò. Vui lòng thử lại.')}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adm-users-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Vai trò</h1>
          <p className="adm-page-subtitle workspace-page-subtitle adm-roles-description">
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
            <table className="adm-table adm-roles-table">
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
                      <RoleDropdown account={account} currentUserId={currentUserId} disabled={submitting} onApply={roles => request(account, roles)} />
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
                <ShieldCheck size={18} /> Xác nhận cập nhật vai trò
              </h3>
              <button type="button" className="adm-modal-close" aria-label="Đóng" onClick={closeDialog}><X size={18} /></button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-confirm-text">
                Cập nhật vai trò cho <strong>{pending.account.fullName}</strong> (@{pending.account.username}):
              </p>
              <ul className="adm-role-change-summary">{pending.changes.map(change => <li key={change.role}><span className={change.action === 'assign' ? 'is-assign' : 'is-remove'}>{change.action === 'assign' ? 'Gán' : 'Gỡ'}</span><strong>{ADMIN_ROLE_LABELS[change.role]}</strong></li>)}</ul>
              <p className="adm-form-hint">Vai trò được gán có hiệu lực sau khi đăng nhập lại. Vai trò bị gỡ ngừng hiệu lực ngay từ yêu cầu tiếp theo. Vai trò Người tham gia và dữ liệu đã có được giữ nguyên.</p>
              {actionError && <p className="adm-form-error" role="alert">{actionError}</p>}
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-secondary" onClick={closeDialog} disabled={submitting}>Hủy</button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                disabled={submitting}
                onClick={confirm}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận cập nhật'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
