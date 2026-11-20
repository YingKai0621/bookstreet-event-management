import {
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Compass,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Store,
  User,
  X
} from 'lucide-react';
import { PublicSiteLink } from '../../components/ui/PublicSiteLink';
import React, { useCallback, useEffect, useState } from 'react';
import { useNotificationLiveRefresh, useNotificationStream } from '../../hooks/useNotificationLiveUpdates';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RoleSidebar } from '../../components/ui/RoleSidebar';
import { Language, PartnerOrganization } from '../../types';
import { PartnerOrganizationStatusProvider } from './PartnerOrganizationStatusContext';
import { PARTNER_NOTIFICATIONS_CHANGED, notifyPartnerNotificationsChanged,
  partnerNotificationTarget, partnerNotificationsApi, type PartnerNotificationItem } from '../../services/partnerNotificationsApi';
import './PartnerLayout.css';

interface PartnerLayoutProps {
  language: Language;
  organization: PartnerOrganization;
  onLogout: () => void;
  children: React.ReactNode;
}

export const PartnerLayout: React.FC<PartnerLayoutProps> = ({
  language,
  organization,
  onLogout,
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<PartnerNotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notificationPending, setNotificationPending] = useState(false);

  const refreshNotifications = useCallback(async () => {
    setNotificationLoading(true);
    setNotificationError('');
    try {
      const [page, count] = await Promise.all([
        partnerNotificationsApi.list({ size: 4 }), partnerNotificationsApi.unreadCount(),
      ]);
      if (!Array.isArray(page.content) || !Number.isFinite(count.unreadCount)) throw new Error('Invalid notification response');
      setNotifications(page.content);
      setUnreadNotificationsCount(count.unreadCount);
    } catch (error) {
      setNotificationError((error as { status?: number })?.status === 401
        ? 'Phiên đăng nhập đã hết hạn.' : (error as { status?: number })?.status === 403
          ? 'Bạn không có quyền xem thông báo Partner.' : 'Không tải được thông báo.');
    } finally { setNotificationLoading(false); }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshNotifications();
    window.addEventListener(PARTNER_NOTIFICATIONS_CHANGED, refreshNotifications);
    return () => window.removeEventListener(PARTNER_NOTIFICATIONS_CHANGED, refreshNotifications);
  }, [refreshNotifications]);

  useNotificationStream('partner');
  useNotificationLiveRefresh(refreshNotifications);

  async function markAll() {
    if (notificationPending) return;
    setNotificationPending(true); setActionError('');
    try { await partnerNotificationsApi.markAllRead(); notifyPartnerNotificationsChanged(); }
    catch { setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.'); }
    finally { setNotificationPending(false); }
  }

  async function openNotification(item: PartnerNotificationItem) {
    if (notificationPending) return;
    setNotificationPending(true); setActionError('');
    try {
      if (!item.read) await partnerNotificationsApi.markRead(item.notificationId);
      notifyPartnerNotificationsChanged();
      const target = partnerNotificationTarget(item);
      if (target) { setNotifDropdownOpen(false); navigate(target); }
      else setActionError('Nội dung này hiện không mở được từ thông báo.');
    } catch { setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.'); }
    finally { setNotificationPending(false); }
  }

  // Close popups on click outside or Esc
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
        setNotifDropdownOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.partner-notif-menu') && !target.closest('.partner-user-menu')) {
        setNotifDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      path: '/partner',
      exact: true,
      labelVi: 'Tổng quan',
      labelEn: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: 'events',
      path: '/partner/events',
      exact: true,
      labelVi: 'Hồ sơ sự kiện của tôi',
      labelEn: 'My Event Applications',
      icon: <CalendarDays size={18} />,
    },
    {
      id: 'event-discovery',
      path: '/partner/events/apply',
      exact: true,
      labelVi: 'Khám phá & đăng ký',
      labelEn: 'Discover & Apply',
      icon: <Compass size={18} />,
    },
    {
      id: 'booths',
      path: '/partner/booths',
      labelVi: 'Gian hàng của tôi',
      labelEn: 'My Booths',
      icon: <Store size={18} />,
    },
    {
      id: 'booth-requests',
      path: '/partner/booth-requests',
      labelVi: 'Chọn và thuê gian hàng',
      labelEn: 'Choose & Rent Booths',
      icon: <ClipboardList size={18} />,
    },
    {
      id: 'activities',
      path: '/partner/activities',
      labelVi: 'Quản lý hoạt động',
      labelEn: 'Activity Management',
      icon: <Layers size={18} />,
    },
    {
      id: 'notifications',
      path: '/partner/notifications',
      labelVi: 'Thông báo',
      labelEn: 'Notifications',
      icon: <Bell size={18} />,
      badge: unreadNotificationsCount ?? 0,
    },
    {
      id: 'profile',
      path: '/partner/profile',
      labelVi: 'Hồ sơ tài khoản',
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

  const latestNotifications = notifications;

  return (
    <PartnerOrganizationStatusProvider value={organization.status}>
      <div className="partner-app-shell">
      {/* 1. TOP HEADER (Dark Forest Teal bar matching sketch) */}
      <header className="partner-top-bar">
        <div className="top-bar-left">
          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="partner-mobile-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand Logo */}
          <Link to="/partner" className="partner-brand">
            <div className="partner-brand-icon" style={{ padding: '2px', background: '#FFFFFF', borderRadius: '50%', overflow: 'hidden' }}>
              <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            </div>
            <div className="partner-brand-text">
              <span className="brand-main">ĐƯỜNG SÁCH</span>
              <span className="brand-sub">TP.HCM • PARTNER</span>
            </div>
          </Link>
        </div>

        <div className="top-bar-right">
          <PublicSiteLink className="partner-icon-btn" />
          {/* Notifications Bell Dropdown */}
          <div className="partner-notif-menu">
            <button 
              type="button"
              className={`partner-icon-btn ${notifDropdownOpen ? 'is-active' : ''}`}
              title={language === 'vi' ? 'Thông báo mới' : 'Notifications'}
              aria-label="Thông báo"
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen);
                setUserDropdownOpen(false);
                if (!notifDropdownOpen) void refreshNotifications();
              }}
            >
              <Bell size={18} />
              {unreadNotificationsCount !== null && unreadNotificationsCount > 0 && <span className="partner-notif-dot"></span>}
            </button>

            {notifDropdownOpen && (
              <div className="partner-notif-dropdown-popover">
                <div className="notif-dropdown-header">
                  <strong className="notif-header-title-text">{language === 'vi' ? 'Thông báo mới nhất' : 'Recent Notifications'}</strong>
                  <div className="notif-header-center">
                    {unreadNotificationsCount !== null && unreadNotificationsCount > 0 && (
                      <span className="notif-unread-badge">
                        {unreadNotificationsCount} {language === 'vi' ? 'mới' : 'new'}
                      </span>
                    )}
                  </div>
                  <div className="notif-header-right">
                    {unreadNotificationsCount !== null && unreadNotificationsCount > 0 ? (
                      <button 
                        type="button"
                        className="notif-mark-read-btn"
                        onClick={() => void markAll()}
                        disabled={notificationPending}
                      >
                        {language === 'vi' ? 'Đã đọc tất cả' : 'Mark all read'}
                      </button>
                    ) : (
                      <span style={{ width: '60px' }}></span>
                    )}
                  </div>
                </div>

                <div className="notif-dropdown-list">
                  {actionError && <p role="alert">{actionError}</p>}
                  {notificationLoading ? <p role="status">Đang tải thông báo...</p> : notificationError ? <div role="alert"><p>{notificationError}</p><button type="button" onClick={() => void refreshNotifications()}>Thử lại</button></div> : latestNotifications.length === 0 ? (
                    <div className="notif-dropdown-empty">
                      <Bell size={24} style={{ opacity: 0.4, marginBottom: '0.4rem' }} />
                      <p>{language === 'vi' ? 'Không có thông báo nào' : 'No notifications'}</p>
                    </div>
                  ) : (
                    latestNotifications.map((notif) => (
                      <button type="button"
                        key={notif.notificationId}
                        disabled={notificationPending}
                        className={`notif-dropdown-item ${!notif.read ? 'unread' : ''}`}
                        onClick={() => void openNotification(notif)}
                      >
                        <div className="notif-item-indicator">
                          {!notif.read && <span className="notif-blue-dot"></span>}
                        </div>
                        <div className="notif-item-content">
                          <h4 className="notif-item-title">{notif.title}</h4>
                          <span className="notif-item-time">{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(notif.createdAt))}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="notif-dropdown-footer">
                  <Link 
                    to="/partner/notifications" 
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
          <div className="partner-user-menu">
            <button
              type="button"
              className="partner-user-pill"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotifDropdownOpen(false);
              }}
            >
              <div className="partner-avatar-circle">
                {organization.name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ĐT'}
              </div>
              <div className="partner-info-text">
                <span className="partner-name">{organization.name}</span>
                <span className="partner-role">{language === 'vi' ? 'Đối tác / Đơn vị triển lãm' : 'Partner'}</span>
              </div>
              <ChevronDown size={14} className="user-chevron" />
            </button>

            {userDropdownOpen && (
              <div className="partner-dropdown-popover">
                <div className="dropdown-partner-header">
                  <strong>{organization.name}</strong>
                  <small>{organization.email}</small>
                </div>
                <div className="dropdown-divider"></div>
                <Link 
                  to="/partner/profile" 
                  className="dropdown-item"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <User size={15} />
                  <span>{language === 'vi' ? 'Thông tin tổ chức' : 'Organization Info'}</span>
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
      <div className="partner-body-container">
        <RoleSidebar
          ariaLabel="Điều hướng đối tác"
          roleLabel={language === 'vi' ? 'Đối tác' : 'Partner'}
          editionLabel={language === 'vi' ? 'Cổng Đối tác 2026' : 'Partner Portal 2026'}
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
        <main className="partner-main-viewport">
          {organization.status === 'INACTIVE' && (
            <div className="partner-organization-locked-banner" role="status">
              <strong>{language === 'vi' ? 'Tổ chức đang bị khóa' : 'Organization is locked'}</strong>
              <span>
                {language === 'vi'
                  ? 'Bạn vẫn có thể xem dữ liệu, chỉnh sửa hồ sơ và rút yêu cầu đang mở. Các yêu cầu hoặc giao dịch mới đang tạm dừng.'
                  : 'You can still view records, edit your profile, and withdraw open requests. New requests and payments are paused.'}
              </span>
            </div>
          )}
          {children}
        </main>
      </div>
      </div>
    </PartnerOrganizationStatusProvider>
  );
};

