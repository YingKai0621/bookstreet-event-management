import { apiClient } from './apiClient';
import type { AdminBadge, AdminBadgeInput, BadgeMutationResult, BadgeSynchronizationResult, RewardManagementPage } from '../types/rewardManagement';

interface BadgeQuery { page: number; size: number; sort?: string; search?: string; active?: boolean }
export const badgeAdminApi = {
  list: (query: BadgeQuery) => {
    const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
    if (query.sort) params.set('sort', query.sort);
    if (query.search) params.set('search', query.search);
    if (query.active !== undefined) params.set('active', String(query.active));
    return apiClient.get<RewardManagementPage<AdminBadge>>(`/admin/badges?${params}`);
  },
  detail: (badgeId: number) => apiClient.get<AdminBadge>(`/admin/badges/${badgeId}`),
  create: (input: AdminBadgeInput) => apiClient.post<BadgeMutationResult>('/admin/badges', input),
  update: (badgeId: number, input: AdminBadgeInput) => apiClient.put<BadgeMutationResult>(`/admin/badges/${badgeId}`, input),
  synchronize: (badgeId: number) => apiClient.post<BadgeSynchronizationResult>(`/admin/badges/${badgeId}/synchronize-awards`),
};
