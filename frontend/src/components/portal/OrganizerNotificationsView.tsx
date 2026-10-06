import React, { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Store, 
  Layers, 
  Users, 
  MessageSquare, 
  ChevronRight
} from 'lucide-react';
import { Language } from '../../types';
import { OrganizerNotificationItem, OrganizerTab } from '../../types/organizer';

interface OrganizerNotificationsViewProps {
  language: Language;
  notifications: OrganizerNotificationItem[];
  onMarkAllRead: () => void;
  onNavigateTab: (tab: OrganizerTab) => void;
}

export const OrganizerNotificationsView: React.FC<OrganizerNotificationsViewProps> = ({
  language,
  notifications,
  onMarkAllRead,
  onNavigateTab
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'important'>('all');

  const filteredNotifs = notifications.filter(n => {
    if (activeFilter === 'unread') return !n.isRead;
    if (activeFilter === 'important') return n.isImportant;
    return true;
  });

  const getCategoryIcon = (category: OrganizerNotificationItem['category']) => {
    switch (category) {
      case 'booth':
        return <Store size={16} color="#B48A3C" />;
      case 'activity':
        return <Layers size={16} color="#059669" />;
      case 'participant':
        return <Users size={16} color="#0284C7" />;
      case 'feedback':
        return <MessageSquare size={16} color="#E9BC63" />;
      default:
        return <Bell size={16} color="#17382E" />;
    }
  };

  return (
    <div className="organizer-content">
      {/* 1. Header matching Sketch Screen 9 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 className="organizer-view-title">
            {language === 'vi' ? 'Thông báo' : 'Notifications'}
          </h1>
          <p className="organizer-view-sub">
            {language === 'vi' ? 'Cập nhật kịp thời về đơn đăng ký, đề xuất hoạt động và phản hồi độc giả' : 'Operational alerts and participant updates'}
          </p>
        </div>

        <button
          type="button"
          className="btn-org-secondary"
          onClick={onMarkAllRead}
        >
          <CheckCheck size={16} />
          <span>{language === 'vi' ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read'}</span>
        </button>
      </div>

      {/* 2. Filter Tabs matching Sketch Screen 9 */}
      <div className="org-tabs-bar">
        <button
          type="button"
          className={`org-tab-btn ${activeFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          {language === 'vi' ? `Tất cả (${notifications.length})` : `All (${notifications.length})`}
        </button>
        <button
          type="button"
          className={`org-tab-btn ${activeFilter === 'unread' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('unread')}
        >
          {language === 'vi' ? `Chưa đọc (${notifications.filter(n => !n.isRead).length})` : 'Unread'}
        </button>
        <button
          type="button"
          className={`org-tab-btn ${activeFilter === 'important' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('important')}
        >
          {language === 'vi' ? `Quan trọng (1)` : 'Important'}
        </button>
      </div>

      {/* 3. Notification Rows List matching Sketch Screen 9 */}
      <div className="organizer-card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredNotifs.map((item) => (
          <div
            key={item.id}
            onClick={() => item.targetTab && onNavigateTab(item.targetTab as OrganizerTab)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #EEF2F0',
              background: item.isRead ? '#FFFFFF' : '#FAFCFA',
              cursor: item.targetTab ? 'pointer' : 'default',
              transition: 'background 120ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F4F7F5')}
            onMouseLeave={(e) => (e.currentTarget.style.background = item.isRead ? '#FFFFFF' : '#FAFCFA')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#F1F5F3',
                display: 'grid',
                placeItems: 'center'
              }}>
                {getCategoryIcon(item.category)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#172421' }}>{item.title}</strong>
                  {!item.isRead && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C84C32' }}></span>
                  )}
                  {item.isImportant && (
                    <span style={{ fontSize: '0.68rem', background: '#FEECEB', color: '#C84C32', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>
                      Quan trọng
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#556B65' }}>
                  {item.content}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#8E9F97', fontSize: '0.78rem' }}>
              <span>{item.timeAgo}</span>
              {item.targetTab && <ChevronRight size={15} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

