import { Calendar, Edit3, Eye, Plus, Search, Send } from 'lucide-react';
import React, { useState } from 'react';
import { Language } from '../../types';
import { OrganizerEvent } from '../../types/organizer';

interface EventManagementViewProps {
  language: Language;
  events: OrganizerEvent[];
  actionError?: string;
  onSelectEvent: (eventId: string) => void;
  onOpenCreateEvent: () => void;
  onEditEvent: (event: OrganizerEvent) => void;
  onPublishEvent: (eventId: string) => void | Promise<void>;
}

type StatusFilter = 'all' | OrganizerEvent['status'];

export const EventManagementView: React.FC<EventManagementViewProps> = ({
  language,
  events,
  actionError,
  onSelectEvent,
  onOpenCreateEvent,
  onEditEvent,
  onPublishEvent,
}) => {
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = events.filter(event => {
    if (activeStatusFilter !== 'all' && event.status !== activeStatusFilter) return false;
    return event.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: language === 'vi' ? `Tất cả (${events.length})` : `All (${events.length})` },
    { value: 'draft', label: language === 'vi' ? 'Bản nháp' : 'Draft' },
    { value: 'upcoming', label: language === 'vi' ? 'Đã công bố' : 'Published' },
    { value: 'happening', label: language === 'vi' ? 'Đang diễn ra' : 'Ongoing' },
    { value: 'completed', label: language === 'vi' ? 'Đã kết thúc' : 'Completed' },
    { value: 'cancelled', label: language === 'vi' ? 'Đã hủy' : 'Cancelled' },
  ];

  return (
    <div className="organizer-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="organizer-view-title">{language === 'vi' ? 'Danh sách sự kiện' : 'Event Management'}</h1>
          <p className="organizer-view-sub">{language === 'vi' ? 'Tạo bản nháp, cập nhật thông tin và công bố sự kiện' : 'Create drafts, update details, and publish events'}</p>
        </div>
        <button type="button" className="btn-org-primary" onClick={onOpenCreateEvent}><Plus size={16} />{language === 'vi' ? 'Tạo sự kiện mới' : 'Create Event'}</button>
      </div>

      {actionError && <div role="alert" style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.8rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>{actionError}</div>}

      <div className="org-toolbar">
        <div className="org-tabs-bar" style={{ marginBottom: 0, borderBottom: 'none', flexWrap: 'wrap' }}>
          {filters.map(filter => <button key={filter.value} type="button" className={`org-tab-btn ${activeStatusFilter === filter.value ? 'is-active' : ''}`} onClick={() => setActiveStatusFilter(filter.value)}>{filter.label}</button>)}
        </div>
        <div className="organizer-search-box" style={{ maxWidth: '300px' }}><Search size={15} /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder={language === 'vi' ? 'Tìm tên sự kiện...' : 'Search event name...'} /></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {filteredEvents.length === 0 && <div className="organizer-card"><p style={{ margin: 0 }}>{language === 'vi' ? 'Không có sự kiện phù hợp.' : 'No matching events.'}</p></div>}
        {filteredEvents.map(event => (
          <div key={event.id} className="organizer-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', padding: '1.25rem', borderLeft: event.apiStatus === 'DRAFT' ? '4px solid #9CA3AF' : '4px solid #16A34A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
              {event.imageUrl ? <img src={event.imageUrl} alt={event.title} style={{ width: '100px', height: '75px', borderRadius: '8px', objectFit: 'cover' }} /> : <div style={{ width: '100px', height: '75px', borderRadius: '8px', background: '#E8EFEC', display: 'grid', placeItems: 'center' }}><Calendar size={24} /></div>}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}><h3 style={{ margin: 0 }}>{event.title}</h3><span className={`org-chip ${event.status}`}>● {event.statusLabelVi}</span></div>
                <p style={{ margin: '0.45rem 0 0', color: '#556B65', fontSize: '0.8rem' }}>{event.dateRange}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              {event.apiStatus === 'DRAFT' && <button type="button" className="btn-org-primary" onClick={() => void onPublishEvent(event.id)}><Send size={14} />{language === 'vi' ? 'Công bố' : 'Publish'}</button>}
              <button type="button" className="btn-org-secondary" onClick={() => onSelectEvent(event.id)}><Eye size={14} />{language === 'vi' ? 'Xem' : 'View'}</button>
              {event.apiStatus === 'DRAFT' && <button type="button" className="btn-org-secondary" onClick={() => onEditEvent(event)}><Edit3 size={14} />{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
