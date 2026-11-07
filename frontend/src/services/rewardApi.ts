import type {
  RewardBadgePageResponse,
  RewardPointPageResponse,
  RewardSummaryResponse,
} from '../types/reward';
import { apiClient } from './apiClient';

export const rewardApi = {
  getSummary: () => apiClient.get<RewardSummaryResponse>('/participant/rewards/summary'),

  getBadges: (query: {
    page?: number;
    size?: number;
    state?: 'ALL' | 'EARNED' | 'IN_PROGRESS';
    sort?: string;
  } = {}) => {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 12),
      state: query.state ?? 'ALL',
    });
    if (query.sort) params.set('sort', query.sort);
    return apiClient.get<RewardBadgePageResponse>(`/participant/rewards/badges?${params.toString()}`);
  },

  getPointTransactions: (query: {
    page?: number;
    size?: number;
    sort?: string;
    eventId?: number;
    boothId?: number;
  } = {}) => {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 10),
      sort: query.sort ?? 'createdAt,desc',
    });
    if (query.eventId) params.set('eventId', String(query.eventId));
    if (query.boothId) params.set('boothId', String(query.boothId));
    return apiClient.get<RewardPointPageResponse>(
      `/participant/rewards/point-transactions?${params.toString()}`,
    );
  },
};
