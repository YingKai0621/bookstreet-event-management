import {
  ParticipantActivity,
  ParticipantActivityRating,
  ParticipantCertificate,
  ParticipantEvent,
  ParticipantProfile,
} from '../types';
import { apiClient } from './apiClient';
import type { AttendanceScanResponse } from '../types/attendance';
import type { BoothScanResponse } from '../types/reward';

export type ParticipantNotificationType =
  | 'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED'
  | 'ACTIVITY_CANCELLED'
  | 'EVENT_CANCELLED'
  | 'CERTIFICATE_ISSUED'
  | 'CERTIFICATE_REVOKED'
  | 'BADGE_UNLOCKED'
  | 'ACTIVITY_STARTING_SOON';

export type ParticipantNotificationReferenceType = 'EVENT' | 'ACTIVITY' | 'CERTIFICATE' | 'BADGE';

interface ParticipantNotificationResponse {
  notificationId: number;
  type: ParticipantNotificationType;
  title: string;
  message: string;
  referenceType: ParticipantNotificationReferenceType;
  referenceId: number;
  createdAt: string;
  readAt: string | null;
  read: boolean;
}

interface ParticipantNotificationPageResponse {
  content: ParticipantNotificationResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface ParticipantPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface CertificateSummaryResponse {
  certificateId: number;
  certificateCode: string;
  recipientName: string;
  status: 'ISSUED' | 'REVOKED';
  issuedAt: string;
  revokedAt: string | null;
  downloadAvailable: boolean;
}

interface CertificateDetailResponse {
  certificate: CertificateSummaryResponse;
  activity: {
    activityId: number;
    title: string;
    startAt: string;
    endAt: string;
  };
  event: {
    eventId: number;
    name: string;
  };
}

interface EventRegistrationResponse {
  eventRegistrationId: number;
  event: {
    eventId: number;
    name: string;
    startAt: string;
    endAt: string;
    status: string;
  };
  status: 'ACTIVE' | 'LEFT';
  seatActiveActivityCount: number;
}

interface PublicEventSummaryResponse {
  participantRegistrationDeadlineAt?: string | null;
  eventId: number;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  bannerUrl: string | null;
  status: string;
}

export interface ActivityRegistrationResponse {
  activityRegistrationId: number;
  activity: {
    activityId: number;
    eventId: number;
    title: string;
    locationCode: string;
    locationName: string;
    startAt: string;
    endAt: string;
    status: string;
  };
  status: 'ACTIVE' | 'CANCELLED' | 'NO_SHOW';
  outcome: string;
  registeredAt: string;
  attendance: { status: string } | null;
  rating: ActivityRatingResponse | null;
}

export interface ActivityRatingResponse {
  activityRatingId: number;
  activityId: number;
  score: number;
  comment: string | null;
  status: 'ACTIVE' | 'INVALIDATED';
  createdAt: string;
  updatedAt: string;
  invalidatedAt: string | null;
}

const EVENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: EVENT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function formatDateRange(startAt: string, endAt: string): string {
  return `${formatDate(startAt)} ${formatTime(startAt)} – ${formatDate(endAt)} ${formatTime(endAt)}`;
}

function mapEventRegistration(registration: EventRegistrationResponse): ParticipantEvent {
  const joined = registration.status === 'ACTIVE';
  const ended = ['COMPLETED', 'CANCELLED'].includes(registration.event.status);
  return {
    id: String(registration.event.eventId),
    title: registration.event.name,
    dateRange: formatDateRange(registration.event.startAt, registration.event.endAt),
    location: 'Đường Sách TP.HCM',
    imageUrl: '/duong_sach_logo.png',
    status: joined ? (ended ? 'ended' : 'ongoing') : 'left',
    shortDesc: '',
    activitiesCount: registration.seatActiveActivityCount,
    isJoined: joined,
    canLeave: joined && registration.seatActiveActivityCount === 0 && !ended,
  };
}

function mapActivityRegistration(
  registration: ActivityRegistrationResponse,
  eventNames: Map<string, string>,
): ParticipantActivity {
  const attended = registration.attendance?.status === 'VALID'
    || registration.outcome === 'ATTENDED';
  const status: ParticipantActivity['status'] = attended
    ? 'attended'
    : registration.status === 'ACTIVE'
      ? 'registered'
      : registration.status === 'NO_SHOW' || registration.outcome === 'NO_SHOW'
        ? 'no_show'
        : 'cancelled';

  return {
    id: String(registration.activity.activityId),
    activityId: String(registration.activity.activityId),
    registrationId: String(registration.activityRegistrationId),
    eventId: String(registration.activity.eventId),
    eventName: eventNames.get(String(registration.activity.eventId))
      || `Sự kiện #${registration.activity.eventId}`,
    title: registration.activity.title,
    category: 'Hoạt động',
    venue: registration.activity.locationName || registration.activity.locationCode,
    date: formatDate(registration.activity.startAt),
    time: `${formatTime(registration.activity.startAt)} - ${formatTime(registration.activity.endAt)}`,
    imageUrl: '',
    capacity: 0,
    registeredCount: 0,
    status,
    registrationStatus: registration.status,
    outcome: registration.outcome,
    attendanceStatus: registration.attendance?.status || null,
    activityStatus: registration.activity.status,
    startAt: registration.activity.startAt,
    endAt: registration.activity.endAt,
    registeredAt: registration.registeredAt,
    rating: registration.rating ? mapActivityRating(registration.rating) : null,
  };
}

function mapActivityRating(rating: ActivityRatingResponse): ParticipantActivityRating {
  return {
    id: String(rating.activityRatingId),
    activityId: String(rating.activityId),
    score: rating.score,
    comment: rating.comment || '',
    status: rating.status,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
    invalidatedAt: rating.invalidatedAt || undefined,
  };
}

function mapActivityRegistrationWithEvents(
  registration: ActivityRegistrationResponse,
  events: ParticipantEvent[],
): ParticipantActivity {
  const eventNames = new Map(events.map(event => [event.id, event.title]));
  return mapActivityRegistration(registration, eventNames);
}

function mapCertificateSummary(certificate: CertificateSummaryResponse): ParticipantCertificate {
  return {
    id: String(certificate.certificateId),
    title: 'Chứng nhận tham gia',
    recipientName: certificate.recipientName,
    status: certificate.status,
    downloadAvailable: certificate.downloadAvailable,
    issueDate: formatDate(certificate.issuedAt),
    revokedDate: certificate.revokedAt ? formatDate(certificate.revokedAt) : undefined,
    certificateCode: certificate.certificateCode,
  };
}

function mapCertificateDetail(detail: CertificateDetailResponse): ParticipantCertificate {
  return {
    ...mapCertificateSummary(detail.certificate),
    activityId: String(detail.activity.activityId),
    activityTitle: detail.activity.title,
    activityStartAt: detail.activity.startAt,
    activityEndAt: detail.activity.endAt,
    eventId: String(detail.event.eventId),
    eventTitle: detail.event.name,
  };
}

async function getAllPages<T>(endpoint: string): Promise<T[]> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const first = await apiClient.get<ParticipantPageResponse<T> | T[]>(`${endpoint}${separator}page=0&size=100`);
  if (!first) return [];
  if (Array.isArray(first)) return first;
  const totalPages = typeof first.totalPages === 'number' ? first.totalPages : 1;
  const remaining = totalPages > 1
    ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
      apiClient.get<ParticipantPageResponse<T>>(`${endpoint}${separator}page=${index + 1}&size=100`)))
    : [];
  return [first, ...remaining]
    .filter(page => page && Array.isArray(page.content))
    .sort((left, right) => (left.page ?? 0) - (right.page ?? 0))
    .flatMap(page => page.content);
}

export interface ParticipantNotificationItem {
  id: string;
  type: ParticipantNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
  readAt?: string;
  referenceType: ParticipantNotificationReferenceType;
  referenceId: string;
}

export interface ParticipantNotificationPage {
  items: ParticipantNotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ParticipantNotificationQuery {
  page?: number;
  size?: number;
  read?: boolean;
  type?: ParticipantNotificationType;
}

function notificationLink(notification: ParticipantNotificationResponse): string | null {
  const { type, referenceType, referenceId } = notification;
  if (!Number.isSafeInteger(referenceId) || referenceId <= 0) return null;
  switch (type) {
    case 'EVENT_CANCELLED':
      return referenceType === 'EVENT'
        ? `/participant/events/${encodeURIComponent(referenceId)}` : null;
    case 'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED':
    case 'ACTIVITY_CANCELLED':
    case 'ACTIVITY_STARTING_SOON':
      return referenceType === 'ACTIVITY'
        ? `/participant/activities/detail/${encodeURIComponent(referenceId)}` : null;
    case 'CERTIFICATE_ISSUED':
    case 'CERTIFICATE_REVOKED':
      return referenceType === 'CERTIFICATE' ? '/participant/certificates' : null;
    case 'BADGE_UNLOCKED':
      return referenceType === 'BADGE' ? '/participant/rewards' : null;
    default:
      return null;
  }
}

function mapNotification(notification: ParticipantNotificationResponse): ParticipantNotificationItem {
  return {
    id: String(notification.notificationId),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.read,
    link: notificationLink(notification),
    createdAt: notification.createdAt,
    readAt: notification.readAt || undefined,
    referenceType: notification.referenceType,
    referenceId: String(notification.referenceId),
  };
}

export const participantApi = {
  async getProfile(): Promise<ParticipantProfile> {
    const user = await apiClient.get<Record<string, unknown>>('/auth/profile');
    return {
      id: String(user.id),
      name: String(user.fullName),
      email: String(user.email || ''),
      emailVerified: Boolean(user.emailVerified),
      phone: user.phone ? String(user.phone) : undefined,
      role: 'Participant',
      avatar: user.avatarUrl ? String(user.avatarUrl) : undefined,
      points: Number(user.totalPoints || 0),
      emailNotifications: Boolean(user.emailNotifications),
      certificatesCount: Number(user.certificatesCount || 0),
      badgesCount: Number(user.badgesCount || 0),
    };
  },
  async getMyActivities(knownEvents?: ParticipantEvent[]): Promise<ParticipantActivity[]> {
    const [registrations, events] = await Promise.all([
      getAllPages<ActivityRegistrationResponse>('/participant/activity-registrations?sort=activityStartAt,desc'),
      knownEvents ? Promise.resolve(knownEvents) : participantApi.getEvents(),
    ]);
    return registrations.map(registration => mapActivityRegistrationWithEvents(registration, events));
  },
  async getEvents(): Promise<ParticipantEvent[]> {
    const [registrations, publicEvents] = await Promise.all([
      getAllPages<EventRegistrationResponse>(
        '/participant/event-registrations?sort=activatedAt,desc',
      ),
      getAllPages<PublicEventSummaryResponse>(
        '/events?sort=startAt,asc',
      ).catch(() => [] as PublicEventSummaryResponse[]),
    ]);

    const registrationMap = new Map<number, EventRegistrationResponse>();
    registrations.forEach(reg => {
      if (reg?.event?.eventId) {
        registrationMap.set(reg.event.eventId, reg);
      }
    });

    const mappedEvents: ParticipantEvent[] = [];
    const seenEventIds = new Set<number>();

    for (const pub of publicEvents) {
      if (!pub?.eventId) continue;
      seenEventIds.add(pub.eventId);
      const reg = registrationMap.get(pub.eventId);
      const joined = reg?.status === 'ACTIVE';
      const isLeft = reg?.status === 'LEFT';
      const ended = ['COMPLETED', 'CANCELLED'].includes(pub.status);
      mappedEvents.push({
        registrationDeadlineAt: pub.participantRegistrationDeadlineAt,
        id: String(pub.eventId),
        title: pub.name,
        dateRange: formatDateRange(pub.startAt, pub.endAt),
        location: 'Đường Sách TP.HCM',
        imageUrl: pub.bannerUrl || '/duong_sach_logo.png',
        status: isLeft ? 'left' : (ended ? 'ended' : 'ongoing'),
        shortDesc: pub.description || '',
        activitiesCount: reg ? reg.seatActiveActivityCount : 0,
        isJoined: joined,
        canLeave: joined && (reg?.seatActiveActivityCount ?? 0) === 0 && !ended,
      });
    }

    for (const reg of registrations) {
      if (reg?.event?.eventId && !seenEventIds.has(reg.event.eventId)) {
        seenEventIds.add(reg.event.eventId);
        mappedEvents.push(mapEventRegistration(reg));
      }
    }

    return mappedEvents;
  },
  async getEventRegistrations(): Promise<ParticipantEvent[]> {
    const registrations = await getAllPages<EventRegistrationResponse>('/participant/event-registrations?sort=activatedAt,desc');
    return registrations.map(mapEventRegistration);
  },
  joinEvent: (eventId: string) =>
    apiClient.post<EventRegistrationResponse>(`/participant/events/${encodeURIComponent(eventId)}/join`),
  mapEventRegistration,
  leaveEvent: (eventId: string) =>
    apiClient.post<EventRegistrationResponse>(`/participant/events/${encodeURIComponent(eventId)}/leave`),
  async getCertificates(): Promise<ParticipantCertificate[]> {
    const certificates = await getAllPages<CertificateSummaryResponse>(
      '/participant/certificates?sort=issuedAt,desc',
    );
    return certificates.map(mapCertificateSummary);
  },
  async getCertificateDetail(certificateId: string): Promise<ParticipantCertificate> {
    const detail = await apiClient.get<CertificateDetailResponse>(
      `/participant/certificates/${encodeURIComponent(certificateId)}`,
    );
    return mapCertificateDetail(detail);
  },
  downloadCertificate: (certificateId: string) =>
    apiClient.download(`/participant/certificates/${encodeURIComponent(certificateId)}/download`),
  getRegistrations: () => apiClient.get('/participant/registrations'),
  registerActivity: (activityId: string) =>
    apiClient.post<ActivityRegistrationResponse>(
      `/participant/activities/${encodeURIComponent(activityId)}/register`,
    ),
  cancelActivity: (activityId: string) =>
    apiClient.post<ActivityRegistrationResponse>(
      `/participant/activities/${encodeURIComponent(activityId)}/cancel-registration`,
    ),
  mapActivityRegistration: mapActivityRegistrationWithEvents,
  scanAttendance: (token: string) =>
    apiClient.post<AttendanceScanResponse>('/participant/attendance-scans', { token }),
  scanBooth: (token: string) =>
    apiClient.post<BoothScanResponse>('/participant/booth-visits/scan', { token }),
  async getActivityRating(activityId: string): Promise<ParticipantActivityRating> {
    const rating = await apiClient.get<ActivityRatingResponse>(
      `/participant/activities/${encodeURIComponent(activityId)}/rating`,
    );
    return mapActivityRating(rating);
  },
  async rateActivity(
    activityId: string,
    data: { score: number; comment: string },
  ): Promise<ParticipantActivityRating> {
    const rating = await apiClient.put<ActivityRatingResponse>(
      `/participant/activities/${encodeURIComponent(activityId)}/rating`,
      data,
    );
    return mapActivityRating(rating);
  },
  getPoints: () => apiClient.get('/participant/points'),
  async getNotificationPage(query: ParticipantNotificationQuery = {}): Promise<ParticipantNotificationPage> {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: 'createdAt,desc',
    });
    if (query.read !== undefined) params.set('read', String(query.read));
    if (query.type) params.set('type', query.type);
    const response = await apiClient.get<ParticipantNotificationPageResponse>(
      `/participant/notifications?${params.toString()}`,
    );
    if (!Array.isArray(response.content)) {
      throw new Error('Phản hồi danh sách thông báo không đúng định dạng.');
    }
    return {
      items: response.content.map(mapNotification),
      page: response.page,
      size: response.size,
      totalElements: response.totalElements,
      totalPages: response.totalPages,
    };
  },
  async getNotifications(): Promise<ParticipantNotificationItem[]> {
    const page = await participantApi.getNotificationPage({ page: 0, size: 5 });
    return page.items;
  },
  async getNotificationUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ unreadCount: number }>('/participant/notifications/unread-count');
    if (!Number.isFinite(response.unreadCount)) {
      throw new Error('Phản hồi số thông báo chưa đọc không đúng định dạng.');
    }
    return response.unreadCount;
  },
  async markNotificationRead(id: string): Promise<ParticipantNotificationItem> {
    const notification = await apiClient.post<ParticipantNotificationResponse>(
      `/participant/notifications/${encodeURIComponent(id)}/read`,
    );
    return mapNotification(notification);
  },
  async markAllNotificationsRead(): Promise<number> {
    const response = await apiClient.post<{ updatedCount: number }>(
      '/participant/notifications/read-all',
    );
    return Number.isFinite(response.updatedCount) ? response.updatedCount : 0;
  },
  updateProfile: (data: { fullName: string; phone?: string; avatarUrl?: string }) =>
    apiClient.put<Record<string, unknown>>('/auth/profile', data),
};
