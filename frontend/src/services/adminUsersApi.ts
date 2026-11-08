import { AdminRoleType, AdminUserAccount } from '../types/admin';
import { apiClient } from './apiClient';

export const adminUsersApi = {
  // Lấy danh sách người dùng
  async getUsers(): Promise<AdminUserAccount[]> {
    const res = await apiClient.get<any[]>('/admin/users');
    return res.map((u: any) => {
      const role = String(u.primaryRole || u.role).toLowerCase() as AdminRoleType;
      const status = u.status === 'DISABLED' ? 'locked' : 'active';
      return {
          id: u.id,
          code: u.code,
          fullName: u.fullName,
          email: u.email || '',
          phone: u.phone || '',
          role,
          roleLabelVi: role === 'admin' ? 'Quản trị viên' : role === 'organizer' ? 'Ban Tổ Chức' : role === 'partner' ? 'Đối tác' : 'Độc giả',
          status,
          statusLabelVi: status === 'locked' ? 'Đã khóa' : 'Hoạt động',
          lastActive: u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN') : 'Chưa có hoạt động',
          createdDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '',
          avatarInitials: u.fullName ? u.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '',
        };
    });
  },

  createUser: (data: { username: string; fullName: string; email: string; phone?: string; role: AdminRoleType; status: string; password?: string }) => apiClient.post<any>('/admin/users', data),
  updateUser: (id: string, data: unknown) => apiClient.patch<any>(`/admin/users/${encodeURIComponent(id)}`, data),

  // Khóa / Mở khóa tài khoản
  async updateUserStatus(userId: string, status: string, reason?: string): Promise<any> {
    return await apiClient.patch(`/admin/users/${userId}/status`, { status, reason });
  },
};
