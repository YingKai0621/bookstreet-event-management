import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  MapPin, 
  Eye, 
  EyeOff,
  Edit3, 
  MoreVertical
} from 'lucide-react';
import { Language } from '../../types';
import { OrganizerEvent } from '../../types/organizer';

interface EventManagementViewProps {
  language: Language;
  events: OrganizerEvent[];
  onSelectEvent: (eventId: string) => void;
  onOpenCreateEvent: () => void;
  onEditEvent?: (event: OrganizerEvent) => void;
  onTogglePublishEvent?: (eventId: string) => void;
  onBroadcastEvent?: (eventId: string) => void | Promise<void>;
  onDuplicateEvent?: (eventId: string) => void | Promise<void>;
  onCancelEvent?: (eventId: string) => void | Promise<void>;
}

export const EventManagementView: React.FC<EventManagementViewProps> = ({
  language,
  events,
  onSelectEvent,
  onOpenCreateEvent,
  onEditEvent,
  onTogglePublishEvent,
  onBroadcastEvent,
  onDuplicateEvent,
  onCancelEvent
}) => {
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'happening' | 'upcoming' | 'completed' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredEvents = events.filter(e => {
    if (activeStatusFilter !== 'all' && e.status !== activeStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusChipClass = (status: OrganizerEvent['status']) => {
    switch (status) {
      case 'happening': return 'org-chip happening';
      case 'upcoming': return 'org-chip upcoming';
      case 'draft': return 'org-chip draft';
      case 'completed': return 'org-chip unavailable';
      default: return 'org-chip';
    }
  };

  return (
    <div className="organizer-content">
      {/* 1. Header with title and Create Event button matching Sketch Screen 2 */}
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
            {language === 'vi' ? 'Danh sách sự kiện' : 'Event Management'}
          </h1>
          <p className="organizer-view-sub">
            {language === 'vi' ? 'Quản lý vòng đời, lịch trình và thiết lập cấu hình sự kiện' : 'Manage lifecycle, schedules, and event configurations'}
          </p>
        </div>

        <button
          type="button"
          className="btn-org-primary"
          onClick={onOpenCreateEvent}
        >
          <Plus size={16} />
          <span>{language === 'vi' ? 'Tạo sự kiện mới' : 'Create New Event'}</span>
        </button>
      </div>

      {/* 2. Filter tabs & Search toolbar matching Sketch Screen 2 */}
      <div className="org-toolbar">
        <div className="org-tabs-bar" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button
            type="button"
            className={`org-tab-btn ${activeStatusFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveStatusFilter('all')}
          >
            {language === 'vi' ? `Tất cả (${events.length})` : `All (${events.length})`}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeStatusFilter === 'upcoming' ? 'is-active' : ''}`}
            onClick={() => setActiveStatusFilter('upcoming')}
          >
            {language === 'vi' ? 'Đang chuẩn bị' : 'Upcoming'}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeStatusFilter === 'happening' ? 'is-active' : ''}`}
            onClick={() => setActiveStatusFilter('happening')}
          >
            {language === 'vi' ? 'Đang diễn ra' : 'Happening'}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeStatusFilter === 'completed' ? 'is-active' : ''}`}
            onClick={() => setActiveStatusFilter('completed')}
          >
            {language === 'vi' ? 'Đã kết thúc' : 'Completed'}
          </button>
        </div>

        <div className="organizer-search-box" style={{ maxWidth: '300px' }}>
          <Search size={15} />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm tên sự kiện...' : 'Search event name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Event Cards matching Sketch Screen 2 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {filteredEvents.map((evt) => {
          const isPub = evt.isPublished ?? (evt.status !== 'draft');
          return (
            <div 
              key={evt.id}
              className="organizer-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
                padding: '1.25rem',
                borderLeft: isPub ? '4px solid #16A34A' : '4px solid #9CA3AF'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '320px' }}>
                <img
                  src={evt.imageUrl}
                  alt={evt.title}
                  style={{
                    width: '100px',
                    height: '75px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '1px solid #DCE5E0'
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                      {evt.title}
                    </h3>
                    <span className={getStatusChipClass(evt.status)}>
                      ● {evt.statusLabelVi}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: '#556B65' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={13} color="#17382E" />
                      <span>{evt.dateRange}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={13} color="#17382E" />
                      <span>{evt.location}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions matching Sketch Screen 2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                {/* Công bố / Ẩn toggle button */}
                <button
                  type="button"
                  onClick={() => onTogglePublishEvent && onTogglePublishEvent(evt.id)}
                  title={isPub 
                    ? (language === 'vi' ? 'Nhấn để ẩn sự kiện này khỏi Landing Page' : 'Click to hide this event from landing page') 
                    : (language === 'vi' ? 'Nhấn để công bố sự kiện này lên Landing Page' : 'Click to publish this event to landing page')
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 650,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: isPub ? '#F0FDF4' : '#F9FAFB',
                    border: isPub ? '1.5px solid #16A34A' : '1.5px solid #9CA3AF',
                    color: isPub ? '#15803D' : '#4B5563'
                  }}
                >
                  {isPub ? <Eye size={14} color="#15803D" /> : <EyeOff size={14} color="#4B5563" />}
                  <span>
                    {isPub 
                      ? (language === 'vi' ? 'Đã công bố' : 'Published') 
                      : (language === 'vi' ? 'Đang ẩn' : 'Hidden')
                    }
                  </span>
                </button>

                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={() => onSelectEvent(evt.id)}
                >
                  <Eye size={14} />
                  <span>{language === 'vi' ? 'Xem' : 'View'}</span>
                </button>

                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={() => onEditEvent ? onEditEvent(evt) : onSelectEvent(evt.id)}
                >
                  <Edit3 size={14} />
                  <span>{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</span>
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="organizer-icon-button"
                    style={{ width: '34px', height: '34px' }}
                    onClick={() => setActiveMenuId(activeMenuId === evt.id ? null : evt.id)}
                    aria-label="Thao tác khác"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeMenuId === evt.id && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      width: '180px',
                      background: '#FFFFFF',
                      border: '1px solid #E2EAE5',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      padding: '0.35rem',
                      zIndex: 100
                    }}>
                      <button
                        type="button"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px' }}
                        onClick={() => {
                          if (onTogglePublishEvent) onTogglePublishEvent(evt.id);
                          setActiveMenuId(null);
                        }}
                      >
                        {isPub 
                          ? (language === 'vi' ? 'Ẩn khỏi Landing Page' : 'Hide from Landing') 
                          : (language === 'vi' ? 'Công bố lên Landing Page' : 'Publish to Landing')
                        }
                      </button>
                      <button
                        type="button"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px' }}
                        onClick={() => {
                          void onBroadcastEvent?.(evt.id);
                          setActiveMenuId(null);
                        }}
                      >
                        {language === 'vi' ? 'Gửi thông báo' : 'Broadcast'}
                      </button>
                      <button
                        type="button"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px' }}
                        onClick={() => {
                          void onDuplicateEvent?.(evt.id);
                          setActiveMenuId(null);
                        }}
                      >
                        {language === 'vi' ? 'Nhân bản sự kiện' : 'Duplicate'}
                      </button>
                      <button
                        type="button"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px', color: '#C84C32' }}
                        onClick={() => {
                          if (confirm(language === 'vi' ? 'Bạn có chắc chắn muốn hủy sự kiện này?' : 'Are you sure you want to cancel this event?')) {
                            void onCancelEvent?.(evt.id);
                          }
                          setActiveMenuId(null);
                        }}
                      >
                        {language === 'vi' ? 'Hủy sự kiện' : 'Cancel Event'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


