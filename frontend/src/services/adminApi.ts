import { AdminProfile } from '../types/admin';
import { apiClient } from './apiClient';

export const adminApi = {
  async getProfile(): Promise<AdminProfile> {
    const user = await apiClient.get<any>('/admin/profile');
    return { id: user.id, name: user.fullName, role: 'Administrator', department: user.department || '', email: user.email, phone: user.phone || '', avatarInitials: user.fullName.split(' ').map((part: string) => part[0]).join('').slice(-2).toUpperCase(), avatarUrl: user.avatarUrl || undefined, lastLogin: user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('vi-VN') : '' };
  },
  updateProfile: (data: unknown) => apiClient.patch('/admin/profile', data),
  changePassword: (currentPassword: string, newPassword: string) => apiClient.post('/admin/profile/password', { currentPassword, newPassword }),
};
