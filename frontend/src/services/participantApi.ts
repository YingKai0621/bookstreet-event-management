import {
  ParticipantActivity,
  ParticipantBadge,
  ParticipantCertificate,
  ParticipantEvent,
  ParticipantProfile,
} from '../types';
import { apiClient } from './apiClient';

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
  getMyActivities: () => apiClient.get<ParticipantActivity[]>('/participant/activities'),
  getEvents: () => apiClient.get<ParticipantEvent[]>('/participant/events'),
  joinEvent: (eventId: string) => apiClient.post(`/participant/events/${encodeURIComponent(eventId)}/join`, {}),
  leaveEvent: (eventId: string) => apiClient.delete(`/participant/events/${encodeURIComponent(eventId)}/leave`),
  async getBadges(): Promise<ParticipantBadge[]> {
    const badges = await apiClient.get<Array<Record<string, unknown>>>('/participant/badges');
    return badges.map(badge => ({
      id: String(badge.id), code: String(badge.code || ''), title: String(badge.title), iconName: String(badge.iconName || 'book'),
      earnedDate: badge.earnedDate ? new Date(String(badge.earnedDate)).toLocaleDateString('vi-VN') : '',
      isLocked: Boolean(badge.isLocked),
    }));
  },
  async getCertificates(): Promise<ParticipantCertificate[]> {
    const certificates = await apiClient.get<Array<Record<string, unknown>>>('/participant/certificates');
    return certificates.map(certificate => ({
      id: String(certificate.id), title: String(certificate.title),
      activityTitle: String(certificate.activityTitle || ''), eventTitle: String(certificate.eventTitle || ''),
      issueDate: certificate.issueDate ? new Date(String(certificate.issueDate)).toLocaleDateString('vi-VN') : '',
      certificateCode: String(certificate.certificateCode),
      previewUrl: certificate.previewUrl ? String(certificate.previewUrl) : undefined,
    }));
  },
  getRegistrations: () => apiClient.get('/participant/registrations'),
  registerActivity: (activityId: string) => apiClient.post(`/participant/activities/${activityId}/register`),
  cancelActivity: (registrationId: string) => apiClient.delete(`/participant/registrations/${registrationId}`),
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
  submitFeedback: (data: { rating: number; comments: string; targetScope?: string; targetName?: string; heritageId?: string; boothId?: string }) =>
    apiClient.post<{ id: string }>('/participant/feedbacks', data),
  getMyFeedbacks: () => apiClient.get('/participant/feedbacks'),
};
