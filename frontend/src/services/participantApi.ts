import {
  ParticipantActivity,
  ParticipantActivityRating,
  ParticipantBadge,
  ParticipantCertificate,
  ParticipantEvent,
  ParticipantProfile,
} from '../types';
import { apiClient } from './apiClient';
import type { AttendanceScanResponse } from '../types/attendance';

interface ParticipantNotificationResponse {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  referenceType: 'EVENT' | 'ACTIVITY' | 'CERTIFICATE';
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
  const first = await apiClient.get<ParticipantPageResponse<T>>(`${endpoint}${separator}page=0&size=100`);
  const remaining = first.totalPages > 1
    ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
      apiClient.get<ParticipantPageResponse<T>>(`${endpoint}${separator}page=${index + 1}&size=100`)))
    : [];
  return [first, ...remaining]
    .sort((left, right) => left.page - right.page)
    .flatMap(page => page.content);
}

export interface ParticipantNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string;
  createdAt: string;
}

function notificationLink(notification: ParticipantNotificationResponse): string {
  if (notification.referenceType === 'EVENT') {
    return `/participant/events/${encodeURIComponent(notification.referenceId)}`;
  }
  if (notification.referenceType === 'ACTIVITY') {
    return `/participant/activities/detail/${encodeURIComponent(notification.referenceId)}`;
  }
  return '/participant/certificates';
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
    const registrations = await getAllPages<EventRegistrationResponse>(
      '/participant/event-registrations?sort=activatedAt,desc',
    );
    return registrations.map(mapEventRegistration);
  },
  joinEvent: (eventId: string) =>
    apiClient.post<EventRegistrationResponse>(`/participant/events/${encodeURIComponent(eventId)}/join`),
  leaveEvent: (eventId: string) =>
    apiClient.post<EventRegistrationResponse>(`/participant/events/${encodeURIComponent(eventId)}/leave`),
  async getBadges(): Promise<ParticipantBadge[]> {
    const badges = await apiClient.get<Array<Record<string, unknown>>>('/participant/badges');
    return badges.map(badge => ({
      id: String(badge.id), code: String(badge.code || ''), title: String(badge.title), iconName: String(badge.iconName || 'book'),
      earnedDate: badge.earnedDate ? new Date(String(badge.earnedDate)).toLocaleDateString('vi-VN') : '',
      isLocked: Boolean(badge.isLocked),
    }));
  },
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
  async getNotifications(): Promise<ParticipantNotificationItem[]> {
    const response = await apiClient.get<ParticipantNotificationPageResponse>(
      '/participant/notifications?page=0&size=20&sort=createdAt,desc',
    );
    if (!Array.isArray(response.content)) {
      throw new Error('Phản hồi danh sách thông báo không đúng định dạng.');
    }
    return response.content.map(mapNotification);
  },
  async getNotificationUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ unreadCount: number }>('/participant/notifications/unread-count');
    return Number.isFinite(response.unreadCount) ? response.unreadCount : 0;
  },
  async markNotificationRead(id: string): Promise<ParticipantNotificationItem> {
    const notification = await apiClient.post<ParticipantNotificationResponse>(
      `/participant/notifications/${encodeURIComponent(id)}/read`,
    );
    return mapNotification(notification);
  },
  updateProfile: (data: { fullName: string; phone?: string; avatarUrl?: string }) =>
    apiClient.put<Record<string, unknown>>('/auth/profile', data),
};
