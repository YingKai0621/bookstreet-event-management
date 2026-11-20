import { displayDateText } from '../../utils/dateDisplay';
import { PaginatedList } from '../ui/PaginatedList';
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi, type PartnerAvailableEvent } from '../../services/partnerApi';
import type { Language } from '../../types';
import { PartnerDialog } from './PartnerDialog';
import './PartnerEvents.css';
import { vietnamDateKey, partnerDateTime } from './partnerEventDates';

export function PartnerEventCalendar({ language, events: suppliedEvents, onSelectEvent, onAddDate }: {
  language: Language;
  events?: PartnerAvailableEvent[];
  onSelectEvent?: (event: PartnerAvailableEvent) => void;
  onAddDate?: (date: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const today = vietnamDateKey(new Date(now));
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'upcoming'>('all');
  const [loadedEvents, setLoadedEvents] = useState<PartnerAvailableEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(suppliedEvents === undefined);
  const [revision, setRevision] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const events = suppliedEvents ?? loadedEvents;
  useEffect(() => {
    if (suppliedEvents !== undefined) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await partnerApi.getPublishedEvents();
        if (active) { setLoadedEvents(rows); setError(''); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sự kiện.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('duongsach:data-changed', refresh);
    return () => { active = false; window.removeEventListener('duongsach:data-changed', refresh); };
  }, [suppliedEvents, revision]);

  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index - offset + 1));
    return { key: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === monthNumber - 1 };
  });
  const filtered = events.filter(event => filter === 'all' || (filter === 'ongoing'
    ? new Date(event.startAt).getTime() <= now && new Date(event.endAt).getTime() > now
    : new Date(event.startAt).getTime() > now));
  const onDate = (date: string) => filtered.filter(event => {
    // Treat endAt as exclusive: an event ending at midnight does not occupy the next day.
    return vietnamDateKey(event.startAt) <= date
      && vietnamDateKey(new Date(new Date(event.endAt).getTime() - 1)) >= date;
  });
  const shiftMonth = (amount: number) => setMonth(new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7));
  const weekdayLabels = language === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return <section className="partner-calendar" aria-label={language === 'vi' ? 'Lịch sự kiện' : 'Event calendar'}>
    <div className="partner-calendar-heading"><div>
      <h2>{first.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2></div>
      <div className="partner-calendar-controls"><button className="partner-square-button" aria-label="Tháng trước" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button>
        <button className="btn-part-secondary" onClick={() => setMonth(today.slice(0, 7))}>{language === 'vi' ? 'Hôm nay' : 'Today'}</button>
        <button className="partner-square-button" aria-label="Tháng sau" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button></div>
    </div>
    <div className="partner-calendar-toolbar"><div className="partner-filter-pills">{(['all', 'ongoing', 'upcoming'] as const).map((value, index) =>
      <button key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {(language === 'vi' ? ['Tất cả', 'Đang diễn ra', 'Sắp tới'] : ['All', 'Ongoing', 'Upcoming'])[index]}</button>)}</div>
      <span>{language === 'vi' ? 'Chọn ngày để xem lịch hoặc thêm đề xuất' : 'Select a day to view events or add a proposal'}</span></div>
    {loading && <p role="status" className="partner-muted">{language === 'vi' ? 'Đang tải lịch…' : 'Loading calendar…'}</p>}
    {error && <div role="alert" className="partner-form-alert error">{error}<button className="btn-part-secondary" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Thử lại</button></div>}
    <div className="partner-calendar-scroll"><div className="partner-calendar-weekdays">{weekdayLabels.map(day => <span key={day}>{day}</span>)}</div>
      <div className="partner-calendar-grid">{cells.map(cell => {
        const dayEvents = onDate(cell.key);
        const isPast = cell.key < today;
        return <div key={cell.key} className={`partner-calendar-cell ${!cell.inMonth ? 'is-outside' : ''} ${cell.key === today ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}>
          <div className="partner-calendar-cell-top"><button className="partner-calendar-day" aria-label={`Xem lịch ngày ${displayDateText(cell.key)}`} onClick={() => setSelectedDay(cell.key)}>{cell.day}</button>
            {cell.inMonth && !isPast && <button className="partner-calendar-add" aria-label={`Thêm đề xuất ngày ${displayDateText(cell.key)}`} onClick={() => onAddDate ? onAddDate(cell.key) : setSelectedDay(cell.key)}><Plus size={14} /></button>}</div>
          {dayEvents.slice(0, 2).map(event => <button key={event.id} className="partner-calendar-event" onClick={() => onSelectEvent ? onSelectEvent(event) : setSelectedDay(cell.key)}>
            <span>{new Date(event.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</span><strong>{event.name}</strong></button>)}
          {dayEvents.length > 2 && <button className="partner-calendar-more" onClick={() => setSelectedDay(cell.key)}>+{dayEvents.length - 2} {language === 'vi' ? 'sự kiện' : 'events'}</button>}
        </div>;
      })}</div></div>
    {!loading && !error && !cells.some(cell => onDate(cell.key).length) && <p className="partner-calendar-empty">{language === 'vi' ? 'Chưa có sự kiện phù hợp trong tháng này. Bạn có thể chuyển tháng hoặc đổi bộ lọc.' : 'No matching events this month. Try another month or filter.'}</p>}
    {selectedDay && (() => {
      const isSelectedPast = selectedDay < today;
      return <PartnerDialog title={`${language === 'vi' ? 'Lịch ngày' : 'Schedule for'} ${selectedDay.split('-').reverse().join('/')}`} onClose={() => setSelectedDay(null)}>
      <div className="partner-dialog-body"><PaginatedList items={onDate(selectedDay)}>{pageItems => (<div className="partner-day-events">{pageItems.map(event => <article key={event.id}><h3>{event.name}</h3><p>{partnerDateTime(event.startAt, language)} – {partnerDateTime(event.endAt, language)}</p><p>{event.description}</p>
        {onSelectEvent ? <button className="btn-part-secondary" onClick={() => { setSelectedDay(null); onSelectEvent(event); }}>{language === 'vi' ? 'Xem chi tiết' : 'View Details'}</button> : <Link className="btn-part-secondary" to={`/partner/events/apply?event=${encodeURIComponent(event.id)}`}>{isSelectedPast ? (language === 'vi' ? 'Xem chi tiết' : 'View details') : (language === 'vi' ? 'Xem chi tiết / đăng ký' : 'View details / apply')}</Link>}</article>)}</div>)}</PaginatedList>
        {onDate(selectedDay).length === 0 && <p className="partner-muted">{language === 'vi' ? 'Ngày này chưa có sự kiện.' : 'No events on this day.'}</p>}
        {!isSelectedPast && (onAddDate ? <button className="btn-part-primary" onClick={() => { const date = selectedDay; setSelectedDay(null); onAddDate(date); }}><Plus size={16} />{language === 'vi' ? 'Thêm đề xuất' : 'Add proposal'}</button>
          : <Link className="btn-part-primary" to={`/partner/events/apply?proposeDate=${selectedDay}`}><Plus size={16} />{language === 'vi' ? 'Thêm đề xuất vào ngày này' : 'Propose event on this day'}</Link>)}
      </div>
    </PartnerDialog>;
    })()}
  </section>;
}
