import { ExtendedHeritageProfile } from '../types';
import {
  OrganizerActivityItem,
  OrganizerBoothItem,
  OrganizerEvent,
  OrganizerEventPageResponse,
  OrganizerEventRequest,
  OrganizerEventResponse,
  OrganizerEventStatus,
  OrganizerNotificationItem,
  OrganizerParticipantItem,
  OrganizerProfile,
  OrganizerReport,
} from '../types/organizer';
import { apiClient } from './apiClient';
import { boothApi } from './boothApi';
import { toHeritageProfile } from './publicApi';
import type { EventBooth, PhysicalBooth } from '../types/booth';

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
  id: string;
  eventId: string;
  partnerOrganizationId: string;
  orgName: string;
  categoryCode: string;
  date: string;
  applicationNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewNote: string;
  reviewedAt: string;
  withdrawnAt: string;
}

interface OrganizerPartnerApplicationResponse {
  applicationId: number;
  eventId: number;
  partnerOrganizationId: number;
  partnerOrganizationName: string;
  partnerCategoryCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  applicationNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

interface PartnerApplicationPageResponse {
  content: OrganizerPartnerApplicationResponse[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

function toOrganizerPartnerApplication(
  application: OrganizerPartnerApplicationResponse,
): OrganizerPartnerApplication {
  const formatDateTime = (value: string | null): string => value
    ? new Date(value).toLocaleString('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    })
    : '';

  return {
    id: String(application.applicationId),
    eventId: String(application.eventId),
    partnerOrganizationId: String(application.partnerOrganizationId),
    orgName: application.partnerOrganizationName,
    categoryCode: application.partnerCategoryCode,
    date: formatDateTime(application.submittedAt),
    applicationNote: application.applicationNote || '',
    status: application.status.toLowerCase() as OrganizerPartnerApplication['status'],
    reviewNote: application.reviewNote || '',
    reviewedAt: formatDateTime(application.reviewedAt),
    withdrawnAt: formatDateTime(application.withdrawnAt),
  };
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

function toOrganizerBoothItem(booth: PhysicalBooth, eventBooth?: EventBooth): OrganizerBoothItem {
  const availability = eventBooth?.availability
    ?? (booth.active ? 'AVAILABLE' : 'UNAVAILABLE');
  const statusByAvailability: Record<EventBooth['availability'], OrganizerBoothItem['status']> = {
    AVAILABLE: 'available',
    ON_HOLD: 'pending',
    ASSIGNED: 'assigned',
    UNAVAILABLE: 'unavailable',
  };
  const labelByAvailability: Record<EventBooth['availability'], string> = {
    AVAILABLE: 'Còn trống',
    ON_HOLD: 'Đang giữ chỗ',
    ASSIGNED: 'Đã phân bổ',
    UNAVAILABLE: 'Chưa mở',
  };

  return {
    id: String(booth.boothId),
    code: booth.code,
    name: booth.name,
    zone: booth.categoryCode || 'Chưa phân khu',
    areaType: booth.categoryCode || 'Chưa phân loại',
    dimensions: `Sức chứa ${booth.maxCapacity}`,
    status: statusByAvailability[availability],
    statusLabelVi: labelByAvailability[availability],
    priceEstimate: eventBooth?.rentalPrice === null || eventBooth?.rentalPrice === undefined
      ? 'Chưa cấu hình'
      : `${eventBooth.rentalPrice.toLocaleString('vi-VN')} đ`,
    notes: booth.description || booth.note || '',
    x: booth.mapX,
    y: booth.mapY,
  };
}

export function toOrganizerEvent(event: OrganizerEventResponse): OrganizerEvent {
  return {
    id: String(event.eventId),
    organizerUserId: event.organizerUserId,
    title: event.name,
    dateRange: formatEventDateRange(event.startAt, event.endAt),
    startDate: event.startAt,
    endDate: event.endAt,
    location: null,
    status: mapEventStatus(event.status),
    apiStatus: event.status,
    statusLabelVi: getEventStatusLabel(event.status),
    imageUrl: event.bannerUrl || '',
    coverImage: event.bannerUrl || undefined,
    description: event.description || '',
    boothOccupancy: null,
    boothsCount: null,
    maxBooths: event.maxBoothsPerPartner,
    activitiesCount: null,
    registrationsCount: null,
    attendanceRate: null,
    averageRating: null,
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
    return { id: user.id, name: user.fullName, role: 'ORGANIZER', department: user.department || '', organization: user.organization || '', email: user.email, phone: user.phone || '', avatarInitials: user.fullName.split(' ').map((part: string) => part[0]).join('').slice(-2).toUpperCase(), avatarUrl: user.avatarUrl || undefined, notificationPreferences: user.notificationPreferences };
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
    const remaining = response.totalPages > page + 1
      ? await Promise.all(Array.from({ length: response.totalPages - page - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams({ page: String(page + index + 1), size: String(size), sort });
        return apiClient.get<OrganizerEventPageResponse>(`/organizer/events?${nextQuery.toString()}`);
      }))
      : [];
    return [response, ...remaining].flatMap(result => result.content).map(toOrganizerEvent);
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
  async getBooths(eventId?: string): Promise<OrganizerBoothItem[]> {
    if (!eventId) {
      const physicalBooths = await boothApi.listAllPhysicalBooths();
      return physicalBooths.map(booth => toOrganizerBoothItem(booth));
    }

    const eventBooths = await boothApi.listEventBoothConfigurations(eventId);
    return eventBooths.map(row => toOrganizerBoothItem(row.booth, row));
  },
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
    if (!Array.isArray(rows)) throw new Error('Dữ liệu hoạt động không hợp lệ.');
    return rows.map(activity => ({
        id: String(activity.id || ''),
        eventId: String(activity.eventId || ''),
        title: activity.title || '',
        type: activity.kind || activity.type || 'Workshop',
        dateStr: activity.startAt ? new Date(activity.startAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
        timeStr: activity.startAt && activity.endAt
          ? `${new Date(activity.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} – ${new Date(activity.endAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`
          : '',
        location: activity.location?.name || activity.location || '',
        capacity: Number(activity.capacity || 0),
        registeredCount: Number(activity.registeredCount || 0),
        attendedCount: Number(activity.attendedCount || activity._count?.attendanceSessions || 0),
        partnerName: activity.organization?.name || activity.partnerName || '',
        speaker: activity.speaker || '',
        status: activity.status || 'pending',
        statusLabelVi: activity.status === 'published' ? 'Đã công bố' : activity.status === 'approved' ? 'Đã duyệt' : activity.status === 'cancelled' ? 'Đã hủy' : 'Chờ duyệt',
        isPublished: ['published', 'ongoing', 'completed'].includes(activity.status),
        thumbnail: activity.imageUrl || activity.thumbnail || '',
        description: activity.description || '',
    }));
  },
  async getParticipants(eventId?: string): Promise<OrganizerParticipantItem[]> {
    const rows = await apiClient.get<any[]>(`/organizer/participants${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
    if (!Array.isArray(rows)) throw new Error('Dữ liệu người tham gia không hợp lệ.');
    return rows;
  },
  publishActivity: (id: string) => apiClient.post(`/organizer/activities/${encodeURIComponent(id)}/publish`, {}),
  createActivity: (data: unknown) => apiClient.post('/organizer/activities', data),
  updateActivity: (id: string, data: unknown) => apiClient.patch(`/organizer/activities/${encodeURIComponent(id)}`, data),
  async getPartnerApplications(eventId: string): Promise<OrganizerPartnerApplication[]> {
    const query = new URLSearchParams({
      page: '0',
      size: '100',
      sort: 'submittedAt,desc',
    });
    const first = await apiClient.get<PartnerApplicationPageResponse>(
      `/organizer/events/${encodeURIComponent(eventId)}/applications?${query.toString()}`,
    );
    const remaining = first.totalPages > 1
      ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams({ page: String(index + 1), size: '100', sort: 'submittedAt,desc' });
        return apiClient.get<PartnerApplicationPageResponse>(
          `/organizer/events/${encodeURIComponent(eventId)}/applications?${nextQuery.toString()}`,
        );
      }))
      : [];
    return [first, ...remaining].flatMap(page => page.content).map(toOrganizerPartnerApplication);
  },
  approvePartnerApplication: (id: string, reviewNote = '') =>
    apiClient.post<OrganizerPartnerApplicationResponse>(
      `/organizer/applications/${encodeURIComponent(id)}/approve`,
      { reviewNote },
    ),
  rejectPartnerApplication: (id: string, reviewNote: string) =>
    apiClient.post<OrganizerPartnerApplicationResponse>(
      `/organizer/applications/${encodeURIComponent(id)}/reject`,
      { reviewNote },
    ),
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
  async getReport(eventId: string): Promise<OrganizerReport> {
    return apiClient.get<OrganizerReport>(`/organizer/reports?eventId=${encodeURIComponent(eventId)}`);
  },

  getFeedbacks: () => apiClient.get<OrganizerFeedback[]>('/organizer/feedbacks'),
  updateFeedback: (id: string, data: { status: OrganizerFeedbackStatus; internalNote?: string }) =>
    apiClient.patch<OrganizerFeedback>(`/organizer/feedbacks/${id}/status`, data),
};

