import { ArrowRight, Calendar, CheckCircle2, Download, MapPin, QrCode } from 'lucide-react';
import React, { useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { PageHeader } from '../../components/ui/PageHeader';
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
  const [selectedQrEvent, setSelectedQrEvent] = useState<ParticipantEvent | null>(null);

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
      <PageHeader
        title={language === 'vi' ? 'Sự kiện của tôi' : 'My Events'}
        subtitle={language === 'vi'
          ? 'Theo dõi danh sách các lễ hội và sự kiện sách bạn đã đăng ký tham gia.'
          : 'Track the book festivals and cultural events you have joined.'}
      />

      {/* Tabs */}
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
        <EmptyState
          title={language === 'vi' ? 'Không có sự kiện nào' : 'No events found'}
          description={language === 'vi'
            ? 'Bạn chưa có sự kiện nào trong danh mục này. Hãy khám phá các sự kiện mới tại Đường Sách!'
            : 'You do not have any events in this tab.'}
        />
      ) : (
        <div className="participant-events-grid">
          {filteredEvents.map((evt) => (
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

                  {evt.isJoined && (
                    <button
                      type="button"
                      className="btn-part-secondary"
                      onClick={() => setSelectedQrEvent(evt)}
                      title={language === 'vi' ? 'Xem mã QR Check-in' : 'View Check-in QR'}
                    >
                      <QrCode size={15} />
                      <span>{language === 'vi' ? 'Mã Vé' : 'Pass'}</span>
                    </button>
                  )}

                  {evt.isJoined ? (
                    <button
                      type="button"
                      className="btn-part-leave"
                      onClick={() => onLeaveEvent(evt.id)}
                    >
                      {language === 'vi' ? 'Rời sự kiện' : 'Leave'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-part-rejoin"
                      onClick={() => onJoinEvent?.(evt.id)}
                    >
                      {language === 'vi' ? 'Đăng ký lại' : 'Rejoin'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POPUP CHI TIẾT SỰ KIỆN */}
      {selectedDetailEvent && (
        <ModalDialog
          isOpen={Boolean(selectedDetailEvent)}
          onClose={() => setSelectedDetailEvent(null)}
          title={selectedDetailEvent.title}
          subtitle={`${selectedDetailEvent.location} • ${selectedDetailEvent.dateRange}`}
          maxWidth="580px"
          footer={
            <button
              type="button"
              className="btn-part-secondary"
              onClick={() => setSelectedDetailEvent(null)}
            >
              {language === 'vi' ? 'Đóng' : 'Close'}
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedDetailEvent.imageUrl && (
              <img
                src={selectedDetailEvent.imageUrl}
                alt={selectedDetailEvent.title}
                style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '10px' }}
              />
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.85rem',
              background: '#F8FAF9',
              border: '1px solid #E2EAE5',
              borderRadius: '10px',
              padding: '1rem'
            }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', color: '#556B65', textTransform: 'uppercase' }}>
                  {language === 'vi' ? 'Thời gian' : 'Time'}
                </strong>
                <span style={{ fontSize: '0.85rem', color: '#172421', fontWeight: 600 }}>
                  {selectedDetailEvent.dateRange}
                </span>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', color: '#556B65', textTransform: 'uppercase' }}>
                  {language === 'vi' ? 'Địa điểm' : 'Location'}
                </strong>
                <span style={{ fontSize: '0.85rem', color: '#172421', fontWeight: 600 }}>
                  {selectedDetailEvent.location}
                </span>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#172421', marginBottom: '0.4rem' }}>
                {language === 'vi' ? 'Giới thiệu sự kiện' : 'About this event'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#556B65', lineHeight: 1.55, margin: 0 }}>
                {selectedDetailEvent.shortDesc}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: '0.75rem 1rem',
              background: '#F0F7F4',
              borderRadius: '8px',
              border: '1px solid #C4DCD3',
              color: '#17382E',
              fontSize: '0.8rem',
              lineHeight: 1.45
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#185E48' }} />
              <span>
                {language === 'vi'
                  ? 'Bạn đã đăng ký tham gia sự kiện này. Vui lòng có mặt đúng giờ và xuất trình mã QR check-in tại các gian hàng/khu vực diễn ra để nhận điểm tích lũy!'
                  : 'You are registered for this event. Please arrive on time and present your QR code for points!'}
              </span>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* POPUP SHOW MÃ QR CHECK-IN SỰ KIỆN */}
      {selectedQrEvent && (
        <ModalDialog
          isOpen={Boolean(selectedQrEvent)}
          onClose={() => setSelectedQrEvent(null)}
          title={language === 'vi' ? 'Mã Vé & Check-in' : 'Event Pass & Check-in'}
          subtitle={`${selectedQrEvent.title} • ${selectedQrEvent.location}`}
          maxWidth="440px"
          footer={
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                type="button"
                className="btn-part-secondary"
                style={{ flex: 1 }}
                onClick={() => setSelectedQrEvent(null)}
              >
                {language === 'vi' ? 'Đóng' : 'Close'}
              </button>
              <button
                type="button"
                className="btn-part-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  alert(language === 'vi' ? 'Mã QR đã được tải về máy của bạn!' : 'QR Code downloaded to your device!');
                }}
              >
                <Download size={15} />
                <span>{language === 'vi' ? 'Tải mã về' : 'Download'}</span>
              </button>
            </div>
          }
        >
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{
              background: '#F8FAF9',
              border: '2px dashed #C4DCD3',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'inline-block',
              marginBottom: '1rem'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DUONGSACH-EVENT-${selectedQrEvent.id}-USER`}
                alt="Mã QR Check-in sự kiện"
                style={{ width: '180px', height: '180px', display: 'block', borderRadius: '8px' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#556B65', display: 'block', marginBottom: '2px' }}>
                {language === 'vi' ? 'Mã số tham dự' : 'Registration Code'}
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '1.15rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#17382E',
                background: '#E2EAE5',
                padding: '4px 12px',
                borderRadius: '6px'
              }}>
                {`EVT-${selectedQrEvent.id.toUpperCase().slice(-6)}`}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              fontSize: '0.8rem',
              color: '#17382E',
              background: '#F0F7F4',
              padding: '0.6rem 1rem',
              borderRadius: '8px'
            }}>
              <CheckCircle2 size={15} color="#185E48" />
              <span>{language === 'vi' ? 'Đưa mã này cho BTC/Gian hàng để quét tích điểm' : 'Present this QR code to staff to check in'}</span>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
};
