import {
  Bell,
  Calendar,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Store,
  User,
  Users
} from 'lucide-react';
import { PublicSiteLink } from '../ui/PublicSiteLink';
import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../../types';
import { OrganizerProfile } from '../../types/organizer';
import type { OrganizerNotificationItem } from '../../services/organizerNotificationsApi';

interface OrganizerTopBarProps {
  language: Language;
  profile: OrganizerProfile;
  unreadCount: number | null;
  notifications?: OrganizerNotificationItem[];
  notificationLoading: boolean;
  notificationError: string;
  notificationActionError: string;
  notificationPending: boolean;
  onOpenNotifications: () => void;
  onNotificationPopoverOpen: () => void;
  onOpenNotification: (item: OrganizerNotificationItem) => Promise<boolean>;
  onOpenProfile: () => void;
  onLogout?: () => void;
  onOpenMobileMenu: () => void;
  onMarkAllNotificationsRead: () => void;
}

export const OrganizerTopBar: React.FC<OrganizerTopBarProps> = ({
  language,
  profile,
  unreadCount,
  notifications = [],
  notificationLoading,
  notificationError,
  notificationActionError,
  notificationPending,
  onOpenNotifications,
  onNotificationPopoverOpen,
  onOpenNotification,
  onOpenProfile,
  onLogout,
  onOpenMobileMenu,
  onMarkAllNotificationsRead
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifPopupOpen, setNotifPopupOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = (notification: OrganizerNotificationItem) => {
    if (notification.type === 'ORGANIZER_NEW_PARTNER_APPLICATION') return <Users size={15} />;
    if (notification.type === 'ORGANIZER_NEW_BOOTH_REQUEST'
        || notification.type === 'ORGANIZER_BOOTH_RESELECTION_REQUIRED'
        || notification.type === 'ORGANIZER_BOOTH_PAYMENT_CONFIRMED') return <Store size={15} />;
    return <Calendar size={15} />;
  };

  const formatCreatedAt = (createdAt: string) => new Intl.DateTimeFormat(
    language === 'vi' ? 'vi-VN' : 'en-GB',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' },
  ).format(new Date(createdAt));

  const recentList = notifications.slice(0, 5);

  return (
    <header className="organizer-topbar">
      {/* 1. Left: Brand Logo & Mobile Toggle (Spacious & matching partner portal) */}
      <div className="organizer-topbar-left">
        <button
          type="button"
          className="organizer-mobile-menu-btn"
          onClick={onOpenMobileMenu}
          id="organizer-mobile-menu-trigger"
          aria-label="Mở menu điều hướng"
        >
          <Menu size={20} />
        </button>

        <div className="organizer-brand">
          <div className="organizer-brand-icon" style={{ padding: '2px', background: '#FFFFFF', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          <div className="organizer-brand-text">
            <span className="brand-main">ĐƯỜNG SÁCH</span>
            <span className="brand-sub">TP.HCM • ORGANIZER</span>
          </div>
        </div>
      </div>

      {/* 2. Right: Bell and user capsule */}
      <div className="organizer-topbar-right">
        <PublicSiteLink className="organizer-icon-button" />
        {/* Notifications Bell & Dropdown Popup */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="organizer-icon-button"
            onClick={() => {
              const opening = !notifPopupOpen;
              setNotifPopupOpen(opening);
              if (opening) onNotificationPopoverOpen();
            }}
            aria-label={unreadCount !== null && unreadCount > 0
              ? `Xem thông báo (${unreadCount} chưa đọc)` : 'Xem thông báo'}
            title={language === 'vi' ? 'Thông báo gần đây' : 'Recent notifications'}
          >
            <Bell size={18} />
            {unreadCount !== null && unreadCount > 0 && <span className="organizer-badge-dot"></span>}
          </button>

          {notifPopupOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              width: '360px',
              maxWidth: 'calc(100vw - 24px)',
              background: '#FFFFFF',
              border: '1px solid #E2EAE5',
              borderRadius: '14px',
              boxShadow: '0 16px 45px rgba(0, 0, 0, 0.22)',
              overflow: 'hidden',
              zIndex: 300,
              animation: 'orgModalIn 0.15s ease-out'
            }}>
              {/* Header */}
              <div style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid #EEF2F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FAFCFB'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={16} color="#17382E" />
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#172421' }}>
                    {language === 'vi' ? 'Thông báo gần đây' : 'Recent Notifications'}
                  </span>
                  {unreadCount !== null && unreadCount > 0 && (
                    <span style={{
                      background: '#FEE2E2',
                      color: '#991B1B',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}>
                      {unreadCount} {language === 'vi' ? 'mới' : 'new'}
                    </span>
                  )}
                </div>

                {unreadCount !== null && unreadCount > 0 && (
                  <button
                    type="button"
                    disabled={notificationPending}
                    onClick={() => {
                      onMarkAllNotificationsRead();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#059669',
                      fontSize: '0.74rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <CheckCheck size={13} />
                    <span>{language === 'vi' ? 'Đã đọc tất cả' : 'Mark all read'}</span>
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notificationLoading ? (
                  <div role="status" style={{ padding: '2rem 1rem', textAlign: 'center', color: '#6B7280', fontSize: '0.84rem' }}>
                    {language === 'vi' ? 'Đang tải thông báo...' : 'Loading notifications...'}
                  </div>
                ) : notificationError ? (
                  <div role="alert" style={{ padding: '1.25rem 1rem', textAlign: 'center', color: '#991B1B', fontSize: '0.84rem' }}>
                    <p>{notificationError}</p>
                    <button type="button" onClick={onNotificationPopoverOpen}>
                      {language === 'vi' ? 'Thử lại' : 'Retry'}
                    </button>
                  </div>
                ) : recentList.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#6B7280', fontSize: '0.84rem' }}>
                    {language === 'vi' ? 'Không có thông báo nào.' : 'No notifications.'}
                  </div>
                ) : (
                  recentList.map(notif => (
                    <div
                      key={notif.notificationId}
                      onClick={() => {
                        void onOpenNotification(notif).then(navigated => {
                          if (navigated) setNotifPopupOpen(false);
                        });
                      }}
                      style={{
                        padding: '0.8rem 1rem',
                        borderBottom: '1px solid #F0F4F2',
                        background: notif.read ? '#FFFFFF' : '#F4F9F6',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6F2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = notif.read ? '#FFFFFF' : '#F4F9F6'; }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: notif.read ? '#F3F4F6' : '#DCFCE7',
                        color: notif.read ? '#6B7280' : '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {getNotificationIcon(notif)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', marginBottom: '2px' }}>
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: notif.read ? 600 : 750,
                            color: '#172421',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {notif.title}
                          </span>
                          {!notif.read && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                          )}
                        </div>
                        <p style={{
                          margin: 0,
                          fontSize: '0.76rem',
                          color: '#4B5563',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {notif.message}
                        </p>
                        <span style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '3px', display: 'inline-block' }}>
                          {formatCreatedAt(notif.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notificationActionError && <div role="alert" style={{ padding: '0.55rem 1rem', color: '#991B1B', fontSize: '0.76rem' }}>
                {notificationActionError}
              </div>}

              {/* Footer: View All */}
              <div style={{
                padding: '0.65rem 1rem',
                borderTop: '1px solid #EEF2F0',
                background: '#FAFCFB',
                textAlign: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenNotifications();
                    setNotifPopupOpen(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#17382E',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>{language === 'vi' ? 'Xem tất cả thông báo' : 'View all notifications'}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Capsule Pill */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div 
            className="organizer-user-capsule"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            role="button"
            tabIndex={0}
          >
            <div className="organizer-avatar-circle">
              {profile.avatarInitials}
            </div>
            <div className="organizer-user-info">
              <span className="organizer-user-name">{profile.name}</span>
              <span className="organizer-user-role">Organizer</span>
            </div>
            <ChevronDown size={14} color="rgba(255, 255, 255, 0.5)" style={{ marginLeft: '0.2rem' }} />
          </div>

          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '240px',
              background: '#FFFFFF',
              border: '1px solid #E2EAE5',
              borderRadius: '12px',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25)',
              padding: '0.65rem',
              zIndex: 200,
              animation: 'orgModalIn 0.15s ease-out'
            }}>
              <div style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid #EEF2F0', marginBottom: '0.35rem' }}>
                <strong style={{ display: 'block', fontSize: '0.86rem', color: '#172421' }}>{profile.name}</strong>
                <span style={{ fontSize: '0.74rem', color: '#6C7D78' }}>{profile.email}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenProfile();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'none',
                  border: 'none',
                  color: '#243833',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: '7px',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F4F7F5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <User size={15} color="#556B65" />
                <span>{language === 'vi' ? 'Hồ sơ tài khoản' : 'Profile Settings'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: '7px',
                  textAlign: 'left',
                  marginTop: '0.25rem'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEECEB')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={15} />
                <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
