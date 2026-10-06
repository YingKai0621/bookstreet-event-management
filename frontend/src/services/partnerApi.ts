import { ApiError, apiClient } from './apiClient';
import { PartnerActivityProposal, PartnerBooth, PartnerEventApplication, PartnerNotification, PartnerOrganization, PartnerReportStats } from '../types';

interface PageResponse<T> {
  content: T[];
  page?: number;
  number?: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface PartnerOrganizationResponse {
  partnerOrganizationId: number;
  name: string;
  description: string | null;
  categoryCode: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

interface PartnerApplicationResponse {
  applicationId: number;
  eventId: number;
  partnerOrganizationId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  applicationNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

interface PublicEventResponse {
  eventId: number;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  bannerUrl: string | null;
  status: 'PUBLISHED';
}

export interface PartnerAvailableEvent {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string | null;
  bannerUrl: string;
  acceptingApplications: boolean;
}

export interface PartnerBoothContent {
  name: string;
  description: string;
  dimensions: string;
  areaName: string;
  categories: string[];
  images: Array<{ id: string; url: string; caption: string }>;
  documents: Array<{ id: string; name: string; size: string; dataUrl?: string }>;
}

const formatDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

const formatDateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
}) : '';

function normalizeOptionalText(value: string | null): string {
  if (value === null) return '';

  const normalizedValue = value.trim();
  if (normalizedValue.toLowerCase() === 'null') return '';
  if (normalizedValue.toLowerCase() === 'undefined') return '';
  return normalizedValue;
}

function toPartnerOrganization(organization: PartnerOrganizationResponse): PartnerOrganization {
  return {
    id: String(organization.partnerOrganizationId),
    name: organization.name,
    shortDesc: normalizeOptionalText(organization.description),
    categoryCode: organization.categoryCode,
    logoUrl: normalizeOptionalText(organization.logoUrl) || undefined,
    representativeName: '',
    email: normalizeOptionalText(organization.contactEmail),
    phone: normalizeOptionalText(organization.contactPhone),
    address: normalizeOptionalText(organization.address),
    website: '',
    categories: [organization.categoryCode],
    status: organization.status,
    isVerified: organization.status === 'ACTIVE',
  };
}

function toAvailableEvent(event: PublicEventResponse): PartnerAvailableEvent {
  const deadline = event.partnerApplicationDeadlineAt
    ? new Date(event.partnerApplicationDeadlineAt).getTime()
    : null;

  return {
    id: String(event.eventId),
    name: event.name,
    description: event.description || '',
    startAt: event.startAt,
    endAt: event.endAt,
    partnerApplicationDeadlineAt: event.partnerApplicationDeadlineAt,
    bannerUrl: event.bannerUrl || '',
    acceptingApplications: deadline !== null && deadline > Date.now(),
  };
}

async function loadPublishedEvents(): Promise<PartnerAvailableEvent[]> {
  const query = new URLSearchParams({ page: '0', size: '100', sort: 'startAt,asc' });
  const response = await apiClient.get<PageResponse<PublicEventResponse>>(`/events?${query.toString()}`);
  return response.content.map(toAvailableEvent);
}

export const partnerApi = {
  async getProfile(): Promise<PartnerOrganization | null> {
    try {
      const organization = await apiClient.get<PartnerOrganizationResponse>('/partner/organization');
      return toPartnerOrganization(organization);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PARTNER_ORGANIZATION_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  },
  async updateProfile(data: Partial<PartnerOrganization>): Promise<PartnerOrganization> {
    const organization = await apiClient.put<PartnerOrganizationResponse>('/partner/organization', {
      name: data.name,
      description: data.shortDesc || null,
      categoryCode: data.categoryCode || data.categories?.[0] || 'OTHER',
      logoUrl: data.logoUrl || null,
      contactEmail: data.email || null,
      contactPhone: data.phone || null,
      address: data.address || null,
    });
    return toPartnerOrganization(organization);
  },
  async getPublishedEvents(): Promise<PartnerAvailableEvent[]> {
    return loadPublishedEvents();
  },
  async getApplications(): Promise<PartnerEventApplication[]> {
    const query = new URLSearchParams({ page: '0', size: '100', sort: 'submittedAt,desc' });
    const [response, events] = await Promise.all([
      apiClient.get<PageResponse<PartnerApplicationResponse>>(`/partner/applications?${query.toString()}`),
      loadPublishedEvents(),
    ]);
    const eventById = new Map(events.map(event => [event.id, event]));

    return response.content.map(application => {
      const event = eventById.get(String(application.eventId));
      return {
        id: String(application.applicationId),
        eventId: String(application.eventId),
        eventTitle: event?.name || `Sự kiện #${application.eventId}`,
        dateRange: event ? `${formatDateTime(event.startAt)} - ${formatDateTime(event.endAt)}` : '',
        location: 'Đường Sách TP.HCM',
        imageUrl: event?.bannerUrl || '',
        status: application.status.toLowerCase() as PartnerEventApplication['status'],
        applicationNote: application.applicationNote || '',
        reviewNote: application.reviewNote || '',
        submittedAt: formatDateTime(application.submittedAt),
        reviewedAt: formatDateTime(application.reviewedAt),
        withdrawnAt: formatDateTime(application.withdrawnAt),
        organizationName: '',
        shortDesc: '',
        representativeName: '',
        email: '',
        phone: '',
      };
    });
  },
  getBooths: (eventId: string) => apiClient.get<PartnerBooth[]>(`/partner/booths?eventId=${encodeURIComponent(eventId)}`),
  getBoothContent: (boothId: string) => apiClient.get<PartnerBoothContent>(`/partner/booths/${encodeURIComponent(boothId)}/content`),
  updateBoothContent: (boothId: string, data: Partial<PartnerBoothContent>) => apiClient.patch<PartnerBoothContent>(`/partner/booths/${encodeURIComponent(boothId)}/content`, data),
  requestBoothChange: (boothId: string, reason: string) => apiClient.post(`/partner/booths/${encodeURIComponent(boothId)}/requests`, { kind: 'change', reason }),
  requestBoothCancellation: (boothId: string, reason: string) => apiClient.post(`/partner/booths/${encodeURIComponent(boothId)}/requests`, { kind: 'cancellation', reason }),
  getEventLocations: (eventId: string) => apiClient.get<Array<{ id: string; name: string; capacity: number }>>(`/partner/event-locations?eventId=${encodeURIComponent(eventId)}`),
  getAssets: () => apiClient.get<Array<{ id: string; name: string; totalQuantity: number }>>('/partner/assets'),
  getSchedule: () => apiClient.get<Array<Record<string, unknown>>>('/partner/schedule'),
  getActivityProposals: () => apiClient.get<PartnerActivityProposal[]>('/partner/activity-proposals'),
  submitApplication: (eventId: string, applicationNote: string) =>
    apiClient.post<PartnerApplicationResponse>(`/events/${encodeURIComponent(eventId)}/applications`, { applicationNote }),
  withdrawApplication: (applicationId: string) =>
    apiClient.post<PartnerApplicationResponse>(`/partner/applications/${encodeURIComponent(applicationId)}/withdraw`, {}),
  requestBooth: (data: { eventId: string; boothId: string; note?: string }) => apiClient.post('/partner/booth-requests', data),
  submitActivityProposal: (data: unknown) => apiClient.post('/partner/activity-proposals', data),
  updateActivityProposal: (id: string, data: Partial<PartnerActivityProposal>) => apiClient.patch<PartnerActivityProposal>(`/partner/activity-proposals/${encodeURIComponent(id)}`, data),
  requestActivityChange: (id: string, reason: string) => apiClient.post(`/partner/activity-proposals/${encodeURIComponent(id)}/requests`, { kind: 'change', reason }),
  requestActivityCancellation: (id: string, reason: string) => apiClient.post(`/partner/activity-proposals/${encodeURIComponent(id)}/requests`, { kind: 'cancellation', reason }),
  getActivityParticipants: (id: string) => apiClient.get<Array<{ id: string; fullName: string; phone: string; ticketCode: string; status: string }>>(`/partner/activity-proposals/${encodeURIComponent(id)}/participants`),
  async getNotifications(): Promise<PartnerNotification[]> {
    const items = await apiClient.get<Array<Record<string, unknown>>>('/partner/notifications');
    return items.map(item => ({
      id: String(item.id), title: String(item.title), time: formatDate(item.createdAt),
      type: ['activity', 'booth', 'event', 'reminder', 'system'].includes(String(item.kind)) ? String(item.kind) as PartnerNotification['type'] : 'system',
      isRead: Boolean(item.isRead), link: item.link ? String(item.link) : undefined,
    }));
  },
  markNotificationRead: (id: string) => apiClient.patch(`/partner/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllNotificationsRead: () => apiClient.patch('/partner/notifications/read-all', {}),
  getReports: (eventId?: string) => apiClient.get<PartnerReportStats>(`/partner/reports${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`),
  scanAttendance: (qrToken: string) => apiClient.post('/partner/attendance/scan', { qrToken }),
  changePassword: (currentPassword: string, newPassword: string) => apiClient.post('/partner/password', { currentPassword, newPassword }),
};
