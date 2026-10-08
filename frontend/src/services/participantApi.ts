import {
  ParticipantActivity,
  ParticipantBadge,
  ParticipantCertificate,
  ParticipantEvent,
  ParticipantProfile,
} from '../types';
import { apiClient } from './apiClient';

export const participantApi = {
  async getProfile(): Promise<ParticipantProfile> {
    const user = await apiClient.get<Record<string, unknown>>('/participant/profile');
    return {
      id: String(user.id),
      name: String(user.fullName),
      email: String(user.email),
      phone: user.phone ? String(user.phone) : undefined,
      role: String(user.primaryRole),
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
  getNotifications: () => apiClient.get<Array<{ id: string; title: string; message: string; kind: string; isRead: boolean; link?: string; createdAt: string }>>('/participant/notifications'),
  markNotificationRead: (id: string) => apiClient.patch(`/participant/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.patch('/participant/notifications/read-all'),
  updateProfile: (data: { fullName: string; phone?: string; emailNotifications: boolean }) =>
    apiClient.patch<Record<string, unknown>>('/participant/profile', data),
  submitFeedback: (data: { rating: number; comments: string; targetScope?: string; targetName?: string; heritageId?: string; boothId?: string }) =>
    apiClient.post<{ id: string }>('/participant/feedbacks', data),
  getMyFeedbacks: () => apiClient.get('/participant/feedbacks'),
};
