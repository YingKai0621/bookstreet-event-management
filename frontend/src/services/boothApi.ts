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
import { apiClient } from './apiClient';

const UPLOADED_BOOTH_IMAGE_PREFIX = '/api/v1/media/booth-images/';

const publicEventBoothsCache = new Map<string, { rows?: EventBooth[]; inflight?: Promise<EventBooth[]> }>();

function publicEventBoothsCacheKey(
  eventId: string,
  filters: { availability?: BoothAvailability; categoryCode?: string } = {},
): string {
  return `${eventId}|${filters.availability ?? ''}|${filters.categoryCode ?? ''}`;
}

export function getCachedPublicEventBooths(
  eventId: string,
  filters: { availability?: BoothAvailability; categoryCode?: string } = {},
): EventBooth[] | undefined {
  return publicEventBoothsCache.get(publicEventBoothsCacheKey(eventId, filters))?.rows;
}

export function clearPublicEventBoothsCache(): void {
  publicEventBoothsCache.clear();
}

function withQuery(path: string, values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function loadAllPages<T>(
  pathForPage: (page: number) => string,
): Promise<T[]> {
  const firstPage = await apiClient.get<PageResponse<T>>(pathForPage(0));
  if (firstPage.totalPages <= 1) return firstPage.content;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      apiClient.get<PageResponse<T>>(pathForPage(index + 1)),
    ),
  );
  return [firstPage, ...remainingPages]
    .sort((left, right) => left.page - right.page)
    .flatMap(page => page.content);
}

export const boothApi = {
  listPhysicalBooths: (active?: boolean) => apiClient.get<PageResponse<PhysicalBooth>>(
    withQuery('/organizer/booths', { page: 0, size: 100, sort: 'code,asc', active }),
  ),

  listAllPhysicalBooths: (active?: boolean) => loadAllPages<PhysicalBooth>(page =>
    withQuery('/organizer/booths', { page, size: 100, sort: 'code,asc', active }),
  ),

  createPhysicalBooth: (input: CreatePhysicalBoothInput) => {
    clearPublicEventBoothsCache();
    return apiClient.post<PhysicalBooth>('/organizer/booths', input);
  },

  updatePhysicalBooth: (boothId: number, input: UpdatePhysicalBoothInput) => {
    clearPublicEventBoothsCache();
    return apiClient.patch<PhysicalBooth>(`/organizer/booths/${boothId}`, input);
  },

  async uploadBoothImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.postForm<{ url: string }>(
      '/organizer/booth-images',
      formData,
    );
    return response.url;
  },

  deleteUploadedBoothImage(imageUrl: string): Promise<void> {
    if (!imageUrl.startsWith(UPLOADED_BOOTH_IMAGE_PREFIX)) return Promise.resolve();
    const fileName = imageUrl.slice(UPLOADED_BOOTH_IMAGE_PREFIX.length);
    if (!fileName || fileName.includes('/')) return Promise.resolve();
    return apiClient.delete<void>(
      `/organizer/booth-images/${encodeURIComponent(fileName)}`,
    );
  },

  listEventBoothConfigurations: (eventId: string) =>
    apiClient.get<EventBooth[]>(`/organizer/events/${encodeURIComponent(eventId)}/booth-configs`),

  configureEventBooth: (eventId: string, boothId: number, rentalPrice: number, enabled: boolean) => {
    clearPublicEventBoothsCache();
    return apiClient.put<EventBooth>(
      `/organizer/events/${encodeURIComponent(eventId)}/booth-configs/${boothId}`,
      { rentalPrice, enabled },
    );
  },

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

  listAllPublicEventBooths: (
    eventId: string,
    filters: { availability?: BoothAvailability; categoryCode?: string } = {},
  ) => {
    const key = publicEventBoothsCacheKey(eventId, filters);
    const existing = publicEventBoothsCache.get(key);
    if (existing?.rows) return Promise.resolve(existing.rows);
    if (existing?.inflight) return existing.inflight;

    const inflight = loadAllPages<EventBooth>(page =>
      withQuery(`/events/${encodeURIComponent(eventId)}/booths`, {
        page,
        size: 100,
        sort: 'code,asc',
        availability: filters.availability,
        categoryCode: filters.categoryCode,
      }),
    )
      .then(rows => {
        publicEventBoothsCache.set(key, { rows });
        return rows;
      })
      .catch(error => {
        publicEventBoothsCache.delete(key);
        throw error;
      });

    publicEventBoothsCache.set(key, { inflight });
    return inflight;
  },

  submitRequest: (eventId: string, boothId: number, requestNote: string | null) => {
    clearPublicEventBoothsCache();
    return apiClient.post<BoothRequest>(
      `/events/${encodeURIComponent(eventId)}/booth-requests`,
      { boothId, requestNote },
    );
  },

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

  listAllPartnerRequests: (eventId?: string, status?: BoothRequestStatus) =>
    loadAllPages<BoothRequest>(page => withQuery('/partner/booth-requests', {
      page, size: 100, sort: 'submittedAt,desc', eventId, status,
    })),

  getPartnerRequest: (boothRequestId: number) =>
    apiClient.get<BoothRequest>(`/partner/booth-requests/${boothRequestId}`),

  withdrawRequest: (boothRequestId: number) => {
    clearPublicEventBoothsCache();
    return apiClient.post<BoothRequest>(`/partner/booth-requests/${boothRequestId}/withdraw`);
  },

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

  listAllOrganizerRequests: (eventId: string, boothId?: number, status?: BoothRequestStatus) =>
    loadAllPages<BoothRequest>(page => withQuery(`/organizer/events/${encodeURIComponent(eventId)}/booth-requests`, {
      page, size: 100, sort: 'submittedAt,asc', boothId, status,
    })),

  selectRequest: (eventId: string, boothRequestId: number) => {
    clearPublicEventBoothsCache();
    return apiClient.post<BoothRequest>(
      `/organizer/events/${encodeURIComponent(eventId)}/booth-requests/${boothRequestId}/select`,
    );
  },

  rejectRequest: (eventId: string, boothRequestId: number, reviewNote: string) => {
    clearPublicEventBoothsCache();
    return apiClient.post<BoothRequest>(
      `/organizer/events/${encodeURIComponent(eventId)}/booth-requests/${boothRequestId}/reject`,
      { reviewNote },
    );
  },
};
