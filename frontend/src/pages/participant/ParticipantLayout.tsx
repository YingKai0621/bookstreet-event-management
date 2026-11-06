import {
  Award,
  Bell,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  User,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNotificationLiveRefresh, useNotificationStream } from '../../hooks/useNotificationLiveUpdates';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RoleSidebar } from '../../components/ui/RoleSidebar';
import { ApiError } from '../../services/apiClient';
import { participantApi, type ParticipantNotificationItem } from '../../services/participantApi';
import { Language, ParticipantProfile } from '../../types';
import './ParticipantLayout.css';
import './ParticipantMobile.css';

interface ParticipantLayoutProps {
  language: Language;
  profile: ParticipantProfile;
  onLogout: () => void;
  children: React.ReactNode;
}

export const ParticipantLayout: React.FC<ParticipantLayoutProps> = ({
  language,
  profile,
  onLogout,
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  useModalDismiss(userDropdownOpen, () => setUserDropdownOpen(false), { lockScroll: false });
  useModalDismiss(notifDropdownOpen, () => setNotifDropdownOpen(false), { lockScroll: false });
  const [notificationClock, setNotificationClock] = useState(0);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<ParticipantNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [notificationActionError, setNotificationActionError] = useState('');
  const [notificationPending, setNotificationPending] = useState(false);
  const vi = language === 'vi';

  const refreshNotifications = useCallback(async () => {
    setNotificationLoading(true);
    setNotificationError('');
    try {
      const [items, count] = await Promise.all([
        participantApi.getNotifications(),
        participantApi.getNotificationUnreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
      setNotificationClock(Date.now());
    } catch (error) {
      setNotificationError(error instanceof ApiError && error.status === 401
        ? (vi ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.')
        : error instanceof ApiError && error.status === 403
          ? (vi ? 'Bạn không có quyền xem thông báo Participant.' : 'You cannot access Participant notifications.')
          : (vi ? 'Không tải được thông báo. Vui lòng thử lại.' : 'Notifications could not be loaded. Please try again.'));
    } finally {
      setNotificationLoading(false);
    }
  }, [vi]);

  const openNotification = async (notification: ParticipantNotificationItem) => {
    if (notificationPending) return;
    setNotificationPending(true);
    setNotificationActionError('');
    try {
      // A successful mutation publishes participant:data-changed, which refreshes this inbox.
      if (!notification.isRead) await participantApi.markNotificationRead(notification.id);
      if (notification.link) {
        setNotifDropdownOpen(false);
        navigate(notification.link);
      } else {
        setNotificationActionError(vi
          ? 'Nội dung được nhắc đến hiện không mở được từ thông báo này.'
          : 'The referenced item cannot currently be opened from this notification.');
      }
    } catch {
      setNotificationActionError(vi
        ? 'Không thể đánh dấu đã đọc. Vui lòng thử lại.'
        : 'The notification could not be marked as read. Please try again.');
    } finally {
      setNotificationPending(false);
    }
  };

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Workspace entry synchronizes the durable Participant inbox.
    void refreshNotifications();
    window.addEventListener('participant:data-changed', refreshNotifications);
    window.addEventListener('participant:notifications-changed', refreshNotifications);
    return () => {
      window.removeEventListener('participant:data-changed', refreshNotifications);
      window.removeEventListener('participant:notifications-changed', refreshNotifications);
    };
  }, [refreshNotifications]);

  useNotificationStream('participant');
  useNotificationLiveRefresh(refreshNotifications);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setNotificationClock(Date.now()), 60_000);
    return () => window.clearInterval(clockInterval);
  }, []);

  const notificationTime = (createdAt: string) => new Intl.RelativeTimeFormat(language === 'vi' ? 'vi' : 'en', { numeric: 'auto' })
    .format(-Math.max(1, Math.round(((notificationClock || new Date(createdAt).getTime()) - new Date(createdAt).getTime()) / 60000)), 'minute');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      path: '/participant',
      exact: true,
      labelVi: 'Tổng quan',
      labelEn: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: 'events',
      path: '/participant/events',
      labelVi: 'Sự kiện của tôi',
      labelEn: 'My Events',
      icon: <CalendarDays size={18} />,
    },
    {
      id: 'rewards',
      path: '/participant/rewards',
      labelVi: 'Điểm & Huy hiệu',
      labelEn: 'Points & Badges',
      icon: <Award size={18} />,
    },
    {
      id: 'certificates',
      path: '/participant/certificates',
      labelVi: 'Chứng nhận',
      labelEn: 'Certificates',
      icon: <FileText size={18} />,
    },
    {
      id: 'feedback',
      path: '/participant/feedback',
      labelVi: 'Đánh giá hoạt động',
      labelEn: 'Activity Ratings',
      icon: <MessageSquare size={18} />,
    },
    {
      id: 'notifications',
      path: '/participant/notifications',
      labelVi: 'Thông báo',
      labelEn: 'Notifications',
      icon: <Bell size={18} />,
      badge: unreadCount ?? 0,
    },
    {
      id: 'profile',
      path: '/participant/profile',
      labelVi: 'Hồ sơ cá nhân',
      labelEn: 'Profile',
      icon: <User size={18} />,
    },
  ];

  const isNavActive = (itemPath: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === itemPath || location.pathname === itemPath + '/';
    }
    return location.pathname.startsWith(itemPath);
  };

  return (
    <div className="participant-app-shell">
      {/* 1. TOP HEADER (Dark Forest Teal bar matching sketch) */}
      <header className="participant-top-bar">
        <div className="top-bar-left">
          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="participant-mobile-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand Logo */}
          <Link to="/participant" className="participant-brand">
            <div className="participant-brand-icon" style={{ padding: '2px', background: '#FFFFFF', borderRadius: '50%', overflow: 'hidden' }}>
              <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            </div>
            <div className="participant-brand-text">
              <span className="brand-main">ĐƯỜNG SÁCH</span>
              <span className="brand-sub">TP.HCM</span>
            </div>
          </Link>

          {/* Public Quick Nav Links from Sketch: Home, Events, Booths, Map, Heritage */}
          <nav className="participant-quick-nav">
            <Link to="/" className="quick-nav-link">
              {language === 'vi' ? 'Trang chủ' : 'Home'}
            </Link>
            <Link to="/#su-kien" className="quick-nav-link">
              {language === 'vi' ? 'Sự kiện' : 'Events'}
            </Link>
            <Link to="/#gian-hang" className="quick-nav-link">
              {language === 'vi' ? 'Gian hàng' : 'Booths'}
            </Link>
            <Link to="/#ban-do" className="quick-nav-link">
              {language === 'vi' ? 'Bản đồ' : 'Map'}
            </Link>
            <Link to="/di-san" className="quick-nav-link">
              {language === 'vi' ? 'Di sản' : 'Heritage'}
            </Link>
          </nav>
        </div>

        <div className="top-bar-right">
          {/* Notifications Bell Dropdown */}
          <div className="participant-notif-menu" ref={notifDropdownRef}>
            <button 
              type="button" 
              className={`participant-icon-btn ${notifDropdownOpen ? 'is-active' : ''}`}
              title={language === 'vi' ? 'Thông báo mới' : 'Notifications'}
              aria-label="Thông báo"
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen);
                setUserDropdownOpen(false);
                if (!notifDropdownOpen) {
                  setNotificationActionError('');
                  void refreshNotifications();
                }
              }}
            >
              <Bell size={18} />
              {unreadCount !== null && unreadCount > 0 && <span className="notif-badge-dot"></span>}
            </button>

            {notifDropdownOpen && (
              <div className="participant-notif-dropdown-popover" role="dialog" aria-label="Thông báo gần đây">
                <div className="notif-dropdown-header">
                  <strong className="notif-header-title-text">
                    {language === 'vi' ? 'Thông báo' : 'Notifications'}
                  </strong>
                  <div className="notif-header-center">
                    {unreadCount !== null && unreadCount > 0 && (
                      <span className="notif-unread-badge">
                        {unreadCount} {language === 'vi' ? 'thông báo mới' : 'new'}
                      </span>
                    )}
                  </div>
                  <div className="notif-header-right" aria-hidden="true" />
                </div>

                <div className="notif-dropdown-list">
                  {notificationActionError && (
                    <div className="notif-dropdown-empty" role="alert">
                      <p>{notificationActionError}</p>
                    </div>
                  )}
                  {notificationLoading ? (
                    <div className="notif-dropdown-empty" role="status">
                      <p>{vi ? 'Đang tải thông báo...' : 'Loading notifications...'}</p>
                    </div>
                  ) : notificationError ? (
                    <div className="notif-dropdown-empty" role="alert">
                      <p>{notificationError}</p>
                      <button
                        type="button"
                        className="notif-view-all-link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => void refreshNotifications()}
                      >
                        {vi ? 'Thử lại' : 'Retry'}
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="notif-dropdown-empty">
                      <Bell size={24} style={{ opacity: 0.35, marginBottom: '0.4rem' }} />
                      <p>{language === 'vi' ? 'Không có thông báo nào' : 'No notifications'}</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        className={`notif-dropdown-item ${!notif.isRead ? 'unread' : ''}`}
                        onClick={() => void openNotification(notif)}
                      >
                        <div className="notif-item-indicator">
                          {!notif.isRead && <span className="notif-indicator-dot"></span>}
                        </div>
                        <div className="notif-item-content">
                          <h4 className="notif-item-title">
                            {notif.title}
                          </h4>
                          <p className="notif-item-desc">
                            {notif.message}
                          </p>
                          <span className="notif-item-time">
                            {notificationTime(notif.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="notif-dropdown-footer">
                  <Link 
                    to="/participant/notifications"
                    className="notif-view-all-link"
                    onClick={() => setNotifDropdownOpen(false)}
                  >
                    {language === 'vi' ? 'Xem tất cả thông báo →' : 'View all notifications →'}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Capsule Dropdown */}
          <div className="participant-user-menu" ref={userDropdownRef}>
            <button
              type="button"
              className="participant-user-pill"
              aria-label={language === 'vi' ? 'Tài khoản của bạn' : 'Your account'}
              aria-expanded={userDropdownOpen}
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotifDropdownOpen(false);
              }}
            >
              <div className="user-avatar-circle" style={{ overflow: 'hidden' }}>
                {profile.avatar ? (
                  <img 
                    src={profile.avatar} 
                    alt={profile.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                  />
                ) : (
                  profile.name ? profile.name.slice(0, 2).toUpperCase() : 'NA'
                )}
              </div>
              <div className="user-info-text">
                <span className="user-name">{profile.name}</span>
                <span className="user-role">{language === 'vi' ? 'Độc giả' : (profile.role || 'Participant')}</span>
              </div>
              <ChevronDown size={14} className="user-chevron" />
            </button>

            {userDropdownOpen && (
              <div className="user-dropdown-popover">
                <div className="dropdown-user-header">
                  <strong>{profile.name}</strong>
                  <small>{profile.email}</small>
                </div>
                <div className="dropdown-divider"></div>
                <Link 
                  to="/participant/profile" 
                  className="dropdown-item"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <User size={15} />
                  <span>{language === 'vi' ? 'Hồ sơ cá nhân' : 'My Profile'}</span>
                </Link>
                <div className="dropdown-divider"></div>
                <button
                  type="button"
                  className="dropdown-item logout"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={15} />
                  <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT: LEFT SIDEBAR + MAIN CONTENT AREA */}
      <div className="participant-body-container">
        <RoleSidebar
          ariaLabel="Điều hướng độc giả"
          roleLabel={language === 'vi' ? 'Độc giả' : 'Participant'}
          editionLabel={language === 'vi' ? 'Cổng Độc giả 2026' : 'Participant Portal 2026'}
          items={navItems.map(item => ({ id: item.id, icon: item.icon, label: language === 'vi' ? item.labelVi : item.labelEn, badge: item.badge }))}
          activeId={navItems.find(item => isNavActive(item.path, item.exact))?.id || 'dashboard'}
          isOpenMobile={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          onSelect={id => {
            const item = navItems.find(navItem => navItem.id === id);
            if (item) navigate(item.path);
          }}
        />

        {/* Main Routed Page Content */}
        <main className="participant-main-viewport">
          {children}
        </main>
      </div>
    </div>
  );
};

