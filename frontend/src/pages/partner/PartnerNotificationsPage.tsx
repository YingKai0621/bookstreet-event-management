import { Bell, CheckCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompactPagination } from '../../components/ui/CompactPagination';
import { PARTNER_NOTIFICATION_TYPES, notifyPartnerNotificationsChanged, partnerNotificationTarget,
  partnerNotificationsApi, type PartnerNotificationItem, type PartnerNotificationType } from '../../services/partnerNotificationsApi';
import type { Language } from '../../types';
import './PartnerPages.css';

const LABELS: Record<PartnerNotificationType, string> = {
  PARTNER_APPLICATION_STATUS_CHANGED: 'Hồ sơ tham gia sự kiện',
  PARTNER_BOOTH_REQUEST_STATUS_CHANGED: 'Yêu cầu gian hàng',
  PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED: 'Đề xuất hoạt động',
  PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED: 'Yêu cầu thay đổi hoạt động',
  PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED: 'Yêu cầu hủy hoạt động',
  PARTNER_EVENT_CANCELLED: 'Sự kiện bị hủy',
  PARTNER_ACTIVITY_CANCELLED: 'Hoạt động bị hủy',
};

export function PartnerNotificationsPage({ language }: { language: Language }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PartnerNotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [read, setRead] = useState<'all' | 'unread' | 'read'>('all');
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
      setPages(result.totalPages);
      setTotal(result.totalElements);
      if (result.totalPages > 0 && page >= result.totalPages) setPage(result.totalPages - 1);
    }).catch(cause => {
      if (!active) return;
      setError(cause?.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : cause?.status === 403 ? 'Bạn không có quyền xem thông báo Partner.'
          : 'Không tải được thông báo. Vui lòng thử lại.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, read, revision, type]);

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

  return <div className="partner-notifications-page">
    <div className="partner-page-header"><div><h1 className="partner-page-title workspace-page-title">Thông báo</h1>
      <p className="partner-page-sub workspace-page-subtitle">Kết quả hồ sơ, gian hàng và hoạt động của bạn.</p></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading} aria-label="Tải lại thông báo"><RefreshCw size={17} /> Tải lại</button>
        <button type="button" onClick={() => void markAll()} disabled={pending || loading || total === 0}><CheckCheck size={17} /> Đã đọc tất cả</button>
      </div></div>
    <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      <label>Trạng thái <select value={read} onChange={event => { setRead(event.target.value as typeof read); setPage(0); }}>
        <option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option>
      </select></label>
      <label>Loại <select value={type} onChange={event => { setType(event.target.value as typeof type); setPage(0); }}>
        <option value="all">Tất cả</option>{PARTNER_NOTIFICATION_TYPES.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}
      </select></label></div>
    {actionError && <p role="alert">{actionError}</p>}
    {loading ? <p role="status">Đang tải thông báo...</p>
      : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : items.length === 0 ? <div className="notifications-list-container" style={{ padding: 30 }}>
          <Bell size={25} /><p>{read !== 'all' || type !== 'all' ? 'Không có thông báo phù hợp bộ lọc.' : 'Bạn chưa có thông báo nào.'}</p>
        </div> : <div className="notifications-list-container">
          {items.map(item => <button type="button" key={item.notificationId} disabled={pending}
            onClick={() => void openItem(item)} className={`notification-row-item ${item.read ? '' : 'unread'}`}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 15 }}>
            <span className="notif-icon-circle"><Bell size={18} /></span>
            <span style={{ flex: 1 }}><strong>{item.title}</strong><span style={{ display: 'block' }}>{item.message}</span>
              <small>{LABELS[item.type] || 'Thông báo'} · {new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.createdAt))}</small></span>
            {partnerNotificationTarget(item) && <ExternalLink size={16} />}
          </button>)}
        </div>}
    {!loading && !error && pages > 1 && <CompactPagination page={page} pages={pages} total={total} onPage={setPage} />}
  </div>;
}
