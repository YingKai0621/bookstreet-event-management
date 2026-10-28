import { apiClient } from './apiClient';
import type { OrganizerBoothVisit, OrganizerBoothVisitGroup, OrganizerBoothVisitSummary, RewardManagementPage } from '../types/rewardManagement';

interface VisitQuery { page: number; size: number; sort: string; search?: string; boothId?: number }
function queryString(query: VisitQuery): string {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size), sort: query.sort });
  if (query.search) params.set('search', query.search);
  if (query.boothId !== undefined) params.set('boothId', String(query.boothId));
  return params.toString();
}

export const boothVisitApi = {
  summary: (eventId: string) => apiClient.get<OrganizerBoothVisitSummary>(`/organizer/events/${encodeURIComponent(eventId)}/booth-visits/summary`),
  groups: (eventId: string, query: VisitQuery) => apiClient.get<RewardManagementPage<OrganizerBoothVisitGroup>>(`/organizer/events/${encodeURIComponent(eventId)}/booth-visit-groups?${queryString(query)}`),
  visits: (eventId: string, query: VisitQuery) => apiClient.get<RewardManagementPage<OrganizerBoothVisit>>(`/organizer/events/${encodeURIComponent(eventId)}/booth-visits?${queryString(query)}`),
};
