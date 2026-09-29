import { apiClient } from './apiClient';
import { PartnerActivityProposal, PartnerBooth, PartnerEventApplication, PartnerNotification, PartnerOrganization, PartnerReportStats } from '../types';

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

export const partnerApi = {
  async getProfile(): Promise<PartnerOrganization | null> {
    const organization = await apiClient.get<Record<string, unknown> | null>('/partner/profile');
    if (!organization) return null;
    const name = String(organization.name || organization.fullName || '');
    return {
      id: String(organization.id), name, shortDesc: String(organization.shortDesc || ''),
      logoUrl: organization.logoUrl ? String(organization.logoUrl) : undefined,
      representativeName: String(organization.representativeName || organization.fullName || ''), email: String(organization.email || ''),
      phone: String(organization.phone || ''), address: String(organization.address || ''), website: String(organization.website || ''),
      categories: Array.isArray(organization.categories) ? organization.categories.map(String) : [],
      isVerified: Boolean(organization.isVerified),
    };
  },
  async updateProfile(data: Partial<PartnerOrganization>): Promise<PartnerOrganization> {
    const organization = await apiClient.patch<Record<string, unknown>>('/partner/profile', {
      fullName: data.representativeName || data.name, email: data.email, phone: data.phone, avatarUrl: data.logoUrl,
    });
    const name = String(organization.name || organization.fullName || '');
    return {
      id: String(organization.id), name, shortDesc: String(organization.shortDesc || ''),
      logoUrl: organization.logoUrl ? String(organization.logoUrl) : undefined,
      representativeName: String(organization.representativeName || organization.fullName || ''), email: String(organization.email || ''),
      phone: String(organization.phone || ''), address: String(organization.address || ''), website: String(organization.website || ''),
      categories: Array.isArray(organization.categories) ? organization.categories.map(String) : [],
      isVerified: Boolean(organization.isVerified),
    };
  },
  async getApplications(): Promise<PartnerEventApplication[]> {
    const applications = await apiClient.get<Array<Record<string, any>>>('/partner/event-applications');
    return applications.map(application => ({
      id: String(application.id), eventId: String(application.eventId), eventTitle: String(application.event?.title || ''),
      dateRange: `${formatDate(application.event?.startAt)} - ${formatDate(application.event?.endAt)}`,
      location: String(application.event?.venue?.name || ''), imageUrl: String(application.event?.coverImageUrl || ''),
      status: application.status === 'withdrawn' ? 'rejected' : application.status,
      submittedAt: formatDate(application.submittedAt), step: Number(application.step || 1),
      organizationName: String(application.organization?.name || ''), shortDesc: String(application.organization?.shortDesc || ''),
      logoUrl: application.organization?.logoUrl || undefined, representativeName: String(application.organization?.representativeName || ''),
      email: String(application.organization?.email || ''), phone: String(application.organization?.phone || ''),
    }));
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
  submitApplication: (eventId: string) => apiClient.post('/partner/event-applications', { eventId }),
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
