import { apiClient } from './apiClient';

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

export const adminDashboardApi = {
  get: () => apiClient.get<AdminDashboardStats>('/admin/dashboard'),
};
