import { apiClient } from './apiClient';
import {
  OrganizerProfile,
  OrganizerEvent,
  OrganizerEventPageResponse,
  OrganizerEventRequest,
  OrganizerEventResponse,
  OrganizerEventStatus,
  OrganizerBoothItem,
  OrganizerActivityItem,
  OrganizerParticipantItem,
  OrganizerNotificationItem
} from '../types/organizer';
import { ExtendedHeritageProfile } from '../types';
import { toHeritageProfile } from './publicApi';

export type OrganizerFeedbackStatus = 'new' | 'in_progress' | 'responded' | 'closed';

export interface OrganizerFeedback {
  id: string;
  targetScope: 'entire' | 'heritage' | 'booth' | 'facility';
  targetName: string | null;
  rating: number;
  comments: string | null;
  contactEmail: string | null;
  status: OrganizerFeedbackStatus;
  internalNote: string | null;
  createdAt: string;
  assignee?: { fullName: string } | null;
  heritage?: { name: string; code: string } | null;
  booth?: { name: string; code: string } | null;
}

export interface OrganizerPartnerApplication {
  id: string; eventId: string; orgName: string; rep: string; phone: string;
  date: string; desc: string; status: string; reviewNote?: string;
}

function mapEventStatus(status: OrganizerEventStatus): OrganizerEvent['status'] {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PUBLISHED':
      return 'upcoming';
    case 'ONGOING':
      return 'happening';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
  }
}

function getEventStatusLabel(status: OrganizerEventStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Bản nháp';
    case 'PUBLISHED':
      return 'Đã công bố';
    case 'ONGOING':
      return 'Đang diễn ra';
    case 'COMPLETED':
      return 'Đã kết thúc';
    case 'CANCELLED':
      return 'Đã hủy';
  }
}

function formatEventDateRange(startAt: string, endAt: string): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  };

  const start = new Date(startAt).toLocaleString('vi-VN', options);
  const end = new Date(endAt).toLocaleString('vi-VN', options);
  return `${start} - ${end}`;
}

export function toOrganizerEvent(event: OrganizerEventResponse): OrganizerEvent {
  return {
    id: String(event.eventId),
    organizerUserId: event.organizerUserId,
    title: event.name,
    dateRange: formatEventDateRange(event.startAt, event.endAt),
    startDate: event.startAt,
    endDate: event.endAt,
    location: 'Đường Sách TP.HCM',
    status: mapEventStatus(event.status),
    apiStatus: event.status,
    statusLabelVi: getEventStatusLabel(event.status),
    imageUrl: event.bannerUrl || '',
    coverImage: event.bannerUrl || undefined,
    description: event.description || '',
    boothOccupancy: '0',
    boothsCount: 0,
    maxBooths: event.maxBoothsPerPartner,
    activitiesCount: 0,
    registrationsCount: 0,
    attendanceRate: 0,
    averageRating: 0,
    boothDeadline: event.boothRequestDeadlineAt || undefined,
    activityDeadline: event.activityProposalDeadlineAt || undefined,
    participantDeadline: event.participantRegistrationDeadlineAt || undefined,
    cancellationCutoff: event.partnerWithdrawalCutoffAt || undefined,
    isPublished: event.status !== 'DRAFT',
    partnerApplicationDeadlineAt: event.partnerApplicationDeadlineAt,
    boothRequestDeadlineAt: event.boothRequestDeadlineAt,
    activityProposalDeadlineAt: event.activityProposalDeadlineAt,
    participantRegistrationDeadlineAt: event.participantRegistrationDeadlineAt,
    partnerWithdrawalCutoffAt: event.partnerWithdrawalCutoffAt,
    boothCancellationCutoffAt: event.boothCancellationCutoffAt,
    activityCancellationCutoffAt: event.activityCancellationCutoffAt,
    boothPaymentWindowMinutes: event.boothPaymentWindowMinutes,
    maxBoothsPerPartner: event.maxBoothsPerPartner,
    maxActivitiesPerPartner: event.maxActivitiesPerPartner,
    bannerUrl: event.bannerUrl,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export const organizerApi = {
  async getProfile(): Promise<OrganizerProfile> {
    const user = await apiClient.get<any>('/organizer/profile');
    return { id: user.id, name: user.fullName, role: 'Organizer / Điều hành Sự kiện', department: 'Ban Quản Lý & Vận Hành Đường Sách TP.HCM', organization: 'Ban Quản Lý & Vận Hành Đường Sách TP.HCM', email: user.email, phone: user.phone || '', avatarInitials: user.fullName.split(' ').map((part: string) => part[0]).join('').slice(-2).toUpperCase(), avatarUrl: user.avatarUrl || undefined, notificationPreferences: user.notificationPreferences };
  },
  updateProfile: (data: unknown) => apiClient.patch('/organizer/profile', data),
  async getNotifications(): Promise<OrganizerNotificationItem[]> {
    const rows = await apiClient.get<any[]>('/organizer/notifications');
    return rows.map(item => ({ id: item.id, title: item.title, content: item.message, category: ['booth', 'activity', 'feedback'].includes(item.kind) ? item.kind : 'system', timeAgo: new Date(item.createdAt).toLocaleString('vi-VN'), isRead: item.isRead, targetTab: item.link }));
  },
  markNotificationRead: (id: string) => apiClient.patch(`/organizer/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllNotificationsRead: () => apiClient.patch('/organizer/notifications/read-all', {}),
  async getEvents(page = 0, size = 100, sort = 'createdAt,desc'): Promise<OrganizerEvent[]> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      sort,
    });
    const response = await apiClient.get<OrganizerEventPageResponse>(`/organizer/events?${query.toString()}`);
    return response.content.map(toOrganizerEvent);
  },

  async getEvent(id: string): Promise<OrganizerEvent> {
    const event = await apiClient.get<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(id)}`);
    return toOrganizerEvent(event);
  },
  async createEvent(data: OrganizerEventRequest): Promise<OrganizerEvent> {
    const event = await apiClient.post<OrganizerEventResponse>('/organizer/events', data);
    return toOrganizerEvent(event);
  },
  getEventLocations: (eventId: string) => apiClient.get<Array<{ id: string; name: string; capacity: number }>>(`/organizer/event-locations?eventId=${encodeURIComponent(eventId)}`),
  async updateEvent(id: string, data: OrganizerEventRequest): Promise<OrganizerEvent> {
    const event = await apiClient.patch<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(id)}`, data);
    return toOrganizerEvent(event);
  },
  async publishEvent(id: string): Promise<OrganizerEvent> {
    const event = await apiClient.post<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(id)}/publish`, {});
    return toOrganizerEvent(event);
  },
  getBooths: (eventId: string) => apiClient.get<OrganizerBoothItem[]>(`/organizer/booths?eventId=${encodeURIComponent(eventId)}`),
  approveBoothRequest: (id: string) => apiClient.post(`/organizer/booth-requests/${encodeURIComponent(id)}/approve`, {}),
  rejectBoothRequest: (id: string, note?: string) => apiClient.post(`/organizer/booth-requests/${encodeURIComponent(id)}/reject`, { note }),
  updateBoothMapPosition: (id: string, x: number, y: number) => apiClient.patch(`/organizer/booths/${encodeURIComponent(id)}/map-position`, { x, y }),
  createBooth: (data: unknown) => apiClient.post('/admin/booths', data),
  updateBooth: (id: string, data: unknown) => apiClient.put(`/admin/booths/${encodeURIComponent(id)}`, data),
  deleteBooth: (id: string) => apiClient.delete(`/admin/booths/${encodeURIComponent(id)}`),
  createHeritage: (data: unknown) => apiClient.post('/admin/heritages', data),
  updateHeritage: (id: string, data: unknown) => apiClient.put(`/admin/heritages/${encodeURIComponent(id)}`, data),
  deleteHeritage: (id: string) => apiClient.delete(`/admin/heritages/${encodeURIComponent(id)}`),
  async getHeritages(): Promise<ExtendedHeritageProfile[]> {
    const rows = await apiClient.get<Record<string, unknown>[]>('/admin/heritages?limit=100');
    return rows.map(row => ({
      ...toHeritageProfile(row),
      id: String(row.id || row.slug || ''),
      status: (row.status || 'draft') as ExtendedHeritageProfile['status'],
      qrStatus: (row.qrStatus || 'inactive') as ExtendedHeritageProfile['qrStatus'],
      viewCount: Number(row.viewCount || 0),
      qrScanCount: Number(row.qrScanCount || 0),
    }));
  },
  async getActivities(eventId?: string): Promise<OrganizerActivityItem[]> {
    const rows = await apiClient.get<any[]>(`/organizer/activities${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
    return rows.map(activity => ({
      id: activity.id, eventId: activity.eventId, title: activity.title, type: activity.kind,
      dateStr: new Date(activity.startAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      timeStr: `${new Date(activity.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} – ${new Date(activity.endAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`,
      location: activity.location?.name || '', capacity: activity.capacity,
      registeredCount: activity.registeredCount, attendedCount: activity._count?.attendanceSessions || 0,
      partnerName: activity.organization?.name || 'Ban Quản Lý Đường Sách', speaker: activity.speaker || '',
      status: activity.status, statusLabelVi: activity.status === 'published' ? 'Đã công bố' : activity.status === 'approved' ? 'Đã duyệt' : activity.status,
      isPublished: ['published', 'ongoing', 'completed'].includes(activity.status),
      thumbnail: activity.imageUrl || '', description: activity.description || '',
    }));
  },
  getParticipants: (eventId?: string) => apiClient.get<OrganizerParticipantItem[]>(`/organizer/participants${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`),
  publishActivity: (id: string) => apiClient.post(`/organizer/activities/${encodeURIComponent(id)}/publish`, {}),
  createActivity: (data: unknown) => apiClient.post('/organizer/activities', data),
  updateActivity: (id: string, data: unknown) => apiClient.patch(`/organizer/activities/${encodeURIComponent(id)}`, data),
  async getPartnerApplications(eventId?: string): Promise<OrganizerPartnerApplication[]> {
    const rows = await apiClient.get<any[]>(`/organizer/partner-applications${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
    return rows.map(item => ({ id: item.id, eventId: item.eventId, orgName: item.organization?.name || '', rep: item.organization?.representativeName || '', phone: item.organization?.phone || '', date: item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '', desc: item.organization?.shortDesc || '', status: item.status, reviewNote: item.reviewNote || undefined }));
  },
  approvePartnerApplication: (id: string) => apiClient.post(`/organizer/partner-applications/${encodeURIComponent(id)}/approve`, {}),
  rejectPartnerApplication: (id: string, note: string) => apiClient.post(`/organizer/partner-applications/${encodeURIComponent(id)}/reject`, { note }),
  getProposals: (eventId?: string) => apiClient.get<any[]>(`/organizer/activity-proposals?limit=100${eventId ? `&eventId=${encodeURIComponent(eventId)}` : ''}`),
  approveProposal: (id: string, note?: string) => apiClient.post(`/organizer/activity-proposals/${encodeURIComponent(id)}/approve`, { note }),
  rejectProposal: (id: string, note: string) => apiClient.post(`/organizer/activity-proposals/${encodeURIComponent(id)}/reject`, { note }),
  requestProposalSupplement: (id: string, note: string) => apiClient.post(`/organizer/activity-proposals/${encodeURIComponent(id)}/request-supplement`, { note }),

  // Quét QR điểm danh (BR-45, BR-47)
  async scanAttendance(ticketCode: string, activityId?: string): Promise<any> {
    return await apiClient.post('/organizer/checkin', { ticketCode, activityId });
  },
  overrideAttendance: (registrationId: string, status: string, reason: string, durationMinutes = 30) =>
    apiClient.post(`/organizer/participants/${encodeURIComponent(registrationId)}/override-attendance`, { status, reason, durationMinutes }),
  getReport: (eventId: string) => apiClient.get<any>(`/organizer/reports?eventId=${encodeURIComponent(eventId)}`),

  getFeedbacks: () => apiClient.get<OrganizerFeedback[]>('/organizer/feedbacks'),
  updateFeedback: (id: string, data: { status: OrganizerFeedbackStatus; internalNote?: string }) =>
    apiClient.patch<OrganizerFeedback>(`/organizer/feedbacks/${id}/status`, data),
};

