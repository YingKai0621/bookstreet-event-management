import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import type { EventItem, Language } from '../../types';
import './EventCoverflow.css';

interface EventCoverflowProps {
  events: EventItem[];
  language: Language;
  weekEventIds: Set<string>;
  onDetails: (event: EventItem) => void;
  onRegister: (event: EventItem) => void;
}

export function EventCoverflow({ events, language, weekEventIds, onDetails, onRegister }: EventCoverflowProps) {
  const [selected, setSelected] = useState(0);
  const dragStart = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const count = events.length;
  const current = events[Math.min(selected, count - 1)];

  useEffect(() => {
    if (selected >= count && count > 0) setSelected(0);
  }, [count, selected]);

  const move = (step: number) => {
    if (count > 1) setSelected((index) => (index + step + count) % count);
  };

  const offsetFor = (index: number) => {
    let offset = index - selected;
    if (offset > count / 2) offset -= count;
    if (offset < -count / 2) offset += count;
    return offset;
  };

  if (!current) {
    return <p className="event-coverflow-empty">{language === 'vi' ? 'Chưa có sự kiện nào.' : 'No events yet.'}</p>;
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
          onPointerDown={(event) => { dragStart.current = event.clientX; suppressClick.current = false; }}
          onPointerUp={(event) => {
            if (dragStart.current !== null) {
              const distance = event.clientX - dragStart.current;
              if (Math.abs(distance) > 35) {
                suppressClick.current = true;
                move(distance < 0 ? 1 : -1);
              }
            }
            dragStart.current = null;
          }}
          onPointerCancel={() => { dragStart.current = null; }}
        >
          {events.map((event, index) => {
            const offset = offsetFor(index);
            const distance = Math.abs(offset);
            const visible = distance <= 2;
            return (
              <button
                key={event.id}
                type="button"
                className={`event-coverflow-slide ${index === selected ? 'is-selected' : ''}`}
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
                  if (index === selected) onDetails(event);
                  else setSelected(index);
                }}
                aria-label={`${language === 'vi' ? event.title : event.titleEn}${index === selected ? '' : language === 'vi' ? ', chọn sự kiện' : ', select event'}`}
                aria-current={index === selected ? 'true' : undefined}
                tabIndex={visible ? 0 : -1}
              >
                <img src={event.image.url || undefined} alt={event.image.alt} draggable={false} loading={distance > 1 ? 'lazy' : 'eager'} />
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
            <span><CalendarDays size={16} />{current.dayOfWeek ? `${current.dayOfWeek}, ` : ''}{current.dateStr}</span>
            <span><Clock3 size={16} />{current.timeStr}</span>
            <span><MapPin size={16} />{language === 'vi' ? current.location : current.locationEn}</span>
          </div>
        </div>
        <div className="event-coverflow-actions">
          <button type="button" className="event-coverflow-detail-btn" onClick={() => onDetails(current)}>{language === 'vi' ? 'Xem chi tiết' : 'View details'}</button>
          <button type="button" className="event-coverflow-register-btn" onClick={() => onRegister(current)}>{language === 'vi' ? 'Đăng ký tham gia' : 'Register'}</button>
        </div>
      </div>
      {count > 1 && <div className="event-coverflow-pagination" aria-label={language === 'vi' ? 'Chọn sự kiện' : 'Choose event'}>
        {events.map((event, index) => <button key={event.id} type="button" className={index === selected ? 'is-selected' : ''} aria-label={`${language === 'vi' ? 'Sự kiện' : 'Event'} ${index + 1}`} aria-current={index === selected ? 'true' : undefined} onClick={() => setSelected(index)} />)}
      </div>}
    </div>
  );
}
