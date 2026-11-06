import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Store,
  TimerReset,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotificationLiveRefresh } from '../../hooks/useNotificationLiveUpdates';
import { useNavigate } from 'react-router-dom';
import type { Language } from '../../types';
import { ApiError } from '../../services/apiClient';
import {
  ORGANIZER_NOTIFICATIONS_CHANGED,
  ORGANIZER_NOTIFICATION_TYPES,
  notifyOrganizerNotificationsChanged,
  organizerNotificationTarget,
  organizerNotificationsApi,
  type OrganizerNotificationItem,
  type OrganizerNotificationType,
} from '../../services/organizerNotificationsApi';
import { CompactPagination } from '../ui/CompactPagination';
import { groupNotificationsByDay, notificationTimeFormatter } from '../ui/notificationDayGroups';
import './OrganizerNotificationsView.css';

const TYPE_LABELS: Record<OrganizerNotificationType, { vi: string; en: string }> = {
  ORGANIZER_NEW_PARTNER_APPLICATION: { vi: 'Hồ sơ đối tác', en: 'Partner application' },
  ORGANIZER_NEW_BOOTH_REQUEST: { vi: 'Yêu cầu gian hàng', en: 'Booth request' },
  ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED: { vi: 'Đề xuất hoạt động', en: 'Activity proposal' },
  ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST: { vi: 'Yêu cầu đổi hoạt động', en: 'Activity change request' },
  ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST: { vi: 'Yêu cầu hủy hoạt động', en: 'Activity cancellation request' },
  ORGANIZER_BOOTH_RESELECTION_REQUIRED: { vi: 'Cần chọn lại gian hàng', en: 'Booth re-selection' },
  ORGANIZER_BOOTH_PAYMENT_CONFIRMED: { vi: 'Đã thanh toán gian hàng', en: 'Booth payment confirmed' },
};

const READ_FILTERS = [
  { value: 'all', vi: 'Tất cả', en: 'All' },
  { value: 'unread', vi: 'Chưa đọc', en: 'Unread' },
  { value: 'read', vi: 'Đã đọc', en: 'Read' },
] as const;

type ReadFilter = typeof READ_FILTERS[number]['value'];
type TypeFilter = 'all' | OrganizerNotificationType;

function loadErrorMessage(error: unknown, language: Language): string {
  const vi = language === 'vi';
  if (error instanceof ApiError && error.status === 401) {
    return vi ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return vi ? 'Bạn không có quyền xem thông báo Organizer.' : 'You cannot access Organizer notifications.';
  }
  return vi ? 'Không tải được thông báo. Vui lòng thử lại.' : 'Notifications could not be loaded. Please try again.';
}

function emptyTitle(read: ReadFilter, type: TypeFilter, vi: boolean): string {
  const label = type === 'all' ? '' : TYPE_LABELS[type][vi ? 'vi' : 'en'];
  if (read === 'unread') {
    if (label) return vi ? `Không có thông báo chưa đọc thuộc loại “${label}”` : `No unread “${label}” notifications`;
    return vi ? 'Bạn đã đọc hết thông báo' : 'You are all caught up';
  }
  if (read === 'read') {
    if (label) return vi ? `Chưa có thông báo đã đọc thuộc loại “${label}”` : `No read “${label}” notifications yet`;
    return vi ? 'Chưa có thông báo đã đọc' : 'No read notifications yet';
  }
  if (label) return vi ? `Chưa có thông báo thuộc loại “${label}”` : `No “${label}” notifications yet`;
  return vi ? 'Bạn chưa có thông báo nào' : 'You do not have any notifications yet';
}

function typeIcon(type: OrganizerNotificationType) {
  if (type === 'ORGANIZER_NEW_PARTNER_APPLICATION') return <Users size={18} />;
  if (type === 'ORGANIZER_NEW_BOOTH_REQUEST') return <Store size={18} />;
  if (type === 'ORGANIZER_BOOTH_RESELECTION_REQUIRED') return <TimerReset size={18} />;
  if (type === 'ORGANIZER_BOOTH_PAYMENT_CONFIRMED') return <CreditCard size={18} />;
  return <CalendarClock size={18} />;
}

export function OrganizerNotificationsView({ language }: { language: Language }) {
  const vi = language === 'vi';
  const navigate = useNavigate();
  const [items, setItems] = useState<OrganizerNotificationItem[]>([]);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);
  const silentRefresh = useRef(false);

  useNotificationLiveRefresh(useCallback(() => {
    silentRefresh.current = true;
    setRevision(value => value + 1);
  }, []));

  useEffect(() => {
    let active = true;
    // A live update keeps the list on screen instead of flashing the loading state.
    // oxlint-disable-next-line react/set-state-in-effect -- Route/filter changes intentionally start a server refresh.
    if (!silentRefresh.current) setLoading(true);
    // oxlint-disable-next-line react/set-state-in-effect -- Route/filter changes intentionally start a server refresh.
    setLoadError('');
    organizerNotificationsApi.list({
      page,
      size: 10,
      read: readFilter === 'all' ? undefined : readFilter === 'read',
      type: typeFilter === 'all' ? undefined : typeFilter,
    }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.content)) throw new Error('Invalid notification response');
      setItems(result.content);
      setLoadedAt(Date.now());
      setPages(result.totalPages);
      setTotal(result.totalElements);
      if (result.totalPages > 0 && page >= result.totalPages) setPage(result.totalPages - 1);
      else if (result.totalPages === 0 && page !== 0) setPage(0);
    }).catch(error => {
      if (active) setLoadError(loadErrorMessage(error, language));
    }).finally(() => {
      if (!active) return;
      silentRefresh.current = false;
      setLoading(false);
    });
    // The tab badge is optional context, so a failed count hides it instead of reporting zero.
    organizerNotificationsApi.unreadCount()
      .then(result => { if (active) setUnreadCount(Number.isFinite(result.unreadCount) ? result.unreadCount : null); })
      .catch(() => { if (active) setUnreadCount(null); });
    return () => { active = false; };
  }, [language, page, readFilter, revision, typeFilter]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(ORGANIZER_NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(ORGANIZER_NOTIFICATIONS_CHANGED, refresh);
  }, []);

  const groups = useMemo(() => groupNotificationsByDay(items, loadedAt, language), [items, language, loadedAt]);

  async function openNotification(item: OrganizerNotificationItem) {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      if (!item.read) {
        const confirmed = await organizerNotificationsApi.markRead(item.notificationId);
        setItems(current => current.map(value => value.notificationId === confirmed.notificationId
          ? confirmed : value));
        notifyOrganizerNotificationsChanged();
      }
      const target = organizerNotificationTarget(item);
      if (target) navigate(target);
      else setActionError(vi
        ? 'Nội dung được nhắc đến hiện không thể mở từ thông báo này.'
        : 'The referenced item cannot currently be opened from this notification.');
    } catch {
      setActionError(vi
        ? 'Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.'
        : 'The notification could not be marked as read. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function markAllRead() {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      await organizerNotificationsApi.markAllRead();
      notifyOrganizerNotificationsChanged();
    } catch {
      setActionError(vi
        ? 'Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.'
        : 'Notifications could not be marked as read. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const filtered = readFilter !== 'all' || typeFilter !== 'all';
  const timeFormatter = notificationTimeFormatter(language);

  return <div className="organizer-content org-inbox">
    <div className="org-inbox-header">
      <div>
        <h1 className="organizer-view-title workspace-page-title">{vi ? 'Thông báo' : 'Notifications'}</h1>
        <p className="organizer-view-sub workspace-page-subtitle">
          {vi ? 'Các hồ sơ và yêu cầu đang chờ bạn xử lý.' : 'Applications and requests waiting for your review.'}
        </p>
      </div>
      <div className="org-inbox-actions">
        <button type="button" className="btn-org-secondary" disabled={loading}
          onClick={() => setRevision(value => value + 1)}>
          <RefreshCw size={16} />{vi ? 'Tải lại' : 'Refresh'}
        </button>
        <button type="button" className="btn-org-secondary" disabled={pending || loading || unreadCount === 0}
          onClick={() => void markAllRead()}>
          <CheckCheck size={16} />{vi ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read'}
        </button>
      </div>
    </div>

    <section className="org-inbox-toolbar" aria-label={vi ? 'Lọc thông báo' : 'Filter notifications'}>
      <div className="org-inbox-tabs" role="tablist" aria-label={vi ? 'Trạng thái đọc' : 'Read state'}>
        {READ_FILTERS.map(filter => (
          <button type="button" role="tab" key={filter.value} aria-selected={readFilter === filter.value}
            className={`org-tab-btn ${readFilter === filter.value ? 'is-active' : ''}`}
            onClick={() => { setReadFilter(filter.value); setPage(0); }}>
            {filter[vi ? 'vi' : 'en']}
            {filter.value === 'unread' && unreadCount !== null && unreadCount > 0 && <span className="org-inbox-count">{unreadCount}</span>}
          </button>
        ))}
      </div>
      <label className="org-inbox-type">
        <span>{vi ? 'Loại' : 'Type'}</span>
        <select value={typeFilter} onChange={event => {
          setTypeFilter(event.target.value as TypeFilter);
          setPage(0);
        }}>
          <option value="all">{vi ? 'Tất cả loại' : 'All types'}</option>
          {ORGANIZER_NOTIFICATION_TYPES.map(type => <option key={type} value={type}>
            {TYPE_LABELS[type][vi ? 'vi' : 'en']}
          </option>)}
        </select>
      </label>
    </section>

    {actionError && <p className="org-inbox-action-error" role="alert">{actionError}</p>}
    {loading ? <div className="org-inbox-state" role="status">
      <RefreshCw size={24} className="org-inbox-spin" />
      <strong>{vi ? 'Đang tải thông báo...' : 'Loading notifications...'}</strong>
    </div>
      : loadError ? <div className="org-inbox-state" role="alert">
        <Bell size={28} />
        <strong>{loadError}</strong>
        <button type="button" className="btn-org-secondary" onClick={() => setRevision(value => value + 1)}>
          {vi ? 'Thử lại' : 'Retry'}
        </button>
      </div>
        : items.length === 0 ? <div className="org-inbox-state">
          <Bell size={28} />
          <strong>{emptyTitle(readFilter, typeFilter, vi)}</strong>
          <p>{vi
            ? 'Hồ sơ và yêu cầu mới từ đối tác sẽ xuất hiện tại đây.'
            : 'New applications and requests from Partners will appear here.'}</p>
          {filtered && <button type="button" className="btn-org-secondary"
            onClick={() => { setReadFilter('all'); setTypeFilter('all'); setPage(0); }}>
            {vi ? 'Xem tất cả thông báo' : 'View all notifications'}
          </button>}
        </div>
          : <section aria-label={vi ? 'Danh sách thông báo' : 'Notification list'}>
            {groups.map(group => <div className="org-inbox-group" key={group.key}>
              <h2 className="org-inbox-day">{group.label}</h2>
              <div className="org-inbox-list">
                {group.items.map(item => {
                  const urgent = !item.read && item.type === 'ORGANIZER_BOOTH_RESELECTION_REQUIRED';
                  return <button type="button" key={item.notificationId} disabled={pending}
                    onClick={() => void openNotification(item)}
                    className={`org-inbox-row ${item.read ? 'is-read' : 'is-unread'} ${urgent ? 'is-urgent' : ''}`}>
                    <span className="org-inbox-icon">{typeIcon(item.type)}</span>
                    <span className="org-inbox-copy">
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>
                        <em>{TYPE_LABELS[item.type][vi ? 'vi' : 'en']}</em>
                        <time dateTime={item.createdAt}>{timeFormatter.format(new Date(item.createdAt))}</time>
                      </small>
                    </span>
                    {!item.read && <span className="org-inbox-dot" title={vi ? 'Chưa đọc' : 'Unread'} />}
                    {organizerNotificationTarget(item) && <ChevronRight className="org-inbox-arrow" size={18} aria-hidden="true" />}
                  </button>;
                })}
              </div>
            </div>)}
            {pages > 1 && <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} disabled={pending} />}
          </section>}
  </div>;
}
