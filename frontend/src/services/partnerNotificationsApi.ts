import { apiClient } from './apiClient';

export const PARTNER_NOTIFICATION_TYPES = [
  'PARTNER_APPLICATION_STATUS_CHANGED',
  'PARTNER_BOOTH_REQUEST_STATUS_CHANGED',
  'PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED',
  'PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED',
  'PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED',
  'PARTNER_EVENT_CANCELLED',
  'PARTNER_ACTIVITY_CANCELLED',
  'PARTNER_EVENT_PUBLISHED',
  'PARTNER_BOOTH_HOLD_EXPIRING',
] as const;

export type PartnerNotificationType = typeof PARTNER_NOTIFICATION_TYPES[number];
export type PartnerNotificationReference =
  'PARTNER_APPLICATION' | 'BOOTH_REQUEST' | 'ACTIVITY_PROPOSAL' | 'ACTIVITY_REQUEST' | 'EVENT' | 'ACTIVITY';

export interface PartnerNotificationItem {
  notificationId: number;
  type: PartnerNotificationType;
  title: string;
  message: string;
  referenceType: PartnerNotificationReference;
  referenceId: number;
  contextEventId: number | null;
  createdAt: string;
  readAt: string | null;
  read: boolean;
}

export interface PartnerNotificationPage {
  content: PartnerNotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PartnerNotificationQuery {
  page?: number;
  size?: number;
  read?: boolean;
  type?: PartnerNotificationType;
}

export const PARTNER_NOTIFICATIONS_CHANGED = 'partner:notifications-changed';

export function notifyPartnerNotificationsChanged() {
  window.dispatchEvent(new Event(PARTNER_NOTIFICATIONS_CHANGED));
}

export function partnerNotificationTarget(item: PartnerNotificationItem): string | null {
  if (!Number.isSafeInteger(item.referenceId) || item.referenceId <= 0) return null;
  const eventId = item.contextEventId;
  const contextValid = Number.isSafeInteger(eventId) && Number(eventId) > 0;
  switch (item.type) {
    case 'PARTNER_APPLICATION_STATUS_CHANGED':
      return item.referenceType === 'PARTNER_APPLICATION' && contextValid
        ? `/partner/events?application=${item.referenceId}` : null;
    case 'PARTNER_EVENT_PUBLISHED':
      return item.referenceType === 'EVENT' && item.referenceId === eventId
        ? `/partner/events/apply?event=${eventId}` : null;
    case 'PARTNER_BOOTH_REQUEST_STATUS_CHANGED':
    case 'PARTNER_BOOTH_HOLD_EXPIRING':
      return item.referenceType === 'BOOTH_REQUEST' && contextValid
        ? `/partner/booth-requests?eventId=${eventId}&view=requests` : null;
    case 'PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED':
      return item.referenceType === 'ACTIVITY_PROPOSAL' && contextValid
        ? `/partner/activities?eventId=${eventId}&view=proposals` : null;
    case 'PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED':
      return item.referenceType === 'ACTIVITY_REQUEST' && contextValid
        ? `/partner/activities?eventId=${eventId}&view=changes` : null;
    case 'PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED':
      return item.referenceType === 'ACTIVITY_REQUEST' && contextValid
        ? `/partner/activities?eventId=${eventId}&view=cancellations` : null;
    case 'PARTNER_EVENT_CANCELLED':
      return item.referenceType === 'EVENT' && item.referenceId === eventId
        ? `/partner/events?eventId=${eventId}` : null;
    case 'PARTNER_ACTIVITY_CANCELLED':
      return item.referenceType === 'ACTIVITY'
        ? `/partner/activities/${item.referenceId}` : null;
  }
}

export const partnerNotificationsApi = {
  list(query: PartnerNotificationQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0), size: String(query.size ?? 20), sort: 'createdAt,desc',
    });
    if (query.read !== undefined) params.set('read', String(query.read));
    if (query.type) params.set('type', query.type);
    return apiClient.get<PartnerNotificationPage>(`/partner/notifications?${params}`);
  },
  unreadCount() {
    return apiClient.get<{ unreadCount: number }>('/partner/notifications/unread-count');
  },
  markRead(id: number) {
    return apiClient.post<PartnerNotificationItem>(`/partner/notifications/${id}/read`);
  },
  markAllRead() {
    return apiClient.post<{ updatedCount: number }>('/partner/notifications/read-all');
  },
};
