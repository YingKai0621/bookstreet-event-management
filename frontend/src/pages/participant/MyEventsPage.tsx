import { displayDateText } from '../../utils/dateDisplay';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { ArrowRight, Calendar, MapPin, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Language, ParticipantEvent } from '../../types';
import './ParticipantPages.css';
import { LeaveEventDialog } from '../../components/participant/LeaveEventDialog';

interface MyEventsPageProps {
  language: Language;
  events: ParticipantEvent[];
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onLeaveEvent: (eventId: string) => void | Promise<void>;
  onJoinEvent?: (eventId: string) => void | Promise<void>;
}

export const MyEventsPage = ({
  language,
  events,
  isLoading,
  loadError,
  onRetry,
  onLeaveEvent,
}: MyEventsPageProps) => {
  const vi = language === 'vi';
  const [activeTab, setActiveTab] = useState<'ongoing' | 'ended'>('ongoing');
  const [leavingEvent, setLeavingEvent] = useState<ParticipantEvent | null>(null);

  const ongoingCount = events.filter(event => event.status === 'ongoing' && event.isJoined).length;
  const endedCount = events.filter(event => event.status === 'ended' && event.isJoined).length;
  const filteredEvents = events.filter(event => event.isJoined && event.status === activeTab);

  return (
    <div className="participant-my-events-view">
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">{vi ? 'Sự kiện của tôi' : 'My Events'}</h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {vi ? 'Theo dõi sự kiện đã tham gia và mở danh sách hoạt động đăng ký của từng sự kiện.' : 'Track joined events and view your registered activities for each event.'}
        </p>
      </div>

      <div className="participant-tabs-bar" aria-label={vi ? 'Trạng thái sự kiện' : 'Event status'}>
        <button type="button" className={`participant-tab-btn ${activeTab === 'ongoing' ? 'is-active' : ''}`} onClick={() => setActiveTab('ongoing')}>
          {vi ? `Đang tham gia (${ongoingCount})` : `Ongoing (${ongoingCount})`}
        </button>
        <button type="button" className={`participant-tab-btn ${activeTab === 'ended' ? 'is-active' : ''}`} onClick={() => setActiveTab('ended')}>
          {vi ? `Đã kết thúc (${endedCount})` : `Ended (${endedCount})`}
        </button>
      </div>

      {leavingEvent && <LeaveEventDialog eventName={leavingEvent.title} language={language} onClose={() => setLeavingEvent(null)} onConfirm={() => onLeaveEvent(leavingEvent.id)} />}

      {isLoading ? (
        <div className="participant-data-state" role="status">
          <span className="participant-state-spinner" aria-hidden="true" />
          <strong>{vi ? 'Đang tải sự kiện của bạn' : 'Loading your events'}</strong>
          <p>{vi ? 'Hệ thống đang đồng bộ đăng ký và hoạt động liên quan.' : 'Your registrations and related activities are being synchronized.'}</p>
        </div>
      ) : loadError ? (
        <div className="participant-data-state is-error" role="alert">
          <strong>{vi ? 'Chưa tải được danh sách sự kiện' : 'Unable to load events'}</strong>
          <p>{loadError}</p>
          <button type="button" className="btn-part-secondary" onClick={onRetry}><RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}</button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="participant-data-state">
          <strong>{vi ? 'Chưa có sự kiện trong mục này' : 'No events in this section'}</strong>
          <p>{vi ? 'Các sự kiện bạn tham gia sẽ được hiển thị tại đây.' : 'Events you join will appear here.'}</p>
          <Link to="/su-kien" className="btn-part-primary">{vi ? 'Khám phá sự kiện' : 'Explore events'}<ArrowRight size={15} /></Link>
        </div>
      ) : (
        <PaginatedList items={filteredEvents}>{pageItems => (
          <div className="participant-events-grid">
            {pageItems.map(event => (
              <article key={event.id} className="participant-event-card">
                <div className="event-card-media">
                  <img src={event.imageUrl} alt="" />
                </div>
                <div className="event-card-body">
                  <div className="participant-event-card-heading">
                    <h2 className="event-card-title">{event.title}</h2>
                    <span className={`event-status-pill ${event.status}`}>
                      {event.status === 'ended' ? (vi ? 'Đã kết thúc' : 'Ended') : (vi ? 'Đang tham gia' : 'Joined')}
                    </span>
                  </div>
                  <div className="event-card-meta">
                    <div className="event-meta-item"><Calendar size={15} /><span>{displayDateText(event.dateRange)}</span></div>
                    <div className="event-meta-item"><MapPin size={15} /><span>{event.location}</span></div>
                  </div>
                  <p className="event-card-activity-count">
                    {vi ? `${event.activitiesCount} hoạt động đang giữ đăng ký` : `${event.activitiesCount} active activity registrations`}
                  </p>
                  <div className="event-card-actions">
                    <Link className="btn-part-primary" to={`/participant/events/${encodeURIComponent(event.id)}`}>
                      {vi ? 'Xem hoạt động' : 'View activities'}<ArrowRight size={14} />
                    </Link>
                    {event.isJoined && event.canLeave && (
                      <button type="button" className="btn-part-danger-outline" onClick={() => setLeavingEvent(event)}>
                        {vi ? 'Rời sự kiện' : 'Leave'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}</PaginatedList>
      )}
    </div>
  );
};
