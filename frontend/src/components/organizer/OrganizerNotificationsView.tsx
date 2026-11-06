import {
  Bell,
  CalendarClock,
  CheckCheck,
  ExternalLink,
  RefreshCw,
  Store,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

const TYPE_LABELS: Record<OrganizerNotificationType, { vi: string; en: string }> = {
  ORGANIZER_NEW_PARTNER_APPLICATION: { vi: 'Hồ sơ đối tác', en: 'Partner application' },
  ORGANIZER_NEW_BOOTH_REQUEST: { vi: 'Yêu cầu gian hàng', en: 'Booth request' },
  ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED: { vi: 'Đề xuất hoạt động', en: 'Activity proposal' },
  ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST: { vi: 'Yêu cầu đổi hoạt động', en: 'Activity change request' },
  ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST: { vi: 'Yêu cầu hủy hoạt động', en: 'Activity cancellation request' },
  ORGANIZER_BOOTH_RESELECTION_REQUIRED: { vi: 'Cần chọn lại gian hàng', en: 'Booth re-selection' },
  ORGANIZER_BOOTH_PAYMENT_CONFIRMED: { vi: 'Đã thanh toán gian hàng', en: 'Booth payment confirmed' },
};

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

function emptyTitle(read: 'all' | 'unread' | 'read', type: 'all' | OrganizerNotificationType, vi: boolean): string {
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
  if (type === 'ORGANIZER_NEW_BOOTH_REQUEST'
      || type === 'ORGANIZER_BOOTH_RESELECTION_REQUIRED'
      || type === 'ORGANIZER_BOOTH_PAYMENT_CONFIRMED') return <Store size={18} />;
  return <CalendarClock size={18} />;
}

export function OrganizerNotificationsView({ language }: { language: Language }) {
  const vi = language === 'vi';
  const navigate = useNavigate();
  const [items, setItems] = useState<OrganizerNotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | OrganizerNotificationType>('all');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }), [vi]);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Route/filter changes intentionally start a server refresh.
    setLoading(true);
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
      setPages(result.totalPages);
      setTotal(result.totalElements);
      if (result.totalPages > 0 && page >= result.totalPages) setPage(result.totalPages - 1);
      else if (result.totalPages === 0 && page !== 0) setPage(0);
    }).catch(error => {
      if (active) setLoadError(loadErrorMessage(error, language));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [language, page, readFilter, revision, typeFilter]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(ORGANIZER_NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(ORGANIZER_NOTIFICATIONS_CHANGED, refresh);
  }, []);

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

  return <div className="organizer-content">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
      <div>
        <h1 className="organizer-view-title workspace-page-title">{vi ? 'Thông báo' : 'Notifications'}</h1>
        <p className="organizer-view-sub workspace-page-subtitle">
          {vi ? 'Các hồ sơ và yêu cầu đang chờ bạn xử lý.' : 'Applications and requests waiting for your review.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-org-secondary" disabled={loading}
          onClick={() => setRevision(value => value + 1)}>
          <RefreshCw size={16} />{vi ? 'Tải lại' : 'Refresh'}
        </button>
        <button type="button" className="btn-org-secondary" disabled={pending || loading}
          onClick={() => void markAllRead()}>
          <CheckCheck size={16} />{vi ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read'}
        </button>
      </div>
    </div>

    <div className="org-tabs-bar" style={{ flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <span>{vi ? 'Trạng thái' : 'Status'}</span>
        <select value={readFilter} onChange={event => {
          setReadFilter(event.target.value as typeof readFilter);
          setPage(0);
        }}>
          <option value="all">{vi ? 'Tất cả' : 'All'}</option>
          <option value="unread">{vi ? 'Chưa đọc' : 'Unread'}</option>
          <option value="read">{vi ? 'Đã đọc' : 'Read'}</option>
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <span>{vi ? 'Loại' : 'Type'}</span>
        <select value={typeFilter} onChange={event => {
          setTypeFilter(event.target.value as typeof typeFilter);
          setPage(0);
        }}>
          <option value="all">{vi ? 'Tất cả' : 'All'}</option>
          {ORGANIZER_NOTIFICATION_TYPES.map(type => <option key={type} value={type}>
            {TYPE_LABELS[type][vi ? 'vi' : 'en']}
          </option>)}
        </select>
      </label>
    </div>

    {actionError && <p className="app-loading-state" role="alert">{actionError}</p>}
    {loading ? <p className="app-loading-state" role="status">{vi ? 'Đang tải thông báo...' : 'Loading notifications...'}</p>
      : loadError ? <div className="organizer-card" role="alert" style={{ padding: '1.5rem' }}>
        <p>{loadError}</p>
        <button type="button" className="btn-org-secondary" onClick={() => setRevision(value => value + 1)}>
          {vi ? 'Thử lại' : 'Retry'}
        </button>
      </div>
        : items.length === 0 ? <div className="organizer-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Bell size={28} />
          <p>{emptyTitle(readFilter, typeFilter, vi)}</p>
        </div>
          : <div className="organizer-card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map(item => <button type="button" key={item.notificationId} disabled={pending}
              onClick={() => void openNotification(item)}
              style={{ width: '100%', border: 0, borderBottom: '1px solid #EEF2F0', padding: '1rem 1.25rem', background: item.read ? '#FFFFFF' : '#F4F9F6', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', textAlign: 'left' }}>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: '#EAF3EE', color: '#17382E', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {typeIcon(item.type)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <strong>{item.title}</strong>
                  {!item.read && <span aria-label={vi ? 'Chưa đọc' : 'Unread'} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C84C32' }} />}
                </span>
                <span style={{ display: 'block', color: '#556B65', marginTop: 3 }}>{item.message}</span>
                <small style={{ color: '#7B8C86' }}>
                  {TYPE_LABELS[item.type][vi ? 'vi' : 'en']} · {dateFormatter.format(new Date(item.createdAt))}
                </small>
              </span>
              {organizerNotificationTarget(item) && <ExternalLink size={16} aria-hidden="true" />}
            </button>)}
          </div>}

    {!loading && !loadError && pages > 1
      && <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} disabled={pending} />}
  </div>;
}
