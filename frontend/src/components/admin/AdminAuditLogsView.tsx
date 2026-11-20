import { DayFirstDateInput } from '../ui/DayFirstDateInput';
import { Clock, Filter, RefreshCw, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  ADMIN_AUDIT_ACTION_LABELS,
  ADMIN_AUDIT_TARGET_LABELS,
  adminAuditApi,
  formatAuditTime,
  type AdminAuditAction,
  type AdminAuditLog,
  type AdminAuditTargetType,
} from '../../services/adminAuditApi';
import { ApiError } from '../../services/apiClient';
import { CompactPagination } from '../ui/CompactPagination';
import { WorkspaceFieldLabel } from '../ui/WorkspaceFieldLabel';

interface Filters {
  action: AdminAuditAction | '';
  targetType: AdminAuditTargetType | '';
  targetId: string;
  actorUserId: string;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { action: '', targetType: '', targetId: '', actorUserId: '', from: '', to: '' };
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  DISABLED: 'Đã khóa',
  INACTIVE: 'Đã khóa',
};
const FIELD_LABELS: Record<string, string> = {
  roles: 'Vai trò',
  role: 'Vai trò',
  changedFields: 'Trường đã đổi',
};

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền xem nhật ký hệ thống.';
  if (error instanceof ApiError && error.status === 400) return 'Bộ lọc chưa hợp lệ. Vui lòng kiểm tra khoảng ngày và mã đã nhập.';
  return 'Không tải được nhật ký hệ thống. Vui lòng thử lại.';
}

function detailText(details: Record<string, unknown>): string {
  if ('from' in details && 'to' in details) {
    const label = (value: unknown) => STATUS_LABELS[String(value)] ?? String(value);
    return `${label(details.from)} → ${label(details.to)}`;
  }
  const parts = Object.entries(details).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    return `${FIELD_LABELS[key] ?? key}: ${text}`;
  });
  return parts.join(' · ') || '—';
}

export const AdminAuditLogsView: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminAuditLog | null>(null);
  useModalDismiss(selected !== null, () => setSelected(null));

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Filter and page changes intentionally start a server refresh.
    setLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect -- A new request replaces any earlier failure.
    setError('');
    adminAuditApi.list({
      page,
      size: 20,
      action: filters.action || undefined,
      targetType: filters.targetType || undefined,
      targetId: filters.targetType ? filters.targetId : undefined,
      actorUserId: filters.actorUserId,
      from: filters.from,
      to: filters.to,
    }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.content)) throw new Error('Invalid audit response');
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
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="adm-audit-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Nhật ký hệ thống</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Xem ai đã thay đổi gì, vào lúc nào và vì lý do gì. Nhật ký chỉ để đọc, không thể sửa hay xóa.
          </p>
        </div>
      </div>

      <div className="adm-card adm-filter-card">
        <div className="adm-filter-bar">
          <WorkspaceFieldLabel className="adm-status-field" label="Hành động">
            <div className="adm-select-wrap">
              <Filter size={14} />
              <select
                aria-label="Lọc theo hành động"
                className="adm-filter-select"
                value={filters.action}
                onChange={event => changeFilter({ action: event.target.value as Filters['action'] })}
              >
                <option value="">Tất cả hành động</option>
                {Object.entries(ADMIN_AUDIT_ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="adm-status-field" label="Đối tượng">
            <div className="adm-select-wrap">
              <select
                aria-label="Lọc theo loại đối tượng"
                className="adm-filter-select"
                value={filters.targetType}
                onChange={event => changeFilter({
                  targetType: event.target.value as Filters['targetType'],
                  targetId: event.target.value ? filters.targetId : '',
                })}
              >
                <option value="">Tất cả đối tượng</option>
                {Object.entries(ADMIN_AUDIT_TARGET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="adm-status-field" label="Mã đối tượng">
            <input
              aria-label="Lọc theo mã đối tượng"
              className="adm-filter-select"
              inputMode="numeric"
              placeholder={filters.targetType ? 'Ví dụ: 12' : 'Chọn đối tượng trước'}
              disabled={!filters.targetType}
              value={filters.targetId}
              onChange={event => changeFilter({ targetId: event.target.value.replace(/\D/g, '') })}
            />
          </WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="adm-status-field" label="Mã người thực hiện">
            <input
              aria-label="Lọc theo mã người thực hiện"
              className="adm-filter-select"
              inputMode="numeric"
              placeholder="Ví dụ: 1"
              value={filters.actorUserId}
              onChange={event => changeFilter({ actorUserId: event.target.value.replace(/\D/g, '') })}
            />
          </WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="adm-status-field" label="Từ ngày">
            <DayFirstDateInput
              aria-label="Lọc từ ngày"
              className="adm-filter-select"
              type="date"
              value={filters.from}
              onChange={event => changeFilter({ from: event.target.value })}
            />
          </WorkspaceFieldLabel>
          <WorkspaceFieldLabel className="adm-status-field" label="Đến ngày">
            <DayFirstDateInput
              aria-label="Lọc đến ngày"
              className="adm-filter-select"
              type="date"
              value={filters.to}
              onChange={event => changeFilter({ to: event.target.value })}
            />
          </WorkspaceFieldLabel>
          {hasFilters && (
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => changeFilter(NO_FILTERS)}>
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      <div className="adm-card adm-table-card">
        {loading && <p className="app-loading-state" role="status">Đang tải nhật ký...</p>}
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
            <Clock size={32} />
            <p>{hasFilters ? 'Không có bản ghi nào khớp với bộ lọc.' : 'Chưa có thao tác quản trị nào được ghi lại.'}</p>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="adm-table-responsive">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>THỜI GIAN</th>
                  <th>NGƯỜI THỰC HIỆN</th>
                  <th>HÀNH ĐỘNG</th>
                  <th>ĐỐI TƯỢNG</th>
                  <th>LÝ DO</th>
                  <th>CHI TIẾT</th>
                </tr>
              </thead>
              <tbody>
                {items.map(log => (
                  <tr key={log.auditLogId}>
                    <td>
                      <div className="adm-time-cell">
                        <Clock size={13} />
                        <span>{formatAuditTime(log.createdAt)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="adm-log-actor">
                        <span className="adm-actor-name">{log.actor.fullName}</span>
                        <span className="adm-actor-role">{log.actor.username}</span>
                      </div>
                    </td>
                    <td>
                      <span className="adm-badge-role badge-role-admin">{ADMIN_AUDIT_ACTION_LABELS[log.action] ?? log.action}</span>
                    </td>
                    <td>
                      <span className="adm-log-target">{log.targetLabel}</span>
                    </td>
                    <td>
                      <span className="adm-log-details">{log.reason || '—'}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="adm-log-detail-button"
                        aria-label={`Xem chi tiết nhật ký ${log.auditLogId}`}
                        onClick={() => setSelected(log)}
                      >
                        <span className="adm-log-details">{detailText(log.details)}</span>
                        <small>Xem chi tiết</small>
                      </button>
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

      {selected && (
        <div className="adm-modal-overlay" onClick={() => setSelected(null)}>
          <section
            className="adm-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-log-detail-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h3 id="audit-log-detail-title">Chi tiết nhật ký #{selected.auditLogId}</h3>
              <button className="adm-modal-close" type="button" aria-label="Đóng chi tiết nhật ký" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="adm-modal-body">
              <dl className="audit-detail-fields">
                <dt>Thời gian</dt><dd>{formatAuditTime(selected.createdAt)}</dd>
                <dt>Người thực hiện</dt><dd>{selected.actor.fullName} ({selected.actor.username})</dd>
                <dt>Hành động</dt><dd>{ADMIN_AUDIT_ACTION_LABELS[selected.action] ?? selected.action}</dd>
                <dt>Đối tượng</dt><dd>{ADMIN_AUDIT_TARGET_LABELS[selected.targetType] ?? selected.targetType}: {selected.targetLabel} (mã {selected.targetId})</dd>
                <dt>Lý do</dt><dd>{selected.reason || '—'}</dd>
                <dt>Chi tiết</dt><dd>{detailText(selected.details)}</dd>
              </dl>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" type="button" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
