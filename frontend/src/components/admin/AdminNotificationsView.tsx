import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import {
  ADMIN_NOTIFICATIONS_CHANGED,
  adminNotificationsApi,
  notifyAdminNotificationsChanged,
} from '../../services/adminNotificationsApi';
import type { Language } from '../../types';

function loadErrorMessage(error: unknown, language: Language): string {
  const vi = language === 'vi';
  if (error instanceof ApiError && error.status === 401) {
    return vi
      ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : 'Your session has expired. Please sign in again.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return vi
      ? 'Bạn không có quyền xem thông báo Admin.'
      : 'You cannot access Admin notifications.';
  }
  return vi
    ? 'Không tải được thông báo. Vui lòng thử lại.'
    : 'Notifications could not be loaded. Please try again.';
}

export function AdminNotificationsView({ language }: { language: Language }) {
  const vi = language === 'vi';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect -- Route entry and explicit refresh synchronize the durable Admin inbox.
    setLoading(true);
    setLoadError('');
    Promise.all([
      adminNotificationsApi.list({ page: 0, size: 20 }),
      adminNotificationsApi.unreadCount(),
    ]).then(([page, count]) => {
      if (!active) return;
      if (!Array.isArray(page.content)
          || !Number.isFinite(page.totalElements)
          || !Number.isFinite(count.unreadCount)
          || page.content.length !== 0
          || page.totalElements !== 0
          || count.unreadCount !== 0) {
        throw new Error('Invalid Admin notification response');
      }
      setUnreadCount(count.unreadCount);
    }).catch(error => {
      if (active) {
        setUnreadCount(null);
        setLoadError(loadErrorMessage(error, language));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [language, revision]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED, refresh);
  }, []);

  async function markAllRead() {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      await adminNotificationsApi.markAllRead();
      notifyAdminNotificationsChanged();
    } catch {
      setActionError(vi
        ? 'Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.'
        : 'Notifications could not be marked as read. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return <div className="adm-notifications-view">
    <div className="adm-page-header">
      <div>
        <h1 className="adm-page-title workspace-page-title">
          {vi ? 'Thông báo quản trị' : 'Admin notifications'}
        </h1>
        <p className="adm-page-subtitle workspace-page-subtitle">
          {vi
            ? 'Thông báo dành riêng cho vai trò Admin sẽ xuất hiện tại đây.'
            : 'Notifications intended for the Admin role will appear here.'}
        </p>
      </div>
      <div className="adm-page-header-actions">
        <button type="button" className="adm-btn adm-btn-secondary" disabled={loading}
          onClick={() => setRevision(value => value + 1)}>
          <RefreshCw size={16} />
          <span>{vi ? 'Tải lại' : 'Refresh'}</span>
        </button>
        <button type="button" className="adm-btn adm-btn-secondary"
          disabled={loading || pending || unreadCount === null || unreadCount === 0}
          onClick={() => void markAllRead()}>
          <CheckCheck size={16} />
          <span>{vi ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read'}</span>
        </button>
      </div>
    </div>

    {actionError && <p className="app-loading-state" role="alert">{actionError}</p>}
    {loading ? <p className="app-loading-state" role="status">
      {vi ? 'Đang tải thông báo...' : 'Loading notifications...'}
    </p> : loadError ? <div className="adm-card adm-notif-list-card" role="alert">
      <div className="adm-notif-empty">
        <Bell size={36} />
        <p>{loadError}</p>
        <button type="button" className="adm-btn adm-btn-secondary"
          onClick={() => setRevision(value => value + 1)}>
          {vi ? 'Thử lại' : 'Retry'}
        </button>
      </div>
    </div> : <div className="adm-card adm-notif-list-card">
      <div className="adm-notif-empty">
        <Bell size={36} />
        <p>{vi
          ? 'Hiện chưa có thông báo nào dành cho Admin.'
          : 'There are currently no notifications for Admin.'}</p>
      </div>
    </div>}
  </div>;
}
