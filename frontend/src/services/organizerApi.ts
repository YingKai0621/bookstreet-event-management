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
import { toHeritageProfile } from './publicApi';

interface PublicBoothResponse {
  id: string;
  code?: string;
  name: string;
  areaName?: string;
  dimensions?: string;
  status?: 'rented' | 'reserved' | 'available' | 'unavailable';
  partnerName?: string;
  category?: string;
  price?: number;
  description?: string;
  mapX?: number | null;
  mapY?: number | null;
}

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
  async getBooths(eventId?: string): Promise<OrganizerBoothItem[]> {
    try {
      const rows = await apiClient.get<any[]>(`/organizer/booths${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
      if (Array.isArray(rows)) return rows;
    } catch {
      // Fallback to public booths
    }
    try {
      const publicBooths = await apiClient.get<PublicBoothResponse[]>('/public/booths');
      if (Array.isArray(publicBooths)) {
        return publicBooths.map((b, index) => ({
          id: b.id,
          code: b.code || b.name,
          name: b.name,
          zone: b.areaName || 'Khu A',
          dimensions: b.dimensions || '3m x 3m',
          status: (b.status === 'rented' ? 'assigned' : b.status === 'reserved' ? 'pending' : 'available') as OrganizerBoothItem['status'],
          statusLabelVi: b.status === 'rented' ? 'Đã thuê' : b.status === 'reserved' ? 'Đang chờ' : 'Còn trống',
          orgName: b.partnerName || undefined,
          areaType: b.category || 'Gian hàng tiêu chuẩn',
          priceEstimate: b.price ? `${b.price.toLocaleString('vi-VN')} đ` : '5.000.000 đ',
          notes: b.description || '',
          x: b.mapX ?? (12 + (index % 12) * 6.9),
          y: b.mapY ?? (38 + Math.floor(index / 12) * 16),
        }));
      }
    } catch {
      // Empty if not in DB
    }
    return [];
  },
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
    try {
      const rows = await apiClient.get<any[]>(`/organizer/activities${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
      if (!Array.isArray(rows)) return [];
      return rows.map(activity => ({
        id: String(activity.id || ''),
        eventId: String(activity.eventId || ''),
        title: activity.title || '',
        type: activity.kind || activity.type || 'Workshop',
        dateStr: activity.startAt ? new Date(activity.startAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
        timeStr: activity.startAt && activity.endAt
          ? `${new Date(activity.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} – ${new Date(activity.endAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`
          : '',
        location: activity.location?.name || activity.location || 'Khu vực sân khấu chính',
        capacity: Number(activity.capacity || 0),
        registeredCount: Number(activity.registeredCount || 0),
        attendedCount: Number(activity.attendedCount || activity._count?.attendanceSessions || 0),
        partnerName: activity.organization?.name || activity.partnerName || 'Ban Quản Lý Đường Sách',
        speaker: activity.speaker || '',
        status: activity.status || 'pending',
        statusLabelVi: activity.status === 'published' ? 'Đã công bố' : activity.status === 'approved' ? 'Đã duyệt' : activity.status === 'cancelled' ? 'Đã hủy' : 'Chờ duyệt',
        isPublished: ['published', 'ongoing', 'completed'].includes(activity.status),
        thumbnail: activity.imageUrl || activity.thumbnail || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=60',
        description: activity.description || '',
      }));
    } catch {
      return [];
    }
  },
  async getParticipants(eventId?: string): Promise<OrganizerParticipantItem[]> {
    try {
      const rows = await apiClient.get<any[]>(`/organizer/participants${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`);
      if (Array.isArray(rows)) return rows;
    } catch {
      // Empty if no participants registered yet in database
    }
    return [];
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
    const response = await apiClient.get<PartnerApplicationPageResponse>(
      `/organizer/events/${encodeURIComponent(eventId)}/applications?${query.toString()}`,
    );
    return response.content.map(toOrganizerPartnerApplication);
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
    try {
      const res = await apiClient.get<any>(`/organizer/reports?eventId=${encodeURIComponent(eventId)}`);
      if (res && typeof res === 'object' && res.totalParticipants !== undefined) return res;
    } catch {
      // Compute strictly from actual database entities
    }
    try {
      const [event, activities, applications, participants, feedbacks, booths] = await Promise.all([
        apiClient.get<OrganizerEventResponse>(`/organizer/events/${encodeURIComponent(eventId)}`).catch(() => null),
        organizerApi.getActivities(eventId).catch(() => []),
        organizerApi.getPartnerApplications(eventId).catch(() => []),
        organizerApi.getParticipants(eventId).catch(() => []),
        organizerApi.getFeedbacks().catch(() => []),
        organizerApi.getBooths(eventId).catch(() => []),
      ]);

      const eventName = event ? event.name : 'Sự kiện';
      const totalParticipants = participants.length;
      const attended = participants.filter(p => p.status === 'attended').length;
      const pending = participants.filter(p => p.status === 'not_attended').length;
      const cancelled = participants.filter(p => p.status === 'cancelled').length;
      const totalBooths = booths.filter(b => b.status === 'assigned').length || applications.filter(a => a.status === 'approved').length;
      const totalActivities = activities.length;
      const attendanceRate = totalParticipants > 0 ? Math.round((attended / totalParticipants) * 100) : 0;
      const ratingCount = feedbacks.length;
      let totalRating = 0;
      for (const feedback of feedbacks) {
        totalRating += Number(feedback?.rating) || 0;
      }
      const averageRating = ratingCount > 0
        ? Number((totalRating / ratingCount).toFixed(1))
        : 0;

      const activityStats = activities.map(act => ({
        name: act.title,
        count: act.registeredCount || 0,
      }));

      const ratingDistribution = [5, 4, 3, 2, 1].map(stars => ({
        stars,
        count: feedbacks.filter(f => Math.round(Number(f.rating) || 0) === stars).length,
      }));

      return {
        eventId,
        eventName,
        totalParticipants,
        attended,
        pending,
        cancelled,
        totalBooths,
        totalActivities,
        attendanceRate,
        averageRating,
        ratingCount,
        activityStats,
        ratingDistribution,
      };
    } catch {
      return {
        eventId,
        eventName: 'Sự kiện',
        totalParticipants: 0,
        attended: 0,
        pending: 0,
        cancelled: 0,
        totalBooths: 0,
        totalActivities: 0,
        attendanceRate: 0,
        averageRating: 0,
        ratingCount: 0,
        activityStats: [],
        ratingDistribution: [
          { stars: 5, count: 0 },
          { stars: 4, count: 0 },
          { stars: 3, count: 0 },
          { stars: 2, count: 0 },
          { stars: 1, count: 0 },
        ],
      };
    }
  },

  getFeedbacks: () => apiClient.get<OrganizerFeedback[]>('/organizer/feedbacks'),
  updateFeedback: (id: string, data: { status: OrganizerFeedbackStatus; internalNote?: string }) =>
    apiClient.patch<OrganizerFeedback>(`/organizer/feedbacks/${id}/status`, data),
};

