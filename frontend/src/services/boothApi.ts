import { apiClient } from './apiClient';
import type {
  BoothAvailability,
  BoothRequest,
  BoothRequestStatus,
  CreatePhysicalBoothInput,
  EventBooth,
  PageResponse,
  PhysicalBooth,
  UpdatePhysicalBoothInput,
} from '../types/booth';

function withQuery(path: string, values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const boothApi = {
  listPhysicalBooths: (active?: boolean) => apiClient.get<PageResponse<PhysicalBooth>>(
    withQuery('/organizer/booths', { page: 0, size: 100, sort: 'code,asc', active }),
  ),

  createPhysicalBooth: (input: CreatePhysicalBoothInput) =>
    apiClient.post<PhysicalBooth>('/organizer/booths', input),

  updatePhysicalBooth: (boothId: number, input: UpdatePhysicalBoothInput) =>
    apiClient.patch<PhysicalBooth>(`/organizer/booths/${boothId}`, input),

  listEventBoothConfigurations: (eventId: string) =>
    apiClient.get<EventBooth[]>(`/organizer/events/${encodeURIComponent(eventId)}/booth-configs`),

  configureEventBooth: (eventId: string, boothId: number, rentalPrice: number, enabled: boolean) =>
    apiClient.put<EventBooth>(
      `/organizer/events/${encodeURIComponent(eventId)}/booth-configs/${boothId}`,
      { rentalPrice, enabled },
    ),

  listPublicEventBooths: (
    eventId: string,
    filters: { availability?: BoothAvailability; categoryCode?: string } = {},
  ) => apiClient.get<PageResponse<EventBooth>>(
    withQuery(`/events/${encodeURIComponent(eventId)}/booths`, {
      page: 0,
      size: 100,
      sort: 'code,asc',
      availability: filters.availability,
      categoryCode: filters.categoryCode,
    }),
  ),

  submitRequest: (eventId: string, boothId: number, requestNote: string | null) =>
    apiClient.post<BoothRequest>(
      `/events/${encodeURIComponent(eventId)}/booth-requests`,
      { boothId, requestNote },
    ),

  listPartnerRequests: (eventId?: string, status?: BoothRequestStatus) =>
    apiClient.get<PageResponse<BoothRequest>>(
      withQuery('/partner/booth-requests', {
        page: 0,
        size: 100,
        sort: 'submittedAt,desc',
        eventId,
        status,
      }),
    ),

  getPartnerRequest: (boothRequestId: number) =>
    apiClient.get<BoothRequest>(`/partner/booth-requests/${boothRequestId}`),

  withdrawRequest: (boothRequestId: number) =>
    apiClient.post<BoothRequest>(`/partner/booth-requests/${boothRequestId}/withdraw`, {}),

  listOrganizerRequests: (eventId: string, boothId?: number, status?: BoothRequestStatus) =>
    apiClient.get<PageResponse<BoothRequest>>(
      withQuery(`/organizer/events/${encodeURIComponent(eventId)}/booth-requests`, {
        page: 0,
        size: 100,
        sort: 'submittedAt,asc',
        boothId,
        status,
      }),
    ),

  selectRequest: (eventId: string, boothRequestId: number) =>
    apiClient.post<BoothRequest>(
      `/organizer/events/${encodeURIComponent(eventId)}/booth-requests/${boothRequestId}/select`,
      {},
    ),

  rejectRequest: (eventId: string, boothRequestId: number, reviewNote: string) =>
    apiClient.post<BoothRequest>(
      `/organizer/events/${encodeURIComponent(eventId)}/booth-requests/${boothRequestId}/reject`,
      { reviewNote },
    ),
};
