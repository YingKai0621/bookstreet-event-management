import React from 'react';
import { Users, Calendar, Store, Sparkles, FileText, UserPlus, ArrowRight, ShieldAlert } from 'lucide-react';
import { AdminAuditLogItem, AdminUserAccount } from '../../types/admin';
import type { AdminDashboardStats } from '../../services/adminApi';

interface AdminDashboardViewProps {
  onNavigateTab: (tab: string) => void;
  auditLogs: AdminAuditLogItem[];
  users: AdminUserAccount[];
  stats: AdminDashboardStats;
  onOpenAddUser: () => void;
}

const roleLabels: Record<string, string> = {
  participant: 'Độc giả', partner: 'Đối tác', organizer: 'Ban tổ chức', admin: 'Quản trị viên',
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigateTab, auditLogs, users, stats, onOpenAddUser }) => {
  const lockedUsersCount = users.filter(user => user.status === 'locked').length;
  const maxAudit = Math.max(1, ...stats.auditByDay.map(item => item.count));

  return (
    <div className="adm-dashboard-view">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Tổng quan Quản trị Hệ thống</h1>
          <p className="adm-page-subtitle">Số liệu hiện tại được tổng hợp trực tiếp từ cơ sở dữ liệu.</p>
        </div>
        <div className="adm-page-header-actions">
          <button className="adm-btn adm-btn-secondary" onClick={() => onNavigateTab('audit')}><FileText size={16} /><span>Nhật ký Audit</span></button>
          <button className="adm-btn adm-btn-primary" onClick={onOpenAddUser}><UserPlus size={16} /><span>Thêm tài khoản</span></button>
        </div>
      </div>

      <div className="adm-kpi-grid">
        {[
          { label: 'Tổng người dùng', value: stats.userCount, note: `${lockedUsersCount} tài khoản đang khóa`, icon: <Users size={20} />, cls: 'icon-emerald' },
          { label: 'Sự kiện nền tảng', value: stats.eventCount, note: `${stats.openEventCount} sự kiện đang công bố hoặc diễn ra`, icon: <Calendar size={20} />, cls: 'icon-blue' },
          { label: 'Gian hàng', value: stats.boothCount, note: 'Gian hàng đang có trong hệ thống', icon: <Store size={20} />, cls: 'icon-amber' },
          { label: 'Hoạt động', value: stats.activityCount, note: `${stats.todayActivityCount} hoạt động diễn ra hôm nay`, icon: <Sparkles size={20} />, cls: 'icon-purple' },
        ].map(card => (
          <div className="adm-kpi-card" key={card.label}>
            <div className="adm-kpi-top"><span className="adm-kpi-label">{card.label}</span><div className={`adm-kpi-icon-wrap ${card.cls}`}>{card.icon}</div></div>
            <div className="adm-kpi-value">{card.value.toLocaleString('vi-VN')}</div>
            <div className="adm-kpi-trend trend-neutral"><span>{card.note}</span></div>
          </div>
        ))}
      </div>

      <div className="adm-charts-grid">
        <div className="adm-card adm-chart-card">
          <div className="adm-card-header"><div><h3 className="adm-card-title">Thao tác quản trị 7 ngày qua</h3><p className="adm-card-subtitle">Dữ liệu từ nhật ký audit</p></div></div>
          <div style={{ height: 210, display: 'flex', alignItems: 'flex-end', gap: 18, padding: '18px 12px 8px' }}>
            {stats.auditByDay.map(item => (
              <div key={item.date} style={{ flex: 1, minWidth: 34, textAlign: 'center' }} title={`${item.count} thao tác`}>
                <strong style={{ display: 'block', fontSize: 12, marginBottom: 5 }}>{item.count}</strong>
                <div style={{ height: Math.max(4, item.count / maxAudit * 135), background: '#1A3028', borderRadius: '6px 6px 2px 2px' }} />
                <span style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 7 }}>{new Date(`${item.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="adm-card adm-donut-card">
          <div className="adm-card-header"><div><h3 className="adm-card-title">Cơ cấu người dùng</h3><p className="adm-card-subtitle">Phân bổ theo vai trò trong SQL</p></div></div>
          <div className="adm-donut-legend" style={{ marginTop: 20 }}>
            {Object.entries(roleLabels).map(([role, label]) => {
              const count = stats.usersByRole[role] || 0;
              const percent = stats.userCount ? Math.round(count / stats.userCount * 100) : 0;
              return <div className="adm-donut-legend-row" key={role}><span className="adm-donut-name">{label}</span><span className="adm-donut-val">{percent}% ({count})</span></div>;
            })}
          </div>
        </div>
      </div>

      <div className="adm-bottom-grid">
        <div className="adm-card">
          <div className="adm-card-header"><div><h3 className="adm-card-title">Hoạt động quản trị gần đây</h3><p className="adm-card-subtitle">Các thay đổi đã được ghi nhận</p></div><button className="adm-link-btn" onClick={() => onNavigateTab('audit')}><span>Xem tất cả</span><ArrowRight size={14} /></button></div>
          <div className="adm-activity-list">
            {auditLogs.slice(0, 5).map(log => <div className="adm-activity-item" key={log.id}><div className="adm-activity-content"><strong>{log.actionLabelVi}</strong><p>{log.actorName} · {log.targetObject}</p></div><span className="adm-activity-time">{log.timestamp}</span></div>)}
            {!auditLogs.length && <p className="adm-card-subtitle">Chưa có thao tác quản trị.</p>}
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-header"><div><h3 className="adm-card-title">Trạng thái tài khoản</h3><p className="adm-card-subtitle">Các tài khoản cần quản trị viên xem xét</p></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 0' }}><ShieldAlert size={24} color={lockedUsersCount ? '#DC2626' : '#16A34A'} /><div><strong>{lockedUsersCount} tài khoản đang khóa</strong><p className="adm-card-subtitle">{users.filter(user => user.status === 'pending_verification').length} tài khoản chờ xác minh</p></div></div>
          <button className="adm-btn adm-btn-secondary" onClick={() => onNavigateTab('users')}>Mở quản lý tài khoản</button>
        </div>
      </div>
    </div>
  );
};

