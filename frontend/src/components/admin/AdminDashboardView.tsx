import {
  Activity,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  Store,
  UserPlus,
  Users,
  UserX
} from 'lucide-react';
import React from 'react';
import type { AdminDashboardStats } from '../../services/adminApi';
import { AdminAuditLogItem, AdminUserAccount } from '../../types/admin';

interface AdminDashboardViewProps {
  onNavigateTab: (tab: string) => void;
  auditLogs: AdminAuditLogItem[];
  users: AdminUserAccount[];
  stats: AdminDashboardStats;
  onOpenAddUser: () => void;
}

interface RoleConfig {
  key: string;
  label: string;
  dotColor: string;
  fillColor: string;
}

const ROLES_LIST: RoleConfig[] = [
  { key: 'participant', label: 'Độc giả', dotColor: '#10B981', fillColor: '#10B981' },
  { key: 'partner', label: 'Đối tác', dotColor: '#F59E0B', fillColor: '#F59E0B' },
  { key: 'organizer', label: 'Ban tổ chức', dotColor: '#3B82F6', fillColor: '#3B82F6' },
  { key: 'admin', label: 'Quản trị viên', dotColor: '#8B3A3A', fillColor: '#8B3A3A' },
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ 
  onNavigateTab, 
  auditLogs, 
  users, 
  stats, 
  onOpenAddUser 
}) => {
  const lockedUsersCount = users.filter(user => user.status === 'locked').length;
  const pendingUsersCount = users.filter(user => user.status === 'pending_verification').length;
  
  const totalAuditsLast7Days = stats.auditByDay.reduce((acc, curr) => acc + curr.count, 0);
  const maxAudit = Math.max(1, ...stats.auditByDay.map(item => item.count));

  // Compute Donut SVG parameters
  const totalUsers = stats.userCount;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  // Compute donut stroke segments if users > 0
  const donutSegments = ROLES_LIST.map((role, index) => {
    const count = stats.usersByRole[role.key] || 0;
    const percent = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const accumulatedPercent = ROLES_LIST.slice(0, index).reduce((sum, previousRole) => {
      const previousCount = stats.usersByRole[previousRole.key] || 0;
      return sum + (totalUsers > 0 ? (previousCount / totalUsers) * 100 : 0);
    }, 0);
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);

    return {
      ...role,
      count,
      percent: Math.round(percent),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="adm-dashboard-view">
      {/* 1. Header */}
      <div className="adm-page-header workspace-page-hero">
        <div>
          <h1 className="adm-page-title">
            Tổng quan
          </h1>
          <p className="adm-page-subtitle">
            Theo dõi vận hành, tài khoản và hoạt động tại Đường Sách TP.HCM.
          </p>
        </div>

        <div className="adm-page-header-actions">
          <button 
            type="button"
            className="adm-btn adm-btn-secondary" 
            onClick={() => onNavigateTab('users')}
          >
            <Users size={16} />
            <span>Danh sách người dùng</span>
          </button>
          <button 
            type="button"
            className="adm-btn adm-btn-primary" 
            onClick={onOpenAddUser}
          >
            <UserPlus size={16} />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards */}
      <div className="adm-kpi-grid">
        {/* Card 1: Tổng người dùng (Green Top Border) */}
        <div className="adm-kpi-card kpi-user" onClick={() => onNavigateTab('users')} style={{ cursor: 'pointer' }}>
          <div className="adm-kpi-top">
            <span className="adm-kpi-label">Tổng người dùng</span>
            <div className="adm-kpi-icon-wrap icon-emerald">
              <Users size={20} />
            </div>
          </div>
          <div className="adm-kpi-value">{stats.userCount.toLocaleString('vi-VN')}</div>
          <div className="adm-kpi-trend trend-neutral">
            <span>{lockedUsersCount} tài khoản đang khóa</span>
          </div>
        </div>

        {/* Card 2: Sự kiện nền tảng (Blue Top Border) */}
        <div className="adm-kpi-card kpi-event">
          <div className="adm-kpi-top">
            <span className="adm-kpi-label">Sự kiện nền tảng</span>
            <div className="adm-kpi-icon-wrap icon-blue">
              <Calendar size={20} />
            </div>
          </div>
          <div className="adm-kpi-value">{stats.eventCount.toLocaleString('vi-VN')}</div>
          <div className="adm-kpi-trend trend-neutral">
            <span>{stats.openEventCount} sự kiện đang công bố hoặc diễn ra</span>
          </div>
        </div>

        {/* Card 3: Gian hàng (Amber Top Border) */}
        <div className="adm-kpi-card kpi-booth">
          <div className="adm-kpi-top">
            <span className="adm-kpi-label">Gian hàng</span>
            <div className="adm-kpi-icon-wrap icon-amber">
              <Store size={20} />
            </div>
          </div>
          <div className="adm-kpi-value">{stats.boothCount.toLocaleString('vi-VN')}</div>
          <div className="adm-kpi-trend trend-neutral">
            <span>Gian hàng đang có trong hệ thống</span>
          </div>
        </div>

        {/* Card 4: Hoạt động hôm nay (Purple Top Border) */}
        <div className="adm-kpi-card kpi-activity">
          <div className="adm-kpi-top">
            <span className="adm-kpi-label">Hoạt động hôm nay</span>
            <div className="adm-kpi-icon-wrap icon-purple">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="adm-kpi-value">{stats.activityCount.toLocaleString('vi-VN')}</div>
          <div className="adm-kpi-trend trend-neutral">
            <span>{stats.todayActivityCount} hoạt động đã ghi nhận</span>
          </div>
        </div>
      </div>

      {/* 3. Middle Section (Charts Grid) */}
      <div className="adm-charts-grid">
        {/* Left: Thao tác quản trị 7 ngày qua */}
        <div className="admin-card adm-chart-card">
          <div className="adm-card-header">
            <div>
              <h3 className="adm-card-title">Thao tác quản trị 7 ngày qua</h3>
              <p className="adm-card-subtitle">Nhịp độ xử lý và điều hành hệ thống</p>
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 650,
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              padding: '0.2rem 0.65rem',
              borderRadius: '99px'
            }}>
              {totalAuditsLast7Days} thao tác
            </span>
          </div>

          <div className="adm-chart-container">
            <div className="adm-chart-bars-wrap">
              {stats.auditByDay.map((item) => {
                const heightPercent = maxAudit > 0 ? (item.count / maxAudit) * 100 : 0;
                const barHeight = Math.max(6, Math.round((heightPercent / 100) * 130));
                const dateObj = new Date(`${item.date}T00:00:00`);
                const weekdayStr = isNaN(dateObj.getTime()) ? item.date : dateObj.toLocaleDateString('vi-VN', { weekday: 'short' });
                const dateShortStr = isNaN(dateObj.getTime()) ? '' : `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

                return (
                  <div key={item.date} className="adm-chart-col" title={`${item.count} thao tác ngày ${item.date}`}>
                    <span className="adm-chart-bar-pill">{item.count}</span>
                    <div 
                      className="adm-chart-bar" 
                      style={{ height: `${barHeight}px` }}
                    />
                    <div className="adm-chart-col-label">
                      <span>{weekdayStr}</span>
                      <span className="adm-chart-col-date">{dateShortStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Cơ cấu người dùng (Donut + Legend) */}
        <div className="admin-card adm-donut-card">
          <div className="adm-card-header">
            <div>
              <h3 className="adm-card-title">Cơ cấu người dùng</h3>
              <p className="adm-card-subtitle">Phân bổ theo vai trò trong hệ thống</p>
            </div>
          </div>

          <div className="adm-donut-card-body">
            {/* Donut Chart Ring */}
            <div className="adm-donut-chart-wrap">
              <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  fill="transparent"
                  stroke={totalUsers === 0 ? '#8B3A3A' : '#E2E8F0'}
                  strokeWidth="14"
                />

                {/* Segments when users exist */}
                {totalUsers > 0 && donutSegments.map((seg) => (
                  <circle
                    key={seg.key}
                    cx="65"
                    cy="65"
                    r={radius}
                    fill="transparent"
                    stroke={seg.fillColor}
                    strokeWidth="14"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                  />
                ))}
              </svg>

              {/* Center Text */}
              <div className="adm-donut-center-text">
                <span className="adm-donut-center-number">{totalUsers}</span>
                <span className="adm-donut-center-label">người dùng</span>
              </div>
            </div>

            {/* Role Breakdown Rows */}
            <div className="adm-role-legend-list">
              {donutSegments.map((role) => (
                <div key={role.key} className="adm-role-legend-item">
                  <div className="adm-role-legend-row">
                    <div className="adm-role-legend-dot-name">
                      <span className="adm-role-legend-dot" style={{ background: role.dotColor }} />
                      <span>{role.label}</span>
                    </div>
                    <span className="adm-role-legend-percent">{role.percent}%</span>
                  </div>
                  <div className="adm-role-legend-line-track">
                    <div 
                      className="adm-role-legend-line-fill" 
                      style={{ 
                        width: `${Math.max(role.percent, role.count > 0 ? 5 : 0)}%`,
                        background: role.fillColor 
                      }} 
                    />
                  </div>
                  <span className="adm-role-legend-sub">{role.count} tài khoản</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Grid */}
      <div className="adm-bottom-grid">
        {/* Recent Audit Log */}
        <div className="admin-card">
          <div className="adm-card-header">
            <div>
              <h3 className="adm-card-title">Hoạt động quản trị gần đây</h3>
              <p className="adm-card-subtitle">Các thay đổi đã được ghi nhận</p>
            </div>
            <button 
              type="button"
              className="adm-link-btn" 
              onClick={() => onNavigateTab('audit')}
            >
              <span>Xem tất cả</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="adm-activity-list">
            {auditLogs.slice(0, 4).map((log) => (
              <div className="adm-activity-item" key={log.id}>
                <div className="adm-activity-left">
                  <div className="adm-activity-icon">
                    <Activity size={16} />
                  </div>
                  <div className="adm-activity-content">
                    <strong>{log.actionLabelVi}</strong>
                    <p>{log.actorName} · <span style={{ color: '#14241F', fontWeight: 600 }}>{log.targetObject}</span></p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#8C9E98', fontSize: '0.75rem' }}>
                  <Clock size={13} />
                  <span>{log.timestamp}</span>
                </div>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="adm-empty-state">
                <div className="adm-empty-state-icon">
                  <FileText size={22} />
                </div>
                <p className="adm-empty-state-text">Chưa có thao tác quản trị nào phát sinh gần đây.</p>
              </div>
            )}
          </div>
        </div>

        {/* Security & Account Health */}
        <div className="admin-card">
          <div className="adm-card-header">
            <div>
              <h3 className="adm-card-title">Trạng thái tài khoản</h3>
              <p className="adm-card-subtitle">Các tài khoản cần quản trị viên xem xét</p>
            </div>
          </div>

          <div className="adm-security-card-body">
            <div className="adm-security-tile">
              <div className="adm-security-tile-left">
                <div className={`adm-security-tile-icon ${lockedUsersCount > 0 ? 'red' : 'green'}`}>
                  {lockedUsersCount > 0 ? <UserX size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <div>
                  <div className="adm-security-tile-title">
                    {lockedUsersCount > 0 ? `${lockedUsersCount} tài khoản đang khóa` : '0 tài khoản đang khóa'}
                  </div>
                  <div className="adm-security-tile-sub">
                    {pendingUsersCount > 0 ? `${pendingUsersCount} tài khoản chờ xác minh` : '0 tài khoản chờ xác minh'}
                  </div>
                </div>
              </div>
              <span className={`adm-chip ${lockedUsersCount > 0 ? 'adm-chip-locked' : 'adm-chip-active'}`}>
                {lockedUsersCount > 0 ? 'Cần xử lý' : 'Bình thường'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                type="button"
                className="adm-btn adm-btn-secondary" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onNavigateTab('users')}
              >
                <span>Mở quản lý tài khoản</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
