import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarX,
  CheckCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  FileX2,
  Medal,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotificationLiveRefresh } from '../../hooks/useNotificationLiveUpdates';
import { useNavigate } from 'react-router-dom';
import { CompactPagination } from '../../components/ui/CompactPagination';
import {
  participantApi,
  type ParticipantNotificationItem,
  type ParticipantNotificationType,
} from '../../services/participantApi';
import type { Language } from '../../types';
import './ParticipantNotificationsPage.css';

interface ParticipantNotificationsPageProps {
  language: Language;
}

type ReadFilter = 'all' | 'unread';
type TypeFilter = 'all' | ParticipantNotificationType;

const PAGE_SIZE = 10;
const NOTIFICATIONS_CHANGED_EVENT = 'participant:notifications-changed';

const typeOptions: ParticipantNotificationType[] = [
  'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED',
  'ACTIVITY_CANCELLED',
  'EVENT_CANCELLED',
  'CERTIFICATE_ISSUED',
  'CERTIFICATE_REVOKED',
  'BADGE_UNLOCKED',
  'ACTIVITY_STARTING_SOON',
];

function typeLabel(type: ParticipantNotificationType, vi: boolean): string {
  const labels: Record<ParticipantNotificationType, [string, string]> = {
    ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED: ['Hoạt động thay đổi', 'Activity updated'],
    ACTIVITY_CANCELLED: ['Hoạt động bị hủy', 'Activity cancelled'],
    EVENT_CANCELLED: ['Sự kiện bị hủy', 'Event cancelled'],
    CERTIFICATE_ISSUED: ['Đã cấp chứng nhận', 'Certificate issued'],
    CERTIFICATE_REVOKED: ['Thu hồi chứng nhận', 'Certificate revoked'],
    BADGE_UNLOCKED: ['Mở khóa huy hiệu', 'Badge unlocked'],
    ACTIVITY_STARTING_SOON: ['Hoạt động sắp diễn ra', 'Activity starting soon'],
  };
  return labels[type][vi ? 0 : 1];
}

function emptyTitle(read: ReadFilter, type: TypeFilter, vi: boolean): string {
  const label = type === 'all' ? '' : typeLabel(type, vi);
  if (read === 'unread') {
    if (label) return vi ? `Không có thông báo chưa đọc thuộc loại “${label}”` : `No unread “${label}” notifications`;
    return vi ? 'Bạn đã đọc hết thông báo' : 'You are all caught up';
  }
  if (label) return vi ? `Chưa có thông báo thuộc loại “${label}”` : `No “${label}” notifications yet`;
  return vi ? 'Bạn chưa có thông báo nào' : 'You have no notifications';
}

function NotificationIcon({ type }: { type: ParticipantNotificationType }) {
  if (type === 'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED' || type === 'ACTIVITY_STARTING_SOON') return <CalendarClock size={20} />;
  if (type === 'ACTIVITY_CANCELLED' || type === 'EVENT_CANCELLED') return <CalendarX size={20} />;
  if (type === 'CERTIFICATE_ISSUED') return <FileCheck2 size={20} />;
  if (type === 'BADGE_UNLOCKED') return <Medal size={20} />;
  return <FileX2 size={20} />;
}

function formatNotificationTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function announceNotificationChange() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function ParticipantNotificationsPage({ language }: ParticipantNotificationsPageProps) {
  const vi = language === 'vi';
  const navigate = useNavigate();
  const [items, setItems] = useState<ParticipantNotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [revision, setRevision] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [readingId, setReadingId] = useState('');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const silentRefresh = useRef(false);

  useNotificationLiveRefresh(useCallback(() => {
    silentRefresh.current = true;
    setRevision(value => value + 1);
  }, []));

  useEffect(() => {
    let active = true;
    // This effect synchronizes the server-paginated notification page with the selected filters.
    // A live update keeps the list on screen instead of flashing the loading state.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!silentRefresh.current) setIsLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect
    setLoadError('');
    participantApi.getNotificationPage({
      page,
      size: PAGE_SIZE,
      read: readFilter === 'unread' ? false : undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
    })
      .then(result => {
        if (!active) return;
        setItems(result.items);
        setTotalPages(result.totalPages);
        setTotalElements(result.totalElements);
        if (result.totalPages > 0 && page >= result.totalPages) {
          setPage(result.totalPages - 1);
        }
      })
      .catch(error => {
        if (!active) return;
        setItems([]);
        setTotalPages(0);
        setTotalElements(0);
        setLoadError(error instanceof Error
          ? error.message
          : (vi ? 'Không thể tải danh sách thông báo.' : 'Unable to load notifications.'));
      })
      .finally(() => {
        if (!active) return;
        silentRefresh.current = false;
        setIsLoading(false);
      });
    return () => { active = false; };
  }, [page, readFilter, typeFilter, revision, vi]);

  const changeReadFilter = (filter: ReadFilter) => {
    setReadFilter(filter);
    setPage(0);
    setActionError('');
  };

  const changeTypeFilter = (filter: TypeFilter) => {
    setTypeFilter(filter);
    setPage(0);
    setActionError('');
  };

  const markAsRead = async (notification: ParticipantNotificationItem, navigateAfter = false) => {
    setActionError('');
    if (!notification.isRead) {
      setReadingId(notification.id);
      try {
        const updated = await participantApi.markNotificationRead(notification.id);
        if (readFilter === 'unread') {
          setRevision(value => value + 1);
        } else {
          setItems(current => current.map(item => item.id === notification.id ? updated : item));
        }
        announceNotificationChange();
      } catch (error) {
        setActionError(error instanceof Error
          ? error.message
          : (vi ? 'Không thể đánh dấu thông báo đã đọc.' : 'Unable to mark notification as read.'));
        setReadingId('');
        return;
      }
      setReadingId('');
    }
    if (!navigateAfter) return;
    if (notification.link) navigate(notification.link);
    else setActionError(vi
      ? 'Nội dung được nhắc đến hiện không mở được từ thông báo này.'
      : 'The referenced item cannot currently be opened from this notification.');
  };

  const markAllAsRead = async () => {
    setIsMarkingAll(true);
    setActionError('');
    try {
      await participantApi.markAllNotificationsRead();
      announceNotificationChange();
      setPage(0);
      setRevision(value => value + 1);
    } catch (error) {
      setActionError(error instanceof Error
        ? error.message
        : (vi ? 'Không thể đánh dấu tất cả đã đọc.' : 'Unable to mark all notifications as read.'));
    } finally {
      setIsMarkingAll(false);
    }
  };

  const isFiltered = readFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="participant-notifications-page">
      <div className="participant-page-header participant-notifications-header">
        <div className="participant-notifications-header-copy">
          <h1 className="participant-page-title workspace-page-title">
            {vi ? 'Thông báo' : 'Notifications'}
          </h1>
          <p className="participant-page-sub workspace-page-subtitle">
            {vi
              ? 'Theo dõi thay đổi của sự kiện, hoạt động, chứng nhận và huy hiệu.'
              : 'Track changes to your events, activities, certificates, and badges.'}
          </p>
        </div>
        <button
          type="button"
          className="btn-part-secondary"
          disabled={isMarkingAll || totalElements === 0}
          onClick={() => void markAllAsRead()}
        >
          <CheckCheck size={17} />
          {isMarkingAll
            ? (vi ? 'Đang xử lý...' : 'Updating...')
            : (vi ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read')}
        </button>
      </div>

      <section className="participant-notification-filters" aria-label={vi ? 'Bộ lọc thông báo' : 'Notification filters'}>
        <div className="participant-tabs-bar">
          <button type="button" className={`participant-tab-btn ${readFilter === 'all' ? 'is-active' : ''}`} onClick={() => changeReadFilter('all')}>
            {vi ? 'Tất cả' : 'All'}
          </button>
          <button type="button" className={`participant-tab-btn ${readFilter === 'unread' ? 'is-active' : ''}`} onClick={() => changeReadFilter('unread')}>
            {vi ? 'Chưa đọc' : 'Unread'}
          </button>
        </div>
        <label>
          <span>{vi ? 'Loại thông báo' : 'Notification type'}</span>
          <select value={typeFilter} onChange={event => changeTypeFilter(event.target.value as TypeFilter)}>
            <option value="all">{vi ? 'Tất cả loại' : 'All types'}</option>
            {typeOptions.map(type => <option key={type} value={type}>{typeLabel(type, vi)}</option>)}
          </select>
        </label>
      </section>

      {actionError && <div className="participant-notification-action-error" role="alert"><CircleAlert size={17} />{actionError}</div>}

      {isLoading ? (
        <div className="participant-data-state" role="status">
          <span className="participant-state-spinner" aria-hidden="true" />
          <strong>{vi ? 'Đang tải thông báo' : 'Loading notifications'}</strong>
          <p>{vi ? 'Hệ thống đang đồng bộ các cập nhật mới nhất.' : 'Synchronizing your latest updates.'}</p>
        </div>
      ) : loadError ? (
        <div className="participant-data-state is-error" role="alert">
          <strong>{vi ? 'Chưa tải được thông báo' : 'Unable to load notifications'}</strong>
          <p>{loadError}</p>
          <button type="button" className="btn-part-secondary" onClick={() => setRevision(value => value + 1)}>
            <RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="participant-data-state">
          <div className="participant-empty-icon-circle">
            <Bell size={28} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <strong>{emptyTitle(readFilter, typeFilter, vi)}</strong>
          <p>{vi
            ? 'Thông báo mới về hoạt động, chứng nhận và huy hiệu sẽ xuất hiện tại đây.'
            : 'Updates about activities, certificates, and badges will appear here.'}</p>
          {isFiltered && (
            <button
              type="button"
              className="btn-part-secondary participant-clear-filter-btn"
              onClick={() => {
                setReadFilter('all');
                setTypeFilter('all');
                setPage(0);
              }}
            >
              {vi ? 'Xem tất cả thông báo' : 'View all notifications'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="participant-notification-list">
            {items.map(notification => (
              <article key={notification.id} className={`participant-notification-card ${notification.isRead ? 'is-read' : 'is-unread'}`}>
                <div className="participant-notification-icon" aria-hidden="true">
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="participant-notification-copy">
                  <div className="participant-notification-title-row">
                    <div>
                      <span className="participant-notification-type">{typeLabel(notification.type, vi)}</span>
                      <h2>{notification.title}</h2>
                    </div>
                    {!notification.isRead && <span className="participant-notification-unread"><BellRing size={13} />{vi ? 'Chưa đọc' : 'Unread'}</span>}
                  </div>
                  <p>{notification.message}</p>
                  <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt, language)}</time>
                </div>
                <div className="participant-notification-actions">
                  {!notification.isRead && (
                    <button type="button" className="btn-part-secondary" disabled={readingId === notification.id} onClick={() => void markAsRead(notification)}>
                      <CheckCheck size={15} />
                      {readingId === notification.id ? (vi ? 'Đang xử lý...' : 'Updating...') : (vi ? 'Đã đọc' : 'Mark read')}
                    </button>
                  )}
                  <button type="button" className="btn-part-primary" disabled={readingId === notification.id} onClick={() => void markAsRead(notification, true)}>
                    <ExternalLink size={15} />{vi ? 'Xem chi tiết' : 'View details'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <CompactPagination
            page={page + 1}
            pages={totalPages}
            total={totalElements}
            disabled={isLoading || Boolean(readingId)}
            onPage={nextPage => setPage(nextPage - 1)}
          />
        </>
      )}
    </div>
  );
}
