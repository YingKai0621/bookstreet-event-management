import { displayDateText } from '../../utils/dateDisplay';
import '../participant/EventFeedback.css';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import { CheckCircle2, ChevronRight, Clock, MapPin, X } from 'lucide-react';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { EventItem, Language, ParticipantProfile } from '../../types';
import { IconEventTicket } from './CustomIcons';
import './EventsSection.css';
import { EventCoverflow } from '../ui/EventCoverflow';
import { useDeadlineClock } from '../../hooks/useDeadlineClock';
import { registrationDeadlinePassed } from '../../utils/registrationDeadline';

const formatRegistrationDeadline = (value: string) => {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
};

const startOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
};

interface EventsSectionProps {
  registeredEventIds?: ReadonlySet<string>;
  language: Language;
  events?: EventItem[];
  isLoading?: boolean;
  isParticipantAuthenticated?: boolean;
  isStaffAccount?: boolean;
  participantProfile?: ParticipantProfile;
  onRegisterActivity?: (activityId: string) => void | Promise<void>;
  onJoinEvent?: (eventId: string) => void | Promise<void>;
  onLeaveEvent?: (eventId: string) => void | Promise<void>;
  selectedEventId?: string;
  onSelectEventId?: (eventId: string) => void;
}

export const EventsSection: React.FC<EventsSectionProps> = ({ 
  language, 
  registeredEventIds = new Set<string>(),
  events = [],
  isLoading = false,
  isParticipantAuthenticated = false,
  isStaffAccount = false,
  participantProfile: _participantProfile,
  onRegisterActivity: _onRegisterActivity,
  onJoinEvent,
  onLeaveEvent,
  selectedEventId,
  onSelectEventId,
}) => {
  const [activeEventDetail, setActiveEventDetail] = useState<EventItem | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState<EventItem | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [detailUnregisterError, setDetailUnregisterError] = useState<string | null>(null);
  const [isUnregisteringDetail, setIsUnregisteringDetail] = useState(false);
  const registrationNow = useDeadlineClock([activeEventDetail?.registrationDeadlineAt, showRegisterModal?.registrationDeadlineAt]);
  const [closingSheet, setClosingSheet] = useState<'detail' | 'register' | null>(null);
  const sheetDragStartY = React.useRef<number | null>(null);
  const didSheetDrag = React.useRef(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);

  const closeEventSheet = React.useCallback((sheet: 'detail' | 'register') => {
    if (closingSheet) return;
    const finishClose = () => {
      if (sheet === 'detail') {
        setActiveEventDetail(null);
        setDetailUnregisterError(null);
      } else {
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
  }, [closingSheet]);

  useModalDismiss(Boolean(activeEventDetail), () => closeEventSheet('detail'));
  useModalDismiss(Boolean(showRegisterModal), () => closeEventSheet('register'));
  const detailBackdropHandlers = useBackdropClick(() => closeEventSheet('detail'));
  const registrationBackdropHandlers = useBackdropClick(() => closeEventSheet('register'));

  const weekEventIds = React.useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return new Set(events.filter((event) => {
      const eventDate = event.startAt ? new Date(event.startAt) : new Date(event.dateStr);
      return !Number.isNaN(eventDate.getTime()) && eventDate >= weekStart && eventDate <= weekEnd;
    }).map((event) => event.id));
  }, [events]);

  const handleOpenRegister = (evt: EventItem) => {
    if (registeredEventIds.has(evt.id)) return;
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
              ? 'Tọa đàm, triển lãm và workshop tại Đường Sách.'
              : 'Author talks, exhibitions, and workshops at Book Street.'}
          </p>
        </div>

        <EventCoverflow
          registeredEventIds={registeredEventIds}
          events={events}
          language={language}
          weekEventIds={weekEventIds}
          isLoading={isLoading}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEventId}
          onDetails={setActiveEventDetail}
          onRegister={handleOpenRegister}
        />
        {/* Nút Xem thêm nhỏ không có khung viền đặt dưới danh sách sự kiện */}
        <div className="section-bottom-see-more-row">
          <Link
            to={selectedEventId ? `/su-kien?eventId=${encodeURIComponent(selectedEventId)}` : '/su-kien'}
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
          {...detailBackdropHandlers}
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
              {activeEventDetail.image.url && (
                <img src={activeEventDetail.image.url} alt={activeEventDetail.image.alt} className="modal-top-img" />
              )}
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
              <p><strong>{language === 'vi' ? 'Thời gian:' : 'Time:'}</strong> {activeEventDetail.scheduleStr || `${displayDateText(activeEventDetail.dateStr)} (${activeEventDetail.timeStr})`}</p>
              {activeEventDetail.registrationDeadlineAt && (
                <p><strong>{language === 'vi' ? 'Hạn đăng ký:' : 'Registration deadline:'}</strong> {formatRegistrationDeadline(activeEventDetail.registrationDeadlineAt)}</p>
              )}
              <p><strong>{language === 'vi' ? 'Địa điểm:' : 'Location:'}</strong> {language === 'vi' ? activeEventDetail.location : activeEventDetail.locationEn}</p>
              <p><strong>{language === 'vi' ? 'Diễn giả:' : 'Speaker:'}</strong> {activeEventDetail.speaker}</p>
            </div>
            <p className="modal-body-desc">
              {language === 'vi' ? activeEventDetail.summary : activeEventDetail.summaryEn}
            </p>
            {detailUnregisterError && (
              <p className="participant-inline-error" role="alert" style={{ color: '#DC2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {detailUnregisterError}
              </p>
            )}
            {registeredEventIds.has(activeEventDetail.id) && isParticipantAuthenticated && onLeaveEvent ? (
              <button
                type="button"
                className="btn-figma-primary"
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                disabled={isUnregisteringDetail}
                onClick={async () => {
                  setIsUnregisteringDetail(true);
                  setDetailUnregisterError(null);
                  try {
                    await onLeaveEvent(activeEventDetail.id);
                    setActiveEventDetail(null);
                  } catch (error) {
                    setDetailUnregisterError(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể hủy đăng ký sự kiện.' : 'Failed to cancel registration.'));
                  } finally {
                    setIsUnregisteringDetail(false);
                  }
                }}
              >
                {isUnregisteringDetail ? (language === 'vi' ? 'Đang hủy đăng ký...' : 'Cancelling...') : (language === 'vi' ? 'Hủy đăng ký' : 'Cancel Registration')}
              </button>
            ) : (
              <button
                type="button"
                className="btn-figma-primary"
                disabled={registeredEventIds.has(activeEventDetail.id) || registrationDeadlinePassed(activeEventDetail.registrationDeadlineAt, registrationNow)}
                onClick={() => {
                  const e = activeEventDetail;
                  setActiveEventDetail(null);
                  handleOpenRegister(e);
                }}
              >
                {registeredEventIds.has(activeEventDetail.id) ? (language === 'vi' ? 'Đã đăng ký' : 'Registered') : registrationDeadlinePassed(activeEventDetail.registrationDeadlineAt, registrationNow) ? (language === 'vi' ? 'Đã quá hạn đăng ký' : 'Registration deadline passed') : (language === 'vi' ? 'Đăng ký tham gia sự kiện này' : 'Register for this Event')}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Simulated Register Modal with Aligned Event Context */}
      {showRegisterModal && createPortal(
        <div
          className="modal-overlay registration-modal-overlay"
          {...registrationBackdropHandlers}
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-modal-title"
        >
          <div
            className={`modal-content modal-register-content ${registeredSuccess ? 'event-feedback-modal' : ''} ${closingSheet === 'register' ? 'is-closing' : ''}`}
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
                    {showRegisterModal.image.url && (
                      <img
                        src={showRegisterModal.image.url}
                        alt={showRegisterModal.image.alt}
                        className="reg-event-thumb"
                      />
                    )}
                  </div>
                  <div className="reg-event-info">
                    <h4 className="reg-event-title">
                      {language === 'vi' ? showRegisterModal.title : showRegisterModal.titleEn}
                    </h4>
                    <div className="reg-event-meta-list">
                      <span className="reg-meta-item">
                        <Clock size={14} />
                        {showRegisterModal.dayOfWeek ? `${showRegisterModal.dayOfWeek}, ` : ''}{showRegisterModal.scheduleStr || `${displayDateText(showRegisterModal.dateStr)} • ${showRegisterModal.timeStr}`}
                      </span>
                      {(language === 'vi' ? showRegisterModal.location : showRegisterModal.locationEn) && (
                        <span className="reg-meta-item">
                          <MapPin size={14} />
                          {language === 'vi' ? showRegisterModal.location : showRegisterModal.locationEn}
                        </span>
                      )}
                      {showRegisterModal.registrationDeadlineAt && (
                        <span className="reg-meta-item">
                          <Clock size={14} />
                          {language === 'vi' ? 'Hạn đăng ký: ' : 'Registration deadline: '}
                          {formatRegistrationDeadline(showRegisterModal.registrationDeadlineAt)}
                        </span>
                      )}
                      {showRegisterModal.speaker && (
                        <span className="reg-meta-item reg-speaker-line">
                          <strong>{language === 'vi' ? 'Diễn giả:' : 'Speaker:'}</strong> {showRegisterModal.speaker}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isStaffAccount && (
                  <p role="note" style={{ padding: '0.75rem 1rem', background: '#FAF8F3', border: '1px solid #E9BC63', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', color: '#8C6519' }}>
                    {language === 'vi'
                      ? 'Tài khoản nhân sự không dùng chức năng độc giả. Vui lòng dùng tài khoản cá nhân để tham gia sự kiện.'
                      : 'Staff accounts do not use reader features. Please use a personal account to join events.'}
                  </p>
                )}

                {!isParticipantAuthenticated && !isStaffAccount && (
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
                    if (registeredEventIds.has(showRegisterModal.id)) return;
                    if (registrationDeadlinePassed(showRegisterModal.registrationDeadlineAt)) return;
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
                  <button type="submit" className="btn-figma-primary reg-submit-button" disabled={registeredEventIds.has(showRegisterModal.id) || registrationDeadlinePassed(showRegisterModal.registrationDeadlineAt, registrationNow)}>
                    <CheckCircle2 size={18} />
                    <span>{registeredEventIds.has(showRegisterModal.id) ? (language === 'vi' ? 'Đã đăng ký' : 'Registered') : registrationDeadlinePassed(showRegisterModal.registrationDeadlineAt, registrationNow) ? (language === 'vi' ? 'Đã quá hạn đăng ký' : 'Registration deadline passed') : (language === 'vi' ? 'Xác nhận Đăng ký Tham dự' : 'Confirm Registration')}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="success-box-center">
                <div className="event-feedback-header">
                  <span className="event-feedback-icon"><CheckCircle2 size={32} aria-hidden="true" /></span>
                  <h3 id="registration-modal-title" className="modal-heading-title">
                    {language === 'vi' ? 'Đăng ký tham dự thành công!' : 'Registration Successful!'}
                  </h3>
                </div>
                <p className="success-event-badge">
                  {language === 'vi' ? showRegisterModal.title : showRegisterModal.titleEn}
                </p>
                <p className="success-desc">
                  {language === 'vi' 
                    ? 'Tài khoản của bạn đã được ghi nhận tham gia sự kiện. Hãy đăng ký hoạt động phù hợp và quét mã QR hoạt động tại nơi diễn ra để điểm danh.'
                    : 'Your account has joined this event. Register for an activity and scan its QR at the venue to check in.'}
                </p>
                <div className="success-actions-row">
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
