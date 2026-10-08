import { ArrowRight, Calendar, CheckCircle2, Download, MapPin, QrCode, Tag, User, X } from 'lucide-react';
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
      <div className="participant-page-header">
        <h1 className="participant-page-title">
          {language === 'vi' ? 'Sự kiện của tôi' : 'My Events'}
        </h1>
        <p className="participant-page-sub">
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
                      title={language === 'vi' ? 'Mã QR Check-in sự kiện' : 'Event Check-in QR Code'}
                    >
                      <QrCode size={15} />
                      <span>{language === 'vi' ? 'Mã QR' : 'QR Code'}</span>
                    </button>
                  )}

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
        </div>
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
                    ? 'Bạn đã đăng ký tham gia sự kiện này. Vui lòng có mặt đúng giờ và xuất trình mã QR check-in tại các gian hàng/khu vực diễn ra để nhận điểm tích lũy!'
                    : 'You are registered for this event. Please arrive on time and present your QR code for points!'}
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

      {/* POPUP SHOW MÃ QR CHECK-IN SỰ KIỆN */}
      {selectedQrEvent && (
        <div
          className="participant-calendar-modal-backdrop"
          style={{ zIndex: 10000 }}
          onClick={() => setSelectedQrEvent(null)}
        >
          <div
            className="participant-calendar-modal"
            style={{ maxWidth: '420px', textAlign: 'center', borderRadius: '20px', padding: '0', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* QR Header */}
            <div style={{
              background: 'linear-gradient(135deg, #17382E 0%, #104A3C 100%)',
              color: '#FFFFFF',
              padding: '1.5rem',
              position: 'relative'
            }}>
              <button
                type="button"
                className="calendar-modal-close-btn"
                style={{ position: 'absolute', top: '12px', right: '12px', color: '#FFFFFF', background: 'rgba(255,255,255,0.15)', border: 'none' }}
                onClick={() => setSelectedQrEvent(null)}
              >
                <X size={18} />
              </button>
              <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E9BC63', fontWeight: 800 }}>
                {language === 'vi' ? 'Mã Vé & Check-in' : 'Event Pass & Check-in'}
              </span>
              <h3 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                {selectedQrEvent.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#A7F3D0' }}>
                {selectedQrEvent.location} • {selectedQrEvent.dateRange}
              </p>
            </div>

            {/* QR Code Container */}
            <div style={{ padding: '1.75rem 1.5rem', background: '#FFFFFF' }}>
              <div style={{
                background: '#F8FAFC',
                border: '2px dashed #CBD5E1',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'inline-block',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                marginBottom: '1rem'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DUONGSACH-EVENT-${selectedQrEvent.id}-USER`}
                  alt="Mã QR Check-in sự kiện"
                  style={{ width: '180px', height: '180px', display: 'block', borderRadius: '8px' }}
                />
              </div>

              {/* Code ID */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>
                  {language === 'vi' ? 'Mã số tham dự' : 'Registration Code'}
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#17382E',
                  background: '#F1F5F9',
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
                fontSize: '0.78rem',
                color: '#059669',
                background: '#ECFDF5',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem'
              }}>
                <CheckCircle2 size={15} />
                <span>{language === 'vi' ? 'Đưa mã này cho BTC/Gian hàng để quét tích điểm' : 'Present this QR code to staff to check in'}</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedQrEvent(null)}
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#17382E',
                    color: '#FFFFFF',
                    fontWeight: 750,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(23, 56, 46, 0.2)'
                  }}
                  onClick={() => {
                    alert(language === 'vi' ? 'Mã QR đã được tải về máy của bạn!' : 'QR Code downloaded to your device!');
                  }}
                >
                  <Download size={15} />
                  <span>{language === 'vi' ? 'Tải mã về' : 'Download'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
