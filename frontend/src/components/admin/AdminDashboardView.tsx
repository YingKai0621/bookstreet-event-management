import { displayDateText } from '../../utils/dateDisplay';
import { Activity, ArrowRight, Calendar, Clock, FileText, Store, UserPlus, Users, Wallet } from 'lucide-react';
import React from 'react';
import { ADMIN_AUDIT_ACTION_LABELS, formatAuditTime, type AdminAuditLog } from '../../services/adminAuditApi';
import type { AdminDashboardStats } from '../../services/adminDashboardApi';

interface AdminDashboardViewProps {
  onNavigateTab: (tab: string) => void;
  auditLogs: AdminAuditLog[];
  auditLogsFailed: boolean;
  stats: AdminDashboardStats;
  onOpenAddUser: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  PARTICIPANT: 'Độc giả',
  PARTNER: 'Đối tác',
  ORGANIZER: 'Ban tổ chức',
  ADMIN: 'Quản trị viên',
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã công bố',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
};

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigateTab,
  auditLogs,
  auditLogsFailed,
  stats,
  onOpenAddUser,
}) => {
  const accounts = stats.accounts ?? {
    total: 0,
    byRole: { PARTICIPANT: 0, PARTNER: 0, ORGANIZER: 0, ADMIN: 0 },
    byStatus: { ACTIVE: 0, DISABLED: 0 },
  };
  const events = stats.events ?? {
    total: 0,
    byStatus: { DRAFT: 0, PUBLISHED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
  };
  const auditByDay = stats.auditByDay ?? [];
  const isReady = stats.requestState === 'ready' && Boolean(accounts && events);
  const maxAudit = Math.max(1, ...auditByDay.map((item) => item.count));

  const statsError = stats.requestState === 'expired'
    ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    : stats.requestState === 'forbidden'
      ? 'Bạn không có quyền xem số liệu tổng quan Admin.'
      : stats.requestState === 'failed'
        ? 'Không tải được số liệu tổng quan. Vui lòng thử tải lại trang.'
        : 'Đang tải số liệu tổng quan…';

  return (
    <div className="adm-dashboard-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title workspace-page-title">Tổng quan Quản trị Hệ thống</h1>
          <p className="adm-page-subtitle workspace-page-subtitle">
            Theo dõi tài khoản, sự kiện, gian hàng và hoạt động quản trị tại Đường Sách TP.HCM.
          </p>
        </div>
        <div className="adm-page-header-actions">
          <button type="button" className="adm-btn adm-btn-secondary" onClick={() => onNavigateTab('users')}>
            <Users size={16} /> Danh sách người dùng
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={onOpenAddUser}>
            <UserPlus size={16} /> Thêm tài khoản
          </button>
        </div>
      </div>

      {!isReady ? (
        <div className="adm-empty-state" role={stats.requestState === 'loading' || !stats.requestState ? 'status' : 'alert'}>
          <p className="adm-empty-state-text">{statsError}</p>
        </div>
      ) : (
        <>
          <div className="adm-kpi-grid">
            <div className="adm-kpi-card kpi-user">
              <div className="adm-kpi-top"><span className="adm-kpi-label">Tổng tài khoản</span><div className="adm-kpi-icon-wrap icon-emerald"><Users size={20} /></div></div>
              <div className="adm-kpi-value">{formatNumber(accounts.total)}</div>
              <div className="adm-kpi-trend trend-neutral">{formatNumber(accounts.byStatus.DISABLED)} tài khoản bị khóa</div>
            </div>
            <div className="adm-kpi-card kpi-event">
              <div className="adm-kpi-top"><span className="adm-kpi-label">Sự kiện</span><div className="adm-kpi-icon-wrap icon-blue"><Calendar size={20} /></div></div>
              <div className="adm-kpi-value">{formatNumber(events.total)}</div>
              <div className="adm-kpi-trend trend-neutral">{formatNumber(events.byStatus.PUBLISHED + events.byStatus.ONGOING)} đã công bố hoặc đang diễn ra</div>
            </div>
            <div className="adm-kpi-card kpi-booth">
              <div className="adm-kpi-top"><span className="adm-kpi-label">Gian hàng đang hoạt động</span><div className="adm-kpi-icon-wrap icon-amber"><Store size={20} /></div></div>
              <div className="adm-kpi-value">{formatNumber(stats.activeBoothAssignments ?? 0)}</div>
              <div className="adm-kpi-trend trend-neutral">Booth Assignment trạng thái ACTIVE</div>
            </div>
            <div className="adm-kpi-card kpi-activity">
              <div className="adm-kpi-top"><span className="adm-kpi-label">Doanh thu gian hàng</span><div className="adm-kpi-icon-wrap icon-purple"><Wallet size={20} /></div></div>
              <div className="adm-kpi-value">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(stats.boothRevenue ?? 0)}</div>
              <div className="adm-kpi-trend trend-neutral">Payment thành công</div>
            </div>
          </div>

          <div className="adm-charts-grid">
            <div className="admin-card adm-chart-card">
              <div className="adm-card-header">
                <div><h3 className="adm-card-title">Thao tác quản trị 7 ngày qua</h3><p className="adm-card-subtitle">Theo múi giờ Asia/Ho_Chi_Minh</p></div>
                <span className="adm-chip adm-chip-active">{formatNumber(auditByDay.reduce((sum, item) => sum + item.count, 0))} thao tác</span>
              </div>
              <div className="adm-chart-container"><div className="adm-chart-bars-wrap">
                {auditByDay.map((item) => {
                  const date = new Date(`${item.date}T00:00:00Z`);
                  const dayLabel = Number.isNaN(date.getTime()) ? item.date : date.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
                  const dateParts = Number.isNaN(date.getTime()) ? [] : new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).formatToParts(date);
                  const dateLabel = dateParts.length ? `${dateParts.find((part) => part.type === 'day')?.value}/${dateParts.find((part) => part.type === 'month')?.value}` : '';
                  const height = Math.max(6, Math.round((item.count / maxAudit) * 130));
                  return <div key={item.date} className="adm-chart-col" title={`${item.count} thao tác ngày ${displayDateText(item.date)}`}>
                    <span className="adm-chart-bar-pill">{item.count}</span><div className="adm-chart-bar" style={{ height: `${height}px` }} />
                    <div className="adm-chart-col-label"><span>{dayLabel}</span><span className="adm-chart-col-date">{dateLabel}</span></div>
                  </div>;
                })}
              </div></div>
            </div>

            <div className="admin-card adm-donut-card">
              <div className="adm-card-header"><div><h3 className="adm-card-title">Tài khoản theo vai trò</h3><p className="adm-card-subtitle">Một tài khoản có thể có nhiều vai trò</p></div></div>
              <div className="adm-dashboard-distribution-body">
              <div className="adm-role-legend-list">
                {Object.entries(ROLE_LABELS).map(([role, label]) => {
                  const count = accounts.byRole[role as keyof typeof accounts.byRole] ?? 0;
                  const maxRoleCount = Math.max(1, ...Object.values(accounts.byRole));
                  return <div className="adm-role-legend-item" key={role}>
                    <div className="adm-role-legend-row"><span>{label}</span><strong>{formatNumber(count)}</strong></div>
                    <div className="adm-role-legend-line-track"><div className="adm-role-legend-line-fill" style={{ width: `${Math.round((count / maxRoleCount) * 100)}%` }} /></div>
                  </div>;
                })}
              </div>
              <div className="adm-event-status-list">
                {Object.entries(EVENT_STATUS_LABELS).map(([status, label]) => <div className="adm-role-legend-row" key={status}>
                  <span>{label}</span><strong>{formatNumber(events.byStatus[status as keyof typeof events.byStatus] ?? 0)}</strong>
                </div>)}
              </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="adm-bottom-grid">
        <div className="admin-card">
          <div className="adm-card-header">
            <div><h3 className="adm-card-title">Hoạt động quản trị gần đây</h3><p className="adm-card-subtitle">Các thay đổi đã được ghi nhận</p></div>
            <button type="button" className="adm-link-btn" onClick={() => onNavigateTab('audit')}><span>Xem tất cả</span><ArrowRight size={14} /></button>
          </div>
          <div className="adm-activity-list">
            {auditLogs.slice(0, 4).map((log) => <div className="adm-activity-item" key={log.auditLogId}>
              <div className="adm-activity-left"><div className="adm-activity-icon"><Activity size={16} /></div><div className="adm-activity-content">
                <strong>{ADMIN_AUDIT_ACTION_LABELS[log.action] ?? log.action}</strong>
                <p>{log.actor.fullName} · <span>{log.targetLabel}</span></p>
              </div></div><div className="adm-activity-time" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#8C9E98', fontSize: '0.75rem' }}><Clock size={13} /><span>{formatAuditTime(log.createdAt)}</span></div>
            </div>)}
            {auditLogsFailed && <div className="adm-empty-state" role="alert"><p className="adm-empty-state-text">Không tải được hoạt động gần đây.</p></div>}
            {!auditLogsFailed && auditLogs.length === 0 && <div className="adm-empty-state"><div className="adm-empty-state-icon"><FileText size={22} /></div><p className="adm-empty-state-text">Chưa có thao tác quản trị nào phát sinh gần đây.</p></div>}
          </div>
        </div>
        <div className="admin-card">
          <div className="adm-card-header"><div><h3 className="adm-card-title">Trạng thái tài khoản</h3><p className="adm-card-subtitle">Số liệu tài khoản từ hệ thống</p></div></div>
          {isReady && <div className="adm-security-card-body">
            <div className="adm-security-tile"><div className="adm-security-tile-left"><div className={`adm-security-tile-icon ${(accounts.byStatus.DISABLED ?? 0) > 0 ? 'red' : 'green'}`}><Users size={18} /></div>
              <div><div className="adm-security-tile-title">{formatNumber(accounts.byStatus.ACTIVE)} tài khoản đang hoạt động</div><div className="adm-security-tile-sub">{formatNumber(accounts.byStatus.DISABLED)} tài khoản bị vô hiệu hóa</div></div>
            </div></div>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => onNavigateTab('users')}>Mở quản lý tài khoản <ArrowRight size={14} /></button>
          </div>}
          {!isReady && <div className="adm-empty-state"><p className="adm-empty-state-text">Chưa có số liệu tài khoản.</p></div>}
        </div>
      </div>
    </div>
  );
};
