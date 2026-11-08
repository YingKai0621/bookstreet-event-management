import { ApiError, apiClient } from './apiClient';

export type AdminDashboardRequestState = 'loading' | 'ready' | 'expired' | 'forbidden' | 'failed';

interface AdminDashboardResponse {
  accounts: {
    total: number;
    byRole: Record<'PARTICIPANT' | 'PARTNER' | 'ORGANIZER' | 'ADMIN', number>;
    byStatus: Record<'ACTIVE' | 'DISABLED', number>;
  };
  events: {
    total: number;
    byStatus: Record<'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED', number>;
  };
  activeBoothAssignments: number;
  boothRevenue: number;
  auditByDay: Array<{ date: string; count: number }>;
}

export interface AdminDashboardStats extends Partial<AdminDashboardResponse> {
  requestState?: AdminDashboardRequestState;
  // The shared AdminPortal initializer is maintained by Developer A and still supplies legacy placeholder keys.
  [key: string]: unknown;
}

function isDashboardResponse(value: AdminDashboardResponse): boolean {
  return typeof value?.accounts?.total === 'number'
    && typeof value.accounts.byRole?.PARTICIPANT === 'number'
    && typeof value.accounts.byRole?.PARTNER === 'number'
    && typeof value.accounts.byRole?.ORGANIZER === 'number'
    && typeof value.accounts.byRole?.ADMIN === 'number'
    && typeof value.accounts.byStatus?.ACTIVE === 'number'
    && typeof value.accounts.byStatus?.DISABLED === 'number'
    && typeof value.events?.total === 'number'
    && typeof value.events.byStatus?.DRAFT === 'number'
    && typeof value.events.byStatus?.PUBLISHED === 'number'
    && typeof value.events.byStatus?.ONGOING === 'number'
    && typeof value.events.byStatus?.COMPLETED === 'number'
    && typeof value.events.byStatus?.CANCELLED === 'number'
    && typeof value.activeBoothAssignments === 'number'
    && typeof value.boothRevenue === 'number'
    && Array.isArray(value.auditByDay)
    && value.auditByDay.length === 7
    && value.auditByDay.every((day) => typeof day.date === 'string' && typeof day.count === 'number');
}

export const adminDashboardApi = {
  get: async (): Promise<AdminDashboardStats> => {
    try {
      const response = await apiClient.get<AdminDashboardResponse>('/admin/dashboard');
      if (!isDashboardResponse(response)) throw new Error('Invalid Admin dashboard response');
      return { ...response, requestState: 'ready' };
    } catch (error) {
      const requestState = error instanceof ApiError && error.status === 401
        ? 'expired'
        : error instanceof ApiError && error.status === 403
          ? 'forbidden'
          : 'failed';
      return { requestState };
    }
  },
};
