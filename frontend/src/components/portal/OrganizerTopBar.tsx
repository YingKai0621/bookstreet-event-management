import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  Menu, 
  ChevronDown, 
  User, 
  LogOut, 
  BookOpen,
  CheckCheck,
  Store,
  Calendar,
  Users,
  MessageSquare,
  Settings,
  ChevronRight
} from 'lucide-react';
import { Language } from '../../types';
import { OrganizerProfile, OrganizerNotificationItem, OrganizerTab } from '../../types/organizer';

interface OrganizerTopBarProps {
  language: Language;
  profile: OrganizerProfile;
  unreadCount: number;
  notifications?: OrganizerNotificationItem[];
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
  onOpenMobileMenu: () => void;
  onNavigateTab?: (tab: OrganizerTab) => void;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
}

export const OrganizerTopBar: React.FC<OrganizerTopBarProps> = ({
  language,
  profile,
  unreadCount,
  notifications = [],
  onOpenNotifications,
  onOpenProfile,
  onLogout,
  onOpenMobileMenu,
  onNavigateTab,
  onMarkNotificationRead,
  onMarkAllNotificationsRead
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifPopupOpen, setNotifPopupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const getCategoryIcon = (category: OrganizerNotificationItem['category']) => {
    switch (category) {
      case 'booth': return <Store size={15} />;
      case 'activity': return <Calendar size={15} />;
      case 'participant': return <Users size={15} />;
      case 'feedback': return <MessageSquare size={15} />;
      case 'system': return <Settings size={15} />;
      default: return <Bell size={15} />;
    }
  };

  const recentList = notifications.slice(0, 5);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

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

      {/* 2. Right: Quick Search, Bell, User Capsule with comfortable spacing */}
      <div className="organizer-topbar-right">
        {/* Global Quick Search Bar */}
        <form className="organizer-top-search" onSubmit={handleSearchSubmit}>
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder={language === 'vi' ? 'Tìm kiếm sự kiện, gian hàng, hoạt động...' : 'Search events, booths, activities...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        {/* Notifications Bell & Dropdown Popup */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="organizer-icon-button"
            onClick={() => setNotifPopupOpen(!notifPopupOpen)}
            aria-label="Xem thông báo"
            title={language === 'vi' ? 'Thông báo gần đây' : 'Recent notifications'}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="organizer-badge-dot"></span>}
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
                  {unreadCount > 0 && (
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

                {unreadCount > 0 && onMarkAllNotificationsRead && (
                  <button
                    type="button"
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
                {recentList.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#6B7280', fontSize: '0.84rem' }}>
                    {language === 'vi' ? 'Không có thông báo nào.' : 'No notifications.'}
                  </div>
                ) : (
                  recentList.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (onMarkNotificationRead) onMarkNotificationRead(notif.id);
                        if (notif.targetTab && onNavigateTab) {
                          onNavigateTab(notif.targetTab as OrganizerTab);
                        } else {
                          onOpenNotifications();
                        }
                        setNotifPopupOpen(false);
                      }}
                      style={{
                        padding: '0.8rem 1rem',
                        borderBottom: '1px solid #F0F4F2',
                        background: notif.isRead ? '#FFFFFF' : '#F4F9F6',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6F2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = notif.isRead ? '#FFFFFF' : '#F4F9F6'; }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: notif.isRead ? '#F3F4F6' : '#DCFCE7',
                        color: notif.isRead ? '#6B7280' : '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {getCategoryIcon(notif.category)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', marginBottom: '2px' }}>
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: notif.isRead ? 600 : 750,
                            color: '#172421',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {notif.title}
                          </span>
                          {!notif.isRead && (
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
                          {notif.content}
                        </p>
                        <span style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '3px', display: 'inline-block' }}>
                          {notif.timeAgo}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

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
