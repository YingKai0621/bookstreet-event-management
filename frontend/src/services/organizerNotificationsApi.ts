import { apiClient } from './apiClient';

export const ORGANIZER_NOTIFICATION_TYPES = [
  'ORGANIZER_NEW_PARTNER_APPLICATION',
  'ORGANIZER_NEW_BOOTH_REQUEST',
  'ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED',
  'ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST',
  'ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST',
  'ORGANIZER_BOOTH_RESELECTION_REQUIRED',
  'ORGANIZER_BOOTH_PAYMENT_CONFIRMED',
] as const;

export type OrganizerNotificationType = typeof ORGANIZER_NOTIFICATION_TYPES[number];
export type OrganizerNotificationReference =
  'PARTNER_APPLICATION' | 'BOOTH_REQUEST' | 'ACTIVITY_PROPOSAL' | 'ACTIVITY_REQUEST';

export interface OrganizerNotificationItem {
  notificationId: number;
  type: OrganizerNotificationType;
  title: string;
  message: string;
  referenceType: OrganizerNotificationReference;
  referenceId: number;
  contextEventId: number;
  createdAt: string;
  readAt: string | null;
  read: boolean;
}

export interface OrganizerNotificationPage {
  content: OrganizerNotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OrganizerNotificationQuery {
  page?: number;
  size?: number;
  read?: boolean;
  type?: OrganizerNotificationType;
}

export const ORGANIZER_NOTIFICATIONS_CHANGED = 'organizer:notifications-changed';

export function notifyOrganizerNotificationsChanged() {
  window.dispatchEvent(new Event(ORGANIZER_NOTIFICATIONS_CHANGED));
}

export function organizerNotificationTarget(item: OrganizerNotificationItem): string | null {
  if (!Number.isSafeInteger(item.referenceId) || item.referenceId <= 0
      || !Number.isSafeInteger(item.contextEventId) || item.contextEventId <= 0) return null;

  const eventId = encodeURIComponent(String(item.contextEventId));
  switch (item.type) {
    case 'ORGANIZER_NEW_PARTNER_APPLICATION':
      return item.referenceType === 'PARTNER_APPLICATION'
        ? `/organizer/events/${eventId}?section=partners` : null;
    case 'ORGANIZER_NEW_BOOTH_REQUEST':
    case 'ORGANIZER_BOOTH_RESELECTION_REQUIRED':
    case 'ORGANIZER_BOOTH_PAYMENT_CONFIRMED':
      return item.referenceType === 'BOOTH_REQUEST'
        ? `/organizer/booth-requests?eventId=${eventId}` : null;
    case 'ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED':
      return item.referenceType === 'ACTIVITY_PROPOSAL'
        ? `/organizer/activities?eventId=${eventId}&view=proposals` : null;
    case 'ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST':
      return item.referenceType === 'ACTIVITY_REQUEST'
        ? `/organizer/activities?eventId=${eventId}&view=changes` : null;
    case 'ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST':
      return item.referenceType === 'ACTIVITY_REQUEST'
        ? `/organizer/activities?eventId=${eventId}&view=cancellations` : null;
  }
}

export const organizerNotificationsApi = {
  list(query: OrganizerNotificationQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: 'createdAt,desc',
    });
    if (query.read !== undefined) params.set('read', String(query.read));
    if (query.type) params.set('type', query.type);
    return apiClient.get<OrganizerNotificationPage>(`/organizer/notifications?${params}`);
  },
  unreadCount() {
    return apiClient.get<{ unreadCount: number }>('/organizer/notifications/unread-count');
  },
  markRead(notificationId: number) {
    return apiClient.post<OrganizerNotificationItem>(
      `/organizer/notifications/${notificationId}/read`,
    );
  },
  markAllRead() {
    return apiClient.post<{ updatedCount: number }>('/organizer/notifications/read-all');
  },
};
