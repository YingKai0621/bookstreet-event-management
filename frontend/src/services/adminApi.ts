import { apiClient } from './apiClient';
import {
  AdminUserAccount,
  AdminAuditLogItem,
  AdminBadgeRule,
  AdminSystemSettings,
  AdminRolePermissionConfig,
  AdminNotificationItem,
  AdminProfile,
  AdminRoleType,
  AdminPermissionItem
} from '../types/admin';

export interface AdminDashboardStats {
  userCount: number;
  eventCount: number;
  openEventCount: number;
  boothCount: number;
  activityCount: number;
  todayActivityCount: number;
  usersByRole: Record<string, number>;
  auditByDay: Array<{ date: string; count: number }>;
}

export const adminApi = {
  getDashboard: () => apiClient.get<AdminDashboardStats>('/admin/dashboard'),
  async getBadgeRules(): Promise<AdminBadgeRule[]> {
    const [rules, settings] = await Promise.all([
      apiClient.get<any[]>('/admin/badge-rules'), apiClient.get<Array<{ key: string; value: unknown }>>('/admin/settings'),
    ]);
    const activeById = new Map(settings.filter(item => item.key.startsWith('badge_rule_active:')).map(item => [item.key.slice('badge_rule_active:'.length), Boolean(item.value)]));
    return rules.map(rule => ({
      id: rule.id, code: rule.code, name: rule.title, nameEn: rule.title,
      iconType: rule.iconName, pointsThreshold: rule.minPoints,
      status: activeById.get(rule.id) === false ? 'inactive' : 'active', statusLabelVi: activeById.get(rule.id) === false ? 'Tạm dừng' : 'Đang áp dụng', description: rule.description || '',
      descriptionEn: rule.description || '', perks: [],
    }));
  },
  async updateBadgeRule(id: string, updates: Partial<AdminBadgeRule>): Promise<AdminBadgeRule> {
    const rule = await apiClient.put<any>(`/admin/badge-rules/${encodeURIComponent(id)}`, {
      code: updates.code, title: updates.name, iconName: updates.iconType,
      minPoints: updates.pointsThreshold, description: updates.description,
      isActive: updates.status === undefined ? undefined : updates.status === 'active',
    });
    return {
      id: rule.id, code: rule.code, name: rule.title, nameEn: updates.nameEn || rule.title,
      iconType: rule.iconName, pointsThreshold: rule.minPoints,
      status: rule.isActive === false ? 'inactive' : 'active', statusLabelVi: rule.isActive === false ? 'Tạm dừng' : 'Đang áp dụng',
      description: rule.description || '', descriptionEn: updates.descriptionEn || rule.description || '', perks: updates.perks || [],
    };
  },
  async createBadgeRule(rule: Omit<AdminBadgeRule, 'id'>): Promise<AdminBadgeRule> {
    const created = await apiClient.post<any>('/admin/badge-rules', {
      code: rule.code, title: rule.name, iconName: rule.iconType,
      minPoints: rule.pointsThreshold, description: rule.description,
    });
    return {
      id: created.id, code: created.code, name: created.title, nameEn: created.title,
      iconType: created.iconName, pointsThreshold: created.minPoints,
      status: 'active', statusLabelVi: 'Đang áp dụng', description: created.description || '',
      descriptionEn: created.description || '', perks: [],
    };
  },
  // Lấy danh sách người dùng
  async getUsers(): Promise<AdminUserAccount[]> {
    const res = await apiClient.get<any[]>('/admin/users');
    return res.map((u: any) => ({
          id: u.id,
          code: u.code || `U-${u.id.slice(0, 4)}`,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone || '',
          role: (u.primaryRole || u.role || 'participant') as any,
          roleLabelVi: u.primaryRole === 'admin' ? 'Quản trị viên' : u.primaryRole === 'organizer' ? 'Ban Tổ Chức' : u.primaryRole === 'partner' ? 'Đối tác' : 'Độc giả',
          status: (u.status || 'active') as any,
          statusLabelVi: u.status === 'locked' ? 'Đã khóa' : 'Hoạt động',
          lastActive: u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN') : 'Chưa có hoạt động',
          createdDate: new Date(u.createdAt || Date.now()).toLocaleDateString('vi-VN'),
          avatarInitials: u.fullName ? u.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'US',
        }));
  },

  createUser: (data: { username: string; fullName: string; email: string; phone?: string; role: AdminRoleType; status: string; password?: string }) => apiClient.post<any>('/admin/users', data),
  updateUser: (id: string, data: unknown) => apiClient.patch<any>(`/admin/users/${encodeURIComponent(id)}`, data),

  // Khóa / Mở khóa tài khoản
  async updateUserStatus(userId: string, status: string, reason?: string): Promise<any> {
    return await apiClient.patch(`/admin/users/${userId}/status`, { status, reason });
  },
  resetPassword: (userId: string) => apiClient.post<{ resetToken: string; expiresInMinutes: number }>(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {}),

  async getRoles(): Promise<Record<AdminRoleType, AdminRolePermissionConfig>> {
    const roles = await apiClient.get<any[]>('/admin/roles');
    const result = {} as Record<AdminRoleType, AdminRolePermissionConfig>;
    for (const role of roles) result[role.code as AdminRoleType] = {
      roleId: role.code, roleName: role.name, description: role.description || '',
      assignedPermissionCodes: role.rolePerms.map((entry: any) => entry.permission.code),
    };
    return result;
  },
  async getPermissions(): Promise<AdminPermissionItem[]> {
    const rows = await apiClient.get<any[]>('/admin/permissions');
    return rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      nameEn: row.name,
      description: row.description || '',
      module: row.module as AdminPermissionItem['module'],
      moduleLabelVi: row.module,
    }));
  },
  saveRolePermissions: (roleId: AdminRoleType, permissionCodes: string[]) => apiClient.put(`/admin/roles/${encodeURIComponent(roleId)}/permissions`, { permissionCodes }),

  async getSettings(): Promise<AdminSystemSettings> {
    const rows = await apiClient.get<Array<{ key: string; value: unknown }>>('/admin/settings');
    const saved = rows.find(row => row.key === 'admin.system')?.value;
    if (!saved || typeof saved !== 'object') throw new Error('Cấu hình hệ thống chưa được khởi tạo');
    return saved as AdminSystemSettings;
  },
  saveSettings: (settings: AdminSystemSettings) => apiClient.put('/admin/settings', { 'admin.system': settings }),

  async getProfile(): Promise<AdminProfile> {
    const user = await apiClient.get<any>('/admin/profile');
    return { id: user.id, name: user.fullName, role: 'Administrator', department: user.department || '', email: user.email, phone: user.phone || '', avatarInitials: user.fullName.split(' ').map((part: string) => part[0]).join('').slice(-2).toUpperCase(), avatarUrl: user.avatarUrl || undefined, lastLogin: user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('vi-VN') : '' };
  },
  updateProfile: (data: unknown) => apiClient.patch('/admin/profile', data),
  changePassword: (currentPassword: string, newPassword: string) => apiClient.post('/admin/profile/password', { currentPassword, newPassword }),
  async getNotifications(): Promise<AdminNotificationItem[]> {
    const rows = await apiClient.get<any[]>('/admin/notifications');
    return rows.map(item => ({ id: item.id, title: item.title, content: item.message, category: ['security', 'account', 'role'].includes(item.kind) ? item.kind : 'system', timeAgo: new Date(item.createdAt).toLocaleString('vi-VN'), isRead: item.isRead, targetTab: item.link }));
  },
  markNotificationRead: (id: string) => apiClient.patch(`/admin/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllNotificationsRead: () => apiClient.patch('/admin/notifications/read-all', {}),

  // Lấy nhật ký hệ thống (Audit Logs)
  async getAuditLogs(): Promise<AdminAuditLogItem[]> {
    const res = await apiClient.get<any[]>('/admin/audit-logs');
    return res.map((log: any) => ({
          id: log.id,
          timestamp: new Date(log.createdAt).toLocaleString('vi-VN'),
          actorName: log.actor?.fullName || 'Quản trị viên',
          actorEmail: log.actor?.email || 'admin@duongsach.example.vn',
          actorRole: log.actor?.primaryRole || 'admin',
          actionType: (log.action || 'update') as any,
          actionLabelVi: log.action || 'Thực hiện thao tác',
          targetObject: log.targetType || 'Hệ thống',
          details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
          status: 'success',
          ipAddress: log.ipAddress || '127.0.0.1',
        }));
  },

  // Lấy thống kê phản hồi
  async getFeedbackStats(): Promise<any> {
    return await apiClient.get<any>('/admin/feedbacks/stats');
  },
};

