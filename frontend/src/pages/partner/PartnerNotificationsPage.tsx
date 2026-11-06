import { Bell, CalendarDays, CheckCheck, ChevronRight, ClipboardList, Filter, Layers, Store, TimerReset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../components/partner/PartnerEvents.css';
import { PartnerFilterSelect } from '../../components/partner/PartnerFilterSelect';
import { CompactPagination } from '../../components/ui/CompactPagination';
import { PARTNER_NOTIFICATION_TYPES, notifyPartnerNotificationsChanged, partnerNotificationTarget,
  partnerNotificationsApi, type PartnerNotificationItem, type PartnerNotificationType } from '../../services/partnerNotificationsApi';
import type { Language } from '../../types';
import { PartnerEventHero, PartnerEventLoading } from './PartnerEventPageShared';
import './PartnerPages.css';

const LABELS: Record<PartnerNotificationType, string> = {
  PARTNER_APPLICATION_STATUS_CHANGED: 'Hồ sơ tham gia sự kiện',
  PARTNER_BOOTH_REQUEST_STATUS_CHANGED: 'Yêu cầu gian hàng',
  PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED: 'Đề xuất hoạt động',
  PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED: 'Yêu cầu thay đổi hoạt động',
  PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED: 'Yêu cầu hủy hoạt động',
  PARTNER_EVENT_CANCELLED: 'Sự kiện bị hủy',
  PARTNER_ACTIVITY_CANCELLED: 'Hoạt động bị hủy',
  PARTNER_EVENT_PUBLISHED: 'Sự kiện mới',
  PARTNER_BOOTH_HOLD_EXPIRING: 'Sắp hết hạn giữ gian hàng',
};

const READ_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'read', label: 'Đã đọc' },
] as const;

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const ONE_DAY_MS = 86_400_000;

type ReadFilter = typeof READ_FILTERS[number]['value'];

function dayKey(value: string | number): string {
  return DAY_KEY_FORMAT.format(new Date(value));
}

function NotificationIcon({ type }: { type: PartnerNotificationType }) {
  if (type === 'PARTNER_BOOTH_HOLD_EXPIRING') {
    return <span className="notif-icon-circle reminder"><TimerReset size={18} /></span>;
  }
  if (type === 'PARTNER_BOOTH_REQUEST_STATUS_CHANGED') {
    return <span className="notif-icon-circle booth"><Store size={18} /></span>;
  }
  if (type === 'PARTNER_EVENT_PUBLISHED' || type === 'PARTNER_EVENT_CANCELLED') {
    return <span className="notif-icon-circle"><CalendarDays size={18} /></span>;
  }
  if (type === 'PARTNER_APPLICATION_STATUS_CHANGED') {
    return <span className="notif-icon-circle"><ClipboardList size={18} /></span>;
  }
  return <span className="notif-icon-circle"><Layers size={18} /></span>;
}

export function PartnerNotificationsPage({ language }: { language: Language }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PartnerNotificationItem[]>([]);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [read, setRead] = useState<ReadFilter>('all');
  const [type, setType] = useState<'all' | PartnerNotificationType>('all');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError('');
    partnerNotificationsApi.list({ page, size: 10,
      read: read === 'all' ? undefined : read === 'read',
      type: type === 'all' ? undefined : type,
    }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.content)) throw new Error('Phản hồi thông báo không hợp lệ.');
      setItems(result.content);
      setLoadedAt(Date.now());
      setPages(result.totalPages);
      setTotal(result.totalElements);
      if (result.totalPages > 0 && page >= result.totalPages) setPage(result.totalPages - 1);
    }).catch(cause => {
      if (!active) return;
      setError(cause?.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : cause?.status === 403 ? 'Bạn không có quyền xem thông báo Partner.'
          : 'Không tải được thông báo. Vui lòng thử lại.');
    }).finally(() => { if (active) setLoading(false); });
    // The badge is optional context, so a failed count hides it instead of reporting zero.
    partnerNotificationsApi.unreadCount()
      .then(result => { if (active) setUnreadCount(Number.isFinite(result.unreadCount) ? result.unreadCount : null); })
      .catch(() => { if (active) setUnreadCount(null); });
    return () => { active = false; };
  }, [page, read, revision, type]);

  const groups = useMemo(() => {
    const today = dayKey(loadedAt);
    const yesterday = dayKey(loadedAt - ONE_DAY_MS);
    const dateFormat = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'long', timeZone: TIME_ZONE });
    const result: Array<{ key: string; label: string; items: PartnerNotificationItem[] }> = [];
    for (const item of items) {
      const key = dayKey(item.createdAt);
      let group = result.find(candidate => candidate.key === key);
      if (!group) {
        group = { key, items: [],
          label: key === today ? 'Hôm nay' : key === yesterday ? 'Hôm qua' : dateFormat.format(new Date(item.createdAt)) };
        result.push(group);
      }
      group.items.push(item);
    }
    return result;
  }, [items, language, loadedAt]);

  async function openItem(item: PartnerNotificationItem) {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      if (!item.read) await partnerNotificationsApi.markRead(item.notificationId);
      notifyPartnerNotificationsChanged();
      setRevision(value => value + 1);
      const target = partnerNotificationTarget(item);
      if (target) navigate(target);
      else setActionError('Nội dung được nhắc đến hiện không mở được từ thông báo này.');
    } catch { setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.'); }
    finally { setPending(false); }
  }

  async function markAll() {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      await partnerNotificationsApi.markAllRead();
      notifyPartnerNotificationsChanged();
      setRevision(value => value + 1);
    } catch { setActionError('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.'); }
    finally { setPending(false); }
  }

  const timeFormatter = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { timeStyle: 'short', timeZone: TIME_ZONE });
  const filtered = read !== 'all' || type !== 'all';

  return <div className="partner-page partner-event-hub partner-notifications-page">
    <PartnerEventHero
      title="Thông báo"
      breadcrumb="THÔNG BÁO"
      description="Kết quả hồ sơ, gian hàng và hoạt động của bạn."
      isLoading={loading}
      onRefresh={() => setRevision(value => value + 1)}
    />

    <section className="event-hub-controls" aria-label="Lọc thông báo">
      <div className="event-hub-control-row">
        <div className="event-hub-status-group">
          <div className="event-hub-filters" role="tablist" aria-label="Trạng thái đọc">
            {READ_FILTERS.map(filter => (
              <button type="button" role="tab" aria-selected={read === filter.value} key={filter.value}
                className={`event-hub-filter is-${filter.value} ${read === filter.value ? 'is-active' : ''}`}
                onClick={() => { setRead(filter.value); setPage(0); }}>
                {filter.label}
                {filter.value === 'unread' && unreadCount !== null && unreadCount > 0 && <span>{unreadCount}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="event-hub-selectors">
          <PartnerFilterSelect
            label="Loại thông báo"
            ariaLabel="Lọc theo loại thông báo"
            icon={Filter}
            value={type}
            options={[
              { value: 'all' as const, label: 'Tất cả loại' },
              ...PARTNER_NOTIFICATION_TYPES.map(value => ({ value, label: LABELS[value] })),
            ]}
            onChange={value => { setType(value); setPage(0); }}
          />
          <button type="button" className="btn-part-secondary" onClick={() => void markAll()}
            disabled={pending || loading || unreadCount === 0}>
            <CheckCheck size={16} /> Đã đọc tất cả
          </button>
        </div>
      </div>
    </section>

    {actionError && <div role="alert" className="partner-form-alert error"><span>{actionError}</span></div>}

    {loading ? <PartnerEventLoading label="Đang tải thông báo..." />
      : error ? <div className="event-hub-empty" role="alert">
        <Bell size={30} />
        <h2>{error}</h2>
        <button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button>
      </div>
        : items.length === 0 ? <div className="event-hub-empty">
          <Bell size={30} />
          <h2>{filtered ? 'Không có thông báo phù hợp bộ lọc.' : 'Bạn chưa có thông báo nào.'}</h2>
          <p>{filtered ? 'Hãy thử chọn trạng thái hoặc loại khác.' : 'Kết quả hồ sơ, gian hàng và sự kiện mới sẽ xuất hiện tại đây.'}</p>
          {filtered && <button type="button" onClick={() => { setRead('all'); setType('all'); setPage(0); }}>Xóa bộ lọc</button>}
        </div>
          : <section aria-label="Danh sách thông báo">
            {groups.map(group => <div className="partner-inbox-group" key={group.key}>
              <h2 className="partner-inbox-day">{group.label}</h2>
              <div className="notifications-list-container">
                {group.items.map(item => {
                  const target = partnerNotificationTarget(item);
                  const urgent = !item.read && item.type === 'PARTNER_BOOTH_HOLD_EXPIRING';
                  return <button type="button" key={item.notificationId} disabled={pending}
                    onClick={() => void openItem(item)}
                    className={`notification-row-item ${item.read ? 'is-read' : 'unread'} ${urgent ? 'is-urgent' : ''}`}>
                    <NotificationIcon type={item.type} />
                    <span className="notification-row-copy">
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>
                        <em>{LABELS[item.type] || 'Thông báo'}</em>
                        <time dateTime={item.createdAt}>{timeFormatter.format(new Date(item.createdAt))}</time>
                      </small>
                    </span>
                    {!item.read && <span className="notification-row-dot" title="Chưa đọc" />}
                    {target && <ChevronRight className="notification-row-arrow" size={18} aria-hidden="true" />}
                  </button>;
                })}
              </div>
            </div>)}
            {pages > 1 && <CompactPagination page={page + 1} pages={pages} total={total} onPage={next => setPage(next - 1)} disabled={pending} />}
          </section>}
  </div>;
}
