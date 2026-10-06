import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Clock, MapPin, X, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { IconEventTicket } from './CustomIcons';
import { EventCoverflow } from './ui/EventCoverflow';
import { EventItem, Language, ParticipantProfile } from '../types';
import './EventsSection.css';

const parseEventDate = (value: string) => {
  const parts = value.includes('/') ? value.split('/') : value.split('-');
  if (parts.length !== 3) return null;

  const [first, second, third] = parts.map(Number);
  const [year, month, day] = value.includes('/') ? [third, second, first] : [first, second, third];
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
};

interface EventsSectionProps {
  language: Language;
  events?: EventItem[];
  isLoading?: boolean;
  isParticipantAuthenticated?: boolean;
  participantProfile?: ParticipantProfile;
  onRegisterActivity?: (activityId: string) => void | Promise<void>;
  onJoinEvent?: (eventId: string) => void | Promise<void>;
}

export const EventsSection: React.FC<EventsSectionProps> = ({ 
  language, 
  events = [],
  isLoading = false,
  isParticipantAuthenticated = false,
  participantProfile: _participantProfile,
  onRegisterActivity: _onRegisterActivity,
  onJoinEvent,
}) => {
  const [activeEventDetail, setActiveEventDetail] = useState<EventItem | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState<EventItem | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [closingSheet, setClosingSheet] = useState<'detail' | 'register' | null>(null);
  const sheetDragStartY = React.useRef<number | null>(null);
  const didSheetDrag = React.useRef(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);

  const closeEventSheet = (sheet: 'detail' | 'register') => {
    if (closingSheet) return;
    const finishClose = () => {
      if (sheet === 'detail') setActiveEventDetail(null);
      else {
        setShowRegisterModal(null);
        setRegisteredSuccess(false);
      }
      setSheetDragOffset(0);
      setClosingSheet(null);
    };

    if (!window.matchMedia('(max-width: 768px)').matches) {
      finishClose();
      return;
    }

    setClosingSheet(sheet);
    window.setTimeout(finishClose, 260);
  };

  React.useEffect(() => {
    const hasOpenDialog = Boolean(activeEventDetail || showRegisterModal);
    if (!hasOpenDialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activeEventDetail) closeEventSheet('detail');
      else closeEventSheet('register');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeEventDetail, showRegisterModal]);

  const { displayedEvents, weekEventIds } = React.useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = startOfWeek(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Hiển thị tất cả sự kiện sắp diễn ra từ hôm nay trở đi, hoặc danh sách sự kiện có sẵn
    const upcomingEvents = events.filter((event) => {
      const eventDate = parseEventDate(event.dateStr);
      if (!eventDate) return true;
      return eventDate >= startOfToday;
    });

    const activeEvents = upcomingEvents.length > 0 ? upcomingEvents : events;

    return {
      displayedEvents: activeEvents,
      weekEventIds: new Set(activeEvents.filter((event) => {
        const eventDate = parseEventDate(event.dateStr);
        return eventDate && eventDate >= weekStart && eventDate <= weekEnd;
      }).map((event) => event.id)),
    };
  }, [events]);

  const handleOpenRegister = (evt: EventItem) => {
    setClosingSheet(null);
    setSheetDragOffset(0);
    setShowRegisterModal(evt);
    setRegisteredSuccess(false);
  };

  return (
    <section className="figma-events-section" id="su-kien">
      <div className="container">
        {/* Figma Eyebrow & Title - Perfectly centered matching whole website */}
        <div className="figma-section-header">
          <span className="figma-eyebrow">
            <IconEventTicket size={16} color="var(--figma-gold)" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {language === 'vi' ? 'LỊCH HOẠT ĐỘNG' : 'EVENTS SCHEDULE'}
          </span>
          <h2 className="figma-section-title">
            {language === 'vi' ? 'Sự kiện sắp diễn ra' : 'Upcoming Cultural Events'}
          </h2>
          <p className="figma-section-subtitle">
            {language === 'vi'
              ? 'Tham gia các buổi tọa đàm tác giả, triển lãm văn học và workshop trải nghiệm sáng tạo.'
              : 'Join inspiring author talks, cultural book exhibitions, and hands-on creative workshops.'}
          </p>
        </div>

        <EventCoverflow
          events={displayedEvents}
          language={language}
          weekEventIds={weekEventIds}
          isLoading={isLoading}
          onDetails={setActiveEventDetail}
          onRegister={handleOpenRegister}
        />
        {/* Nút Xem thêm nhỏ không có khung viền đặt dưới danh sách sự kiện */}
        <div className="section-bottom-see-more-row">
          <Link
            to="/su-kien"
            className="btn-section-see-more-borderless"
            aria-label="Xem thêm toàn bộ lịch hoạt động sự kiện"
          >
            <span>{language === 'vi' ? 'Xem thêm toàn bộ lịch sự kiện & hoạt động tại Đường Sách' : 'View full events & activities schedule at Book Street'}</span>
            <ChevronRight size={17} className="see-more-arrow-icon" />
          </Link>
        </div>
      </div>

      {/* Event Detail Modal */}
      {activeEventDetail && createPortal(
        <div
          className="modal-overlay event-detail-modal-overlay"
          onClick={() => closeEventSheet('detail')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-modal-title"
        >
          <div
            className={`modal-content event-detail-modal-content ${closingSheet === 'detail' ? 'is-closing' : ''}`}
            style={closingSheet !== 'detail' && (isSheetDragging || sheetDragOffset !== 0) ? { transform: `translateY(${sheetDragOffset}px)`, transition: isSheetDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="event-sheet-handle"
              aria-label={language === 'vi' ? 'Kéo xuống để đóng chi tiết sự kiện' : 'Drag down to close event details'}
              onClick={() => { if (!didSheetDrag.current) closeEventSheet('detail'); }}
              onPointerDown={(event) => {
                sheetDragStartY.current = event.clientY;
                didSheetDrag.current = false;
                setIsSheetDragging(true);
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (sheetDragStartY.current === null) return;
                const distance = event.clientY - sheetDragStartY.current;
                if (Math.abs(distance) > 3) didSheetDrag.current = true;
                setSheetDragOffset(Math.max(-72, Math.min(distance, window.innerHeight * 0.82)));
              }}
              onPointerUp={(event) => {
                if (sheetDragStartY.current === null) return;
                const distance = event.clientY - sheetDragStartY.current;
                sheetDragStartY.current = null;
                setIsSheetDragging(false);
                if (distance > 120) closeEventSheet('detail');
                else setSheetDragOffset(0);
                window.setTimeout(() => { didSheetDrag.current = false; }, 0);
              }}
              onPointerCancel={() => { sheetDragStartY.current = null; setIsSheetDragging(false); setSheetDragOffset(0); }}
            ><span aria-hidden="true" /></button>
            <button
              type="button"
              className="modal-close"
              onClick={() => closeEventSheet('detail')}
              aria-label={language === 'vi' ? 'Đóng chi tiết sự kiện' : 'Close event details'}
            >
              <X size={20} />
            </button>
            <div className="modal-event-photo-header">
              <img src={activeEventDetail.image.url} alt={activeEventDetail.image.alt} className="modal-top-img" />
              <div className="modal-img-caption">
                <span className="event-cat-tag">
                  {language === 'vi' ? activeEventDetail.typeLabelVi : activeEventDetail.typeLabelEn}
                </span>
              </div>
            </div>
            <h3 className="modal-heading-title" id="event-detail-modal-title">
              {language === 'vi' ? activeEventDetail.title : activeEventDetail.titleEn}
            </h3>
            <div className="modal-meta-box">
              <p><strong>{language === 'vi' ? 'Thời gian:' : 'Time:'}</strong> {activeEventDetail.dateStr} ({activeEventDetail.timeStr})</p>
              <p><strong>{language === 'vi' ? 'Địa điểm:' : 'Location:'}</strong> {language === 'vi' ? activeEventDetail.location : activeEventDetail.locationEn}</p>
              <p><strong>{language === 'vi' ? 'Diễn giả:' : 'Speaker:'}</strong> {activeEventDetail.speaker}</p>
            </div>
            <p className="modal-body-desc">
              {language === 'vi' ? activeEventDetail.summary : activeEventDetail.summaryEn}
            </p>
            <button
              type="button"
              className="btn-figma-primary"
              onClick={() => {
                const e = activeEventDetail;
                setActiveEventDetail(null);
                handleOpenRegister(e);
              }}
            >
              {language === 'vi' ? 'Đăng ký tham gia sự kiện này' : 'Register for this Event'}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Simulated Register Modal with Aligned Event Context */}
      {showRegisterModal && createPortal(
        <div
          className="modal-overlay registration-modal-overlay"
          onClick={() => closeEventSheet('register')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-modal-title"
        >
          <div
            className={`modal-content modal-register-content ${closingSheet === 'register' ? 'is-closing' : ''}`}
            style={closingSheet !== 'register' && (isSheetDragging || sheetDragOffset !== 0) ? { transform: `translateY(${sheetDragOffset}px)`, transition: isSheetDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="event-sheet-handle"
              aria-label={language === 'vi' ? 'Kéo xuống để đóng đăng ký sự kiện' : 'Drag down to close event registration'}
              onClick={() => { if (!didSheetDrag.current) closeEventSheet('register'); }}
              onPointerDown={(event) => {
                sheetDragStartY.current = event.clientY;
                didSheetDrag.current = false;
                setIsSheetDragging(true);
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (sheetDragStartY.current === null) return;
                const distance = event.clientY - sheetDragStartY.current;
                if (Math.abs(distance) > 3) didSheetDrag.current = true;
                setSheetDragOffset(Math.max(-72, Math.min(distance, window.innerHeight * 0.82)));
              }}
              onPointerUp={(event) => {
                if (sheetDragStartY.current === null) return;
                const distance = event.clientY - sheetDragStartY.current;
                sheetDragStartY.current = null;
                setIsSheetDragging(false);
                if (distance > 120) closeEventSheet('register');
                else setSheetDragOffset(0);
                window.setTimeout(() => { didSheetDrag.current = false; }, 0);
              }}
              onPointerCancel={() => { sheetDragStartY.current = null; setIsSheetDragging(false); setSheetDragOffset(0); }}
            ><span aria-hidden="true" /></button>
            <button
              type="button"
              className="modal-close"
              aria-label={language === 'vi' ? 'Đóng biểu mẫu đăng ký' : 'Close registration form'}
              onClick={() => closeEventSheet('register')}
            >
              <X size={20} />
            </button>

            {!registeredSuccess ? (
              <>
                <div className="reg-modal-header">
                  <span className="reg-badge-tag">
                    {language === 'vi' ? 'ĐĂNG KÝ THAM GIA' : 'EVENT REGISTRATION'}
                  </span>
                  <h3 id="registration-modal-title" className="modal-heading-title reg-modal-title">
                    {language === 'vi' ? 'Đăng ký tham dự sự kiện' : 'Register for Event'}
                  </h3>
                </div>

                {/* Selected Event Context Card Preview */}
                <div className="reg-event-card-preview">
                  <div className="reg-event-thumb-wrap">
                    <img 
                      src={showRegisterModal.image.url} 
                      alt={showRegisterModal.image.alt} 
                      className="reg-event-thumb" 
                    />
                  </div>
                  <div className="reg-event-info">
                    <h4 className="reg-event-title">
                      {language === 'vi' ? showRegisterModal.title : showRegisterModal.titleEn}
                    </h4>
                    <div className="reg-event-meta-list">
                      <span className="reg-meta-item">
                        <Clock size={14} />
                        {showRegisterModal.dayOfWeek ? `${showRegisterModal.dayOfWeek}, ` : ''}{showRegisterModal.dateStr} • {showRegisterModal.timeStr}
                      </span>
                      <span className="reg-meta-item">
                        <MapPin size={14} />
                        {language === 'vi' ? showRegisterModal.location : showRegisterModal.locationEn}
                      </span>
                      {showRegisterModal.speaker && (
                        <span className="reg-meta-item reg-speaker-line">
                          <strong>{language === 'vi' ? 'Diễn giả:' : 'Speaker:'}</strong> {showRegisterModal.speaker}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="alert-figma-notice">
                  <AlertTriangle size={18} />
                  <span>
                    {language === 'vi' 
                      ? 'Mỗi tài khoản ghi danh cho chính mình. Đăng ký hoạt động riêng để nhận mã QR điểm danh.'
                      : 'Each account joins for itself. Register for an activity separately to receive a check-in QR code.'}
                  </span>
                </div>

                {!isParticipantAuthenticated && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: '#FAF8F3',
                    border: '1px solid #E9BC63',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                    color: '#8C6519',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    <span>
                      {language === 'vi' 
                        ? 'Đăng nhập để tham gia sự kiện bằng tài khoản của bạn.'
                        : 'Sign in to join this event with your account.'}
                    </span>
                    <Link 
                      to="/login" 
                      state={{ from: '#su-kien' }}
                      style={{ fontWeight: 700, color: '#17382E', textDecoration: 'underline' }}
                    >
                      {language === 'vi' ? 'Đăng nhập ngay →' : 'Sign in now →'}
                    </Link>
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!isParticipantAuthenticated) return;
                    if (showRegisterModal && onJoinEvent) {
                      try {
                        setRegistrationError(null);
                        await onJoinEvent(showRegisterModal.id);
                        setRegisteredSuccess(true);
                      } catch (error) {
                        setRegistrationError(error instanceof Error ? error.message : 'Không thể đăng ký sự kiện');
                      }
                    }
                  }}
                  className="figma-reg-form"
                >
                  {registrationError && <p role="alert" className="app-loading-state">{registrationError}</p>}
                  <button type="submit" className="btn-figma-primary reg-submit-button">
                    <CheckCircle2 size={18} />
                    <span>{language === 'vi' ? 'Xác nhận Đăng ký Tham dự' : 'Confirm Registration'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="success-box-center">
                <CheckCircle2 size={52} color="#15803D" style={{ margin: '0 auto 0.75rem' }} />
                <h3 className="modal-heading-title" style={{ color: '#1B2B25' }}>
                  {language === 'vi' ? 'Đăng ký tham dự thành công!' : 'Registration Successful!'}
                </h3>
                <p className="success-event-badge">
                  {language === 'vi' ? showRegisterModal.title : showRegisterModal.titleEn}
                </p>
                <p className="success-desc">
                  {language === 'vi' 
                    ? 'Tài khoản của bạn đã được ghi nhận tham gia sự kiện. Hãy đăng ký hoạt động cụ thể để nhận mã QR điểm danh.'
                    : 'Your account has joined this event. Register for a specific activity to receive a check-in QR code.'}
                </p>
                <div className="success-actions-row" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {isParticipantAuthenticated && (
                    <Link
                      to="/participant/events"
                      className="btn-figma-primary"
                      style={{ textDecoration: 'none' }}
                      onClick={() => {
                        setShowRegisterModal(null);
                        setRegisteredSuccess(false);
                      }}
                    >
                      {language === 'vi' ? 'Xem sự kiện của tôi' : 'View My Events'}
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn-figma-secondary"
                    onClick={() => closeEventSheet('register')}
                  >
                    {language === 'vi' ? 'Đóng' : 'Close'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};
