import { CalendarDays } from 'lucide-react';
import type { EventItem, Language } from '../../types';
import './PublicEventContext.css';

interface PublicEventContextProps {
  language: Language;
  event?: EventItem;
}

export function PublicEventContext({ language, event }: PublicEventContextProps) {
  if (!event) return null;

  const vi = language === 'vi';
  const title = vi ? event.title : event.titleEn;

  return (
    <div
      className="public-event-context"
      aria-label={`${vi ? 'Sự kiện đang xem' : 'Current event'}: ${title}`}
    >
      <div className="public-event-context-icon">
        <CalendarDays size={18} aria-hidden="true" />
      </div>
      <div className="public-event-context-body">
        <span className="public-event-context-label">{vi ? 'Đang xem theo sự kiện:' : 'Viewing event:'}</span>
        <strong className="public-event-context-title">{title}</strong>
      </div>
    </div>
  );
}
