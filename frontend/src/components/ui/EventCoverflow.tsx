import { displayDateText } from '../../utils/dateDisplay';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import { useRef, useState } from 'react';
import type { EventItem, Language } from '../../types';
import './EventCoverflow.css';
import { useDeadlineClock } from '../../hooks/useDeadlineClock';
import { registrationDeadlinePassed } from '../../utils/registrationDeadline';

interface EventCoverflowProps {
  registeredEventIds?: ReadonlySet<string>;
  events: EventItem[];
  language: Language;
  weekEventIds: Set<string>;
  isLoading?: boolean;
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
  onDetails: (event: EventItem) => void;
  onRegister: (event: EventItem) => void;
}

export function EventCoverflow({
  registeredEventIds = new Set<string>(),
  events,
  language,
  weekEventIds,
  isLoading = false,
  selectedEventId,
  onSelectEvent,
  onDetails,
  onRegister,
}: EventCoverflowProps) {
  const count = events.length;
  const controlledIndex = selectedEventId
    ? events.findIndex(event => event.id === selectedEventId)
    : -1;
  const [selected, setSelected] = useState(() => (controlledIndex >= 0 ? controlledIndex : 0));
  const [prevControlledIndex, setPrevControlledIndex] = useState(controlledIndex);
  if (controlledIndex !== prevControlledIndex) {
    setPrevControlledIndex(controlledIndex);
    if (controlledIndex >= 0) {
      setSelected(controlledIndex);
    }
  }

  const selectedIndex = count > 0 ? Math.min(Math.max(selected, 0), count - 1) : 0;
  const dragStart = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const current = events[selectedIndex];
  const registrationNow = useDeadlineClock([current?.registrationDeadlineAt]);

  const selectIndex = (index: number) => {
    if (!events[index]) return;
    setSelected(index);
    onSelectEvent?.(events[index].id);
  };

  const move = (step: number) => {
    if (count > 1) selectIndex((selectedIndex + step + count) % count);
  };

  const offsetFor = (index: number) => {
    let offset = index - selectedIndex;
    if (offset > count / 2) offset -= count;
    if (offset < -count / 2) offset += count;
    return offset;
  };

  if (isLoading || events.length === 0) {
    return (
      <div className="event-coverflow skeleton-coverflow" role="region" aria-busy="true" aria-label={language === 'vi' ? 'Đang tải sự kiện' : 'Loading events'}>
        <div className="event-coverflow-stage-wrap">
          <button type="button" className="event-coverflow-arrow" disabled aria-hidden="true">
            <ChevronLeft size={23} />
          </button>
          <div className="event-coverflow-stage" style={{ pointerEvents: 'none' }}>
            <div
              className="event-coverflow-slide skeleton-card"
              style={{
                transform: 'translateX(calc(-50% - 65%)) translateZ(-120px) rotateY(35deg)',
                opacity: 0.65,
                zIndex: 6,
              }}
            >
              <div className="skeleton-box" style={{ width: '100%', height: '100%' }} />
            </div>
            <div
              className="event-coverflow-slide is-selected skeleton-card"
              style={{
                transform: 'translateX(-50%) translateZ(0px) rotateY(0deg)',
                opacity: 1,
                zIndex: 10,
              }}
            >
              <div className="skeleton-box" style={{ width: '100%', height: '100%' }} />
            </div>
            <div
              className="event-coverflow-slide skeleton-card"
              style={{
                transform: 'translateX(calc(-50% + 65%)) translateZ(-120px) rotateY(-35deg)',
                opacity: 0.65,
                zIndex: 6,
              }}
            >
              <div className="skeleton-box" style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          <button type="button" className="event-coverflow-arrow" disabled aria-hidden="true">
            <ChevronRight size={23} />
          </button>
        </div>

        <div className="event-coverflow-details" aria-hidden="true">
          <div className="event-coverflow-details-main" style={{ width: '100%' }}>
            <div className="skeleton-box" style={{ width: '110px', height: '16px', marginBottom: '8px' }} />
            <div className="skeleton-box" style={{ width: '60%', height: '28px', marginBottom: '10px' }} />
            <div className="skeleton-box" style={{ width: '90%', height: '15px', marginBottom: '6px' }} />
            <div className="skeleton-box" style={{ width: '75%', height: '15px', marginBottom: '14px' }} />
            <div className="event-coverflow-meta">
              <div className="skeleton-box" style={{ width: '130px', height: '18px' }} />
              <div className="skeleton-box" style={{ width: '90px', height: '18px' }} />
              <div className="skeleton-box" style={{ width: '150px', height: '18px' }} />
            </div>
          </div>
          <div className="event-coverflow-actions">
            <div className="skeleton-box" style={{ width: '110px', height: '42px', borderRadius: '5px' }} />
            <div className="skeleton-box" style={{ width: '140px', height: '42px', borderRadius: '5px' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-coverflow" role="region" aria-roledescription="carousel" aria-label={language === 'vi' ? 'Sự kiện nổi bật' : 'Featured events'}>
      <div className="event-coverflow-stage-wrap">
        <button type="button" className="event-coverflow-arrow" onClick={() => move(-1)} disabled={count < 2} aria-label={language === 'vi' ? 'Sự kiện trước' : 'Previous event'} title={language === 'vi' ? 'Sự kiện trước' : 'Previous event'}>
          <ChevronLeft size={23} />
        </button>
        <div
          className="event-coverflow-stage"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
            if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
          }}
          onPointerDown={(event) => {
            dragStart.current = event.clientX;
            dragStartY.current = event.clientY;
            suppressClick.current = false;
          }}
          onPointerUp={(event) => {
            if (dragStart.current !== null) {
              const distanceX = event.clientX - dragStart.current;
              const distanceY = dragStartY.current !== null ? Math.abs(event.clientY - dragStartY.current) : 0;
              if (Math.abs(distanceX) > 30 && Math.abs(distanceX) > distanceY) {
                suppressClick.current = true;
                move(distanceX < 0 ? 1 : -1);
              }
            }
            dragStart.current = null;
            dragStartY.current = null;
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            dragStartY.current = null;
          }}
        >
          {events.map((event, index) => {
            const offset = offsetFor(index);
            const distance = Math.abs(offset);
            const visible = distance <= 2;
            return (
              <button
                key={event.id}
                type="button"
                className={`event-coverflow-slide ${index === selectedIndex ? 'is-selected' : ''}`}
                style={{
                  transform: `translateX(calc(-50% + ${offset * 76}%)) translateZ(${-distance * 105}px) rotateY(${-Math.sign(offset) * Math.min(distance * 43, 76)}deg)`,
                  opacity: visible ? 1 - distance * 0.22 : 0,
                  zIndex: 10 - distance,
                  pointerEvents: visible ? 'auto' : 'none',
                }}
                onClick={(clickEvent) => {
                  if (suppressClick.current) {
                    clickEvent.preventDefault();
                    suppressClick.current = false;
                    return;
                  }
                  if (index !== selectedIndex) {
                    selectIndex(index);
                  }
                  onDetails(event);
                }}
                aria-label={`${language === 'vi' ? event.title : event.titleEn}, ${language === 'vi' ? 'xem chi tiết sự kiện' : 'view event details'}`}
                aria-current={index === selectedIndex ? 'true' : undefined}
                tabIndex={visible ? 0 : -1}
              >
                {event.image.url ? (
                  <img src={event.image.url} alt={event.image.alt} draggable={false} loading={distance > 1 ? 'lazy' : 'eager'} />
                ) : (
                  <div className="event-coverflow-slide-placeholder">
                    <CalendarDays size={38} className="placeholder-calendar-icon" />
                    <span className="placeholder-event-title">{language === 'vi' ? event.title : event.titleEn}</span>
                  </div>
                )}
                {registeredEventIds.has(event.id) && (
                  <span className="event-coverflow-registered-badge" data-event-id={event.id}>
                    <CheckCircle2 size={15} aria-hidden="true" />{language === 'vi' ? 'Đã đăng ký' : 'Registered'}
                  </span>
                )}
                {weekEventIds.has(event.id) && (
                  <span className="event-coverflow-week-badge">
                    {language === 'vi' ? 'Trong tuần' : 'This week'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" className="event-coverflow-arrow" onClick={() => move(1)} disabled={count < 2} aria-label={language === 'vi' ? 'Sự kiện tiếp theo' : 'Next event'} title={language === 'vi' ? 'Sự kiện tiếp theo' : 'Next event'}>
          <ChevronRight size={23} />
        </button>
      </div>

      <div className="event-coverflow-details" aria-live="polite">
        <div className="event-coverflow-details-main">
          <span className="event-coverflow-kicker">{language === 'vi' ? current.typeLabelVi : current.typeLabelEn}</span>
          <h3>{language === 'vi' ? current.title : current.titleEn}</h3>
          <p>{language === 'vi' ? current.summary : current.summaryEn}</p>
          <div className="event-coverflow-meta">
            {current.scheduleStr ? (
              <span><CalendarDays size={16} />{current.dayOfWeek ? `${current.dayOfWeek}, ` : ''}{current.scheduleStr}</span>
            ) : (
              <>
                <span><CalendarDays size={16} />{current.dayOfWeek ? `${current.dayOfWeek}, ` : ''}{displayDateText(current.dateStr)}</span>
                <span><Clock3 size={16} />{current.timeStr}</span>
              </>
            )}
            {Boolean(((language === 'vi' ? current.location : current.locationEn) || '').trim()) && (
              <span><MapPin size={16} />{language === 'vi' ? current.location : current.locationEn}</span>
            )}
          </div>
        </div>
        <div className="event-coverflow-actions">
          <button type="button" className="event-coverflow-detail-btn" onClick={() => onDetails(current)}>{language === 'vi' ? 'Xem chi tiết' : 'View details'}</button>
          <button type="button" className={`event-coverflow-register-btn ${registeredEventIds.has(current.id) ? 'is-registered' : ''}`} disabled={registeredEventIds.has(current.id) || registrationDeadlinePassed(current.registrationDeadlineAt, registrationNow)} onClick={() => onRegister(current)}>{registeredEventIds.has(current.id) ? (language === 'vi' ? 'Đã đăng ký' : 'Registered') : registrationDeadlinePassed(current.registrationDeadlineAt, registrationNow) ? (language === 'vi' ? 'Đã quá hạn đăng ký' : 'Registration deadline passed') : (language === 'vi' ? 'Đăng ký tham gia' : 'Register')}</button>
        </div>
      </div>
      {count > 1 && <div className="event-coverflow-pagination" aria-label={language === 'vi' ? 'Chọn sự kiện' : 'Choose event'}>
        {events.map((event, index) => <button key={event.id} type="button" className={index === selectedIndex ? 'is-selected' : ''} aria-label={`${language === 'vi' ? 'Sự kiện' : 'Event'} ${index + 1}`} aria-current={index === selectedIndex ? 'true' : undefined} onClick={() => selectIndex(index)} />)}
      </div>}
    </div>
  );
}
