import { apiClient } from './apiClient';

export interface AdminNotificationItem {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  referenceType: string;
  referenceId: number;
  contextEventId: number | null;
  createdAt: string;
  readAt: string | null;
  read: boolean;
}

export interface AdminNotificationPage {
  content: AdminNotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminNotificationQuery {
  page?: number;
  size?: number;
  read?: boolean;
}

export const ADMIN_NOTIFICATIONS_CHANGED = 'admin:notifications-changed';

export function notifyAdminNotificationsChanged() {
  window.dispatchEvent(new Event(ADMIN_NOTIFICATIONS_CHANGED));
}

export const adminNotificationsApi = {
  list(query: AdminNotificationQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: 'createdAt,desc',
    });
    if (query.read !== undefined) params.set('read', String(query.read));
    return apiClient.get<AdminNotificationPage>(`/admin/notifications?${params}`);
  },
  unreadCount() {
    return apiClient.get<{ unreadCount: number }>('/admin/notifications/unread-count');
  },
  markRead(notificationId: number) {
    return apiClient.post<AdminNotificationItem>(
      `/admin/notifications/${notificationId}/read`,
    );
  },
  markAllRead() {
    return apiClient.post<{ updatedCount: number }>('/admin/notifications/read-all');
  },
};
