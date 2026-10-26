import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ArrowRight, Calendar, CheckCircle2, MapPin, Tag, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { Language, ParticipantEvent } from '../../types';
import './ParticipantPages.css';

interface MyEventsPageProps {
  language: Language;
  events: ParticipantEvent[];
  onLeaveEvent: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => void;
}

export const MyEventsPage: React.FC<MyEventsPageProps> = ({
  language,
  events,
  onLeaveEvent,
  onJoinEvent,
}) => {
  const [activeTab, setActiveTab] = useState<'ongoing' | 'ended' | 'left'>('ongoing');
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<ParticipantEvent | null>(null);
  useModalDismiss(Boolean(selectedDetailEvent), () => setSelectedDetailEvent(null));

  const ongoingCount = events.filter(e => e.status === 'ongoing' && e.isJoined).length;
  const endedCount = events.filter(e => e.status === 'ended' && e.isJoined).length;
  const leftCount = events.filter(e => !e.isJoined || e.status === 'left').length;

  const filteredEvents = events.filter(e => {
    if (activeTab === 'ongoing') return e.status === 'ongoing' && e.isJoined;
    if (activeTab === 'ended') return e.status === 'ended' && e.isJoined;
    if (activeTab === 'left') return !e.isJoined || e.status === 'left';
    return true;
  });

  return (
    <div className="participant-my-events-view">
      {/* Title */}
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">
          {language === 'vi' ? 'Sự kiện của tôi' : 'My Events'}
        </h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {language === 'vi'
            ? 'Theo dõi danh sách các lễ hội và sự kiện sách bạn đã đăng ký tham gia.'
            : 'Track the book festivals and cultural events you have joined.'}
        </p>
      </div>

      {/* Tabs: Đang tham gia (2) | Đã kết thúc (1) | Đã rời (0) */}
      <div className="participant-tabs-bar">
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'ongoing' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          {language === 'vi' ? `Đang tham gia (${ongoingCount})` : `Ongoing (${ongoingCount})`}
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'ended' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('ended')}
        >
          {language === 'vi' ? `Đã kết thúc (${endedCount})` : `Ended (${endedCount})`}
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'left' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('left')}
        >
          {language === 'vi' ? `Đã rời (${leftCount})` : `Left (${leftCount})`}
        </button>
      </div>

      {/* Events List Grid */}
      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6E827C' }}>
          <p>{language === 'vi' ? 'Không có sự kiện nào trong danh mục này.' : 'No events found in this category.'}</p>
        </div>
      ) : (
        <PaginatedList items={filteredEvents}>{pageItems => (<div className="participant-events-grid">
          {pageItems.map((evt) => (
            <div key={evt.id} className="participant-event-card">
              <div className="event-card-media">
                <img src={evt.imageUrl} alt={evt.title} />
                <span className={`event-status-pill ${evt.status}`}>
                  {evt.isJoined
                    ? (language === 'vi' ? 'Đang tham gia' : 'Joined')
                    : (language === 'vi' ? 'Đã rời' : 'Left')}
                </span>
              </div>
              <div className="event-card-body">
                <h3 className="event-card-title">{evt.title}</h3>
                <div className="event-card-meta">
                  <div className="event-meta-item">
                    <Calendar size={15} />
                    <span>{evt.dateRange}</span>
                  </div>
                  <div className="event-meta-item">
                    <MapPin size={15} />
                    <span>{evt.location}</span>
                  </div>
                </div>
                <p className="event-card-desc">{evt.shortDesc}</p>

                <div className="event-card-actions">
                  <button
                    type="button"
                    className="btn-part-primary"
                    onClick={() => setSelectedDetailEvent(evt)}
                  >
                    <span>{language === 'vi' ? 'Xem chi tiết' : 'Details'}</span>
                    <ArrowRight size={14} />
                  </button>

                  {evt.isJoined && evt.canLeave && (
                    <button
                      type="button"
                      className="btn-part-danger-outline"
                      onClick={() => {
                        if (window.confirm(language === 'vi' ? 'Bạn có chắc chắn muốn rời sự kiện này?' : 'Are you sure you want to leave this event?')) {
                          onLeaveEvent(evt.id);
                        }
                      }}
                    >
                      {language === 'vi' ? 'Rời sự kiện' : 'Leave'}
                    </button>
                  )}

                  {!evt.isJoined && onJoinEvent && (
                    <button
                      type="button"
                      className="btn-part-primary"
                      onClick={() => onJoinEvent(evt.id)}
                    >
                      {language === 'vi' ? 'Tham gia lại' : 'Re-join'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>)}</PaginatedList>
      )}

      {/* POPUP CHI TIẾT SỰ KIỆN */}
      {selectedDetailEvent && (
        <div
          className="participant-calendar-modal-backdrop"
          style={{ zIndex: 10000 }}
          onClick={() => setSelectedDetailEvent(null)}
        >
          <div
            className="participant-calendar-modal"
            style={{ maxWidth: '580px', borderRadius: '18px', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Hero Image */}
            <div style={{ position: 'relative', height: '170px', width: '100%', overflow: 'hidden' }}>
              <img
                src={selectedDetailEvent.imageUrl}
                alt={selectedDetailEvent.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '1.25rem'
              }}>
                <span style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: selectedDetailEvent.isJoined ? '#059669' : '#DC2626',
                  color: '#FFFFFF',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  marginBottom: '0.4rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {selectedDetailEvent.isJoined ? <CheckCircle2 size={12} /> : null}
                  <span>{selectedDetailEvent.isJoined ? (language === 'vi' ? 'Đã đăng ký tham gia' : 'Registered') : (language === 'vi' ? 'Đã rời' : 'Left')}</span>
                </span>
                <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.25rem', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {selectedDetailEvent.title}
                </h3>
              </div>
              <button
                type="button"
                className="calendar-modal-close-btn"
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.5)', color: '#FFFFFF', border: 'none' }}
                onClick={() => setSelectedDetailEvent(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Info */}
            <div className="calendar-modal-body" style={{ padding: '1.5rem' }}>
              {/* Meta details grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.85rem',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '1.15rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Calendar size={17} style={{ color: '#185E48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase' }}>
                      {language === 'vi' ? 'Thời gian' : 'Time'}
                    </strong>
                    <span style={{ fontSize: '0.86rem', color: '#1E293B', fontWeight: 650 }}>
                      {selectedDetailEvent.dateRange}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <MapPin size={17} style={{ color: '#185E48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase' }}>
                      {language === 'vi' ? 'Địa điểm' : 'Location'}
                    </strong>
                    <span style={{ fontSize: '0.86rem', color: '#1E293B', fontWeight: 650 }}>
                      {selectedDetailEvent.location}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <User size={17} style={{ color: '#185E48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase' }}>
                      {language === 'vi' ? 'Đơn vị tổ chức / Diễn giả' : 'Organizer / Speaker'}
                    </strong>
                    <span style={{ fontSize: '0.86rem', color: '#1E293B', fontWeight: 650 }}>
                      Ban Quản Lý & Các Nhà Xuất Bản
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Tag size={17} style={{ color: '#185E48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase' }}>
                      {language === 'vi' ? 'Hình thức' : 'Type'}
                    </strong>
                    <span style={{ fontSize: '0.86rem', color: '#1E293B', fontWeight: 650 }}>
                      {language === 'vi' ? 'Lễ hội văn hóa đọc cộng đồng' : 'Reading Culture Festival'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 750, color: '#1E293B', marginBottom: '0.45rem' }}>
                  {language === 'vi' ? 'Giới thiệu sự kiện' : 'About this event'}
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
                  {selectedDetailEvent.shortDesc}
                </p>
              </div>

              {/* Important notes */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                background: '#ECFDF5',
                borderRadius: '10px',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '0.8rem',
                lineHeight: 1.45,
                marginBottom: '1.5rem'
              }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#059669' }} />
                <span>
                  {language === 'vi'
                    ? 'Bạn đã tham gia sự kiện này. Hãy đăng ký hoạt động phù hợp và quét mã QR hoạt động do Ban tổ chức hiển thị tại khu vực diễn ra để điểm danh.'
                    : 'You have joined this event. Register for an activity and scan the Activity QR displayed by the Organizer at the venue to check in.'}
                </span>
              </div>

              {/* Modal Footer actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedDetailEvent(null)}
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
