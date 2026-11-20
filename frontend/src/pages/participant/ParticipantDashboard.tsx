import { displayDateText } from '../../utils/dateDisplay';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarCheck,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Star,
  Tag,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationCallout } from '../../components/ui/NotificationCallout';
import { Language, ParticipantActivity, ParticipantEvent, ParticipantProfile } from '../../types';
import './ParticipantPages.css';
import './ParticipantCalendar.css';
import { useDeadlineClock } from '../../hooks/useDeadlineClock';
import { registrationDeadlinePassed } from '../../utils/registrationDeadline';

interface ParticipantDashboardProps {
  language: Language;
  profile: ParticipantProfile;
  totalPoints: number;
  events: ParticipantEvent[];
  activities: ParticipantActivity[];
  totalCertificatesCount: number;
  onJoinEvent?: (eventId: string) => void | Promise<void>;
  onLeaveEvent?: (eventId: string) => void | Promise<void>;
  onRegisterActivity?: (activityId: string) => void | Promise<void>;
  onCancelActivity?: (activityId: string) => void | Promise<void>;
}

interface CalendarEventItem {
  registrationDeadlineAt?: string | null;
  id: string;
  title: string;
  time?: string;
  category?: string;
  location?: string;
  type: 'event' | 'activity';
  link: string;
  badgeColor?: string;
  status?: 'happening' | 'upcoming' | 'ended';
  isRegistered?: boolean;
  canCancel?: boolean;
  shortDesc?: string;
  dateStr?: string;
}

export const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({
  language,
  profile,
  totalPoints,
  events,
  activities,
  totalCertificatesCount,
  onJoinEvent,
  onLeaveEvent,
  onRegisterActivity,
  onCancelActivity,
}) => {
  // Chỉ lấy những hoạt động người dùng thực sự đã đăng ký (status === 'registered' hoặc 'attended')
  const registeredActivities = activities.filter(a => a.status === 'registered' || a.status === 'attended');
  const registrationNow = useDeadlineClock(events.map(event => event.registrationDeadlineAt));

  const vietnamToday = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  })();
  const initialCalendarDate = new Date(`${vietnamToday}T00:00:00`);
  const [currentYear, setCurrentYear] = useState(initialCalendarDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialCalendarDate.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(vietnamToday);
  const [activeFilter, setActiveFilter] = useState<'all' | 'happening' | 'upcoming'>('all');

  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    day: number;
    dateStr: string;
    events: CalendarEventItem[];
  } | null>(null);
  const [confirmingEventSnapshot, setConfirmingEvent] = useState<CalendarEventItem | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registerSuccessToast, setRegisterSuccessToast] = useState<string | null>(null);
  useModalDismiss(Boolean(selectedDayEvents), () => setSelectedDayEvents(null));
  useModalDismiss(Boolean(confirmingEventSnapshot), () => { if (!isRegistering) setConfirmingEvent(null); });
  const calendarBackdropHandlers = useBackdropClick(() => setSelectedDayEvents(null));
  const registrationBackdropHandlers = useBackdropClick(() => { if (!isRegistering) setConfirmingEvent(null); });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(year => year - 1);
    } else {
      setCurrentMonth(month => month - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(year => year + 1);
    } else {
      setCurrentMonth(month => month + 1);
    }
  };

  const statusForDate = (date: string): CalendarEventItem['status'] => {
    return date < vietnamToday ? 'ended' : date === vietnamToday ? 'happening' : 'upcoming';
  };

  const activitiesOnDate = (date: string) => (date < vietnamToday ? [] : activities)
    .filter(activity => {
      const isoDate = activity.date.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
      const match = activity.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const activityDate = isoDate || (match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '');
      return activityDate === date;
    })
    .map(activity => ({
      id: activity.id,
      title: activity.title,
      time: activity.time,
      location: activity.venue,
      category: activity.category,
      type: 'activity' as const,
      link: `/participant/activities/detail/${activity.id}`,
      badgeColor: '#0E7490',
      status: statusForDate(date),
      isRegistered: activity.status === 'registered' || activity.status === 'attended',
      canCancel: activity.status === 'registered' && statusForDate(date) !== 'ended',
      shortDesc: activity.description,
      dateStr: date,
    }));

  const getEventsForDay = (day: number): CalendarEventItem[] => {
    const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const calendarEvents = events
      .filter(event => {
        const dates = event.dateRange.match(/\d{4}-\d{2}-\d{2}/g) || [];
        const startDate = dates[0];
        const endDate = dates[1] || startDate;
        return Boolean(startDate && endDate && date >= startDate && date <= endDate);
      })
      .map(event => {
        const times = event.dateRange.match(/\d{2}:\d{2}/g) || [];
        const timeStr = times.length >= 2 ? `${times[0]} – ${times[1]}` : (times[0] || '');
        return {
          id: event.id,
          title: event.title,
          time: timeStr,
          location: event.location,
          category: language === 'vi' ? 'Sự kiện' : 'Event',
          type: 'event' as const,
          link: `/participant/events/${event.id}`,
          badgeColor: '#185E48',
          status: event.status === 'ended' ? ('ended' as const) : statusForDate(date),
          isRegistered: event.isJoined,
          canCancel: event.isJoined && event.status !== 'ended',
          registrationDeadlineAt: event.registrationDeadlineAt,
          shortDesc: event.shortDesc,
          dateStr: event.dateRange,
        };
      });
    const list = [...calendarEvents, ...activitiesOnDate(date)];
    return activeFilter === 'all' ? list : list.filter(event => event.status === activeFilter);
  };

  // Build calendar matrix
  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const calendarCells: Array<{
    day: number;
    dateStr: string;
    isCurrentMonth: boolean;
    events: CalendarEventItem[];
  }> = [];

  // Prev month padding
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = currentMonth === 0 ? 12 : currentMonth;
    const y = currentMonth === 0 ? currentYear - 1 : currentYear;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      dateStr,
      isCurrentMonth: false,
      events: []
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      dateStr,
      isCurrentMonth: true,
      events: getEventsForDay(d)
    });
  }

  // Next month padding to fill complete grid of 35 or 42
  const totalSlots = Math.ceil(calendarCells.length / 7) * 7;
  const remaining = totalSlots - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = currentMonth === 11 ? 1 : currentMonth + 2;
    const y = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      dateStr,
      isCurrentMonth: false,
      events: []
    });
  }

  const monthNamesVi = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = language === 'vi' ? monthNamesVi[currentMonth] : monthNamesEn[currentMonth];
  const confirmingEvent = confirmingEventSnapshot
    ? calendarCells.flatMap(cell => cell.events).find(item => item.id === confirmingEventSnapshot.id && item.type === confirmingEventSnapshot.type) || confirmingEventSnapshot
    : null;
  const registrationLabel = (registered?: boolean, deadline?: string | null) => registered
    ? (language === 'vi' ? 'Đã đăng ký' : 'Registered')
    : registrationDeadlinePassed(deadline, registrationNow)
      ? (language === 'vi' ? 'Đã quá hạn đăng ký' : 'Registration deadline passed')
      : (language === 'vi' ? 'Chưa đăng ký' : 'Not registered');

  const upcomingEventsList: Array<CalendarEventItem & { cellDateStr: string; displayDate: string }> = (() => {
    const list: Array<CalendarEventItem & { cellDateStr: string; displayDate: string }> = [];
    const seen = new Set<string>();

    for (const cell of calendarCells) {
      for (const ev of cell.events) {
        const key = `${ev.type}-${ev.id}`;
        if (!seen.has(key) && cell.dateStr >= vietnamToday) {
          seen.add(key);
          const cellDate = new Date(`${cell.dateStr}T12:00:00`);
          const formatted = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
            day: 'numeric',
            month: 'numeric',
          }).format(cellDate);
          list.push({
            ...ev,
            cellDateStr: cell.dateStr,
            displayDate: formatted,
          });
        }
      }
    }
    return list.sort((a, b) => a.cellDateStr.localeCompare(b.cellDateStr));
  })();

  // Handler when clicking on an event chip
  const handleEventClick = (ev: CalendarEventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRegistrationError('');

    // Luôn mở popup đăng ký / chi tiết sự kiện
    setConfirmingEvent(ev);
  };

  // Perform registration on confirmation
  const handleConfirmRegistration = async () => {
    if (!confirmingEvent || isRegistering || confirmingEvent.isRegistered) return;
    if (registrationDeadlinePassed(confirmingEvent.registrationDeadlineAt)) return;
    setIsRegistering(true);
    setRegistrationError('');

    try {
      if (confirmingEvent.type === 'event') {
        if (!onJoinEvent) throw new Error(language === 'vi' ? 'Chưa thể đăng ký sự kiện. Vui lòng tải lại trang.' : 'Registration unavailable. Reload the page.');
        await onJoinEvent(confirmingEvent.id);
      } else {
        if (!onRegisterActivity) throw new Error(language === 'vi' ? 'Chưa thể đăng ký hoạt động. Vui lòng tải lại trang.' : 'Registration unavailable. Reload the page.');
        await onRegisterActivity(confirmingEvent.id);
      }
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể đăng ký. Vui lòng thử lại.' : 'Registration failed. Please try again.'));
      return;
    } finally {
      setIsRegistering(false);
    }

    const title = confirmingEvent.title;
    setConfirmingEvent(null);
    setSelectedDayEvents(null);

    // Show toast
    setRegisterSuccessToast(language === 'vi' ? `Đăng ký thành công "${title}"! Đã thêm vào mục Sự kiện của tôi.` : `Successfully registered for "${title}"! Added to My Events.`);
    setTimeout(() => {
      setRegisterSuccessToast(null);
    }, 4500);
  };

  const handleCancelRegistration = async () => {
    if (!confirmingEvent || isRegistering || !confirmingEvent.isRegistered) return;
    setIsRegistering(true);
    setRegistrationError('');

    try {
      if (confirmingEvent.type === 'event') {
        if (!onLeaveEvent) throw new Error(language === 'vi' ? 'Chưa thể hủy đăng ký sự kiện. Vui lòng tải lại trang.' : 'Cancellation unavailable. Reload the page.');
        await onLeaveEvent(confirmingEvent.id);
      } else {
        if (!onCancelActivity) throw new Error(language === 'vi' ? 'Chưa thể hủy đăng ký hoạt động. Vui lòng tải lại trang.' : 'Cancellation unavailable. Reload the page.');
        await onCancelActivity(confirmingEvent.id);
      }
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể hủy đăng ký. Vui lòng thử lại.' : 'Cancellation failed. Please try again.'));
      return;
    } finally {
      setIsRegistering(false);
    }

    const title = confirmingEvent.title;
    setConfirmingEvent(null);
    setSelectedDayEvents(null);

    setRegisterSuccessToast(language === 'vi' ? `Đã hủy đăng ký "${title}".` : `Cancelled registration for "${title}".`);
    setTimeout(() => {
      setRegisterSuccessToast(null);
    }, 4500);
  };

  return (
    <div className="participant-dashboard-view">
      {/* Registration Success Toast Notification */}
      {registerSuccessToast && (
        <NotificationCallout
          variant="success"
          title={language === 'vi' ? 'Cập nhật đăng ký' : 'Registration update'}
          floating
        >
          {registerSuccessToast}
          <button
            type="button"
            onClick={() => setRegisterSuccessToast(null)}
            style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', marginLeft: '0.5rem' }}
            aria-label={language === 'vi' ? 'Đóng thông báo' : 'Dismiss notification'}
          >
            <X size={16} />
          </button>
        </NotificationCallout>
      )}

      {/* 1. Header with Welcome Greeting */}
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">
          {language === 'vi' ? `Xin chào, ${profile.name}!` : `Welcome back, ${profile.name}!`}
        </h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {language === 'vi'
            ? 'Theo dõi lịch sự kiện và các hoạt động văn hóa đọc hấp dẫn diễn ra tại Đường Sách TP.HCM.'
            : 'Track literary events and community reading activities on HCMC Book Street calendar.'}
        </p>
      </div>

      {/* 2. Stat Cards */}
      <div className="participant-summary-grid dashboard-stat-grid">
        {/* Card 1: Joined Events */}
        <Link to="/participant/events" className="summary-stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-number-box">
            {registeredActivities.length}
          </div>
          <div className="stat-label-text">
            {language === 'vi' ? 'Hoạt động đã đăng ký' : 'Registered Activities'}
          </div>
        </Link>

        {/* Card 2: Total Points with Star */}
        <Link to="/participant/rewards" className="summary-stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-number-box gold">
            <Star size={24} className="stat-star-icon" />
            <span>{totalPoints}</span>
          </div>
          <div className="stat-label-text">
            {language === 'vi' ? 'Điểm tích lũy' : 'Accumulated Points'}
          </div>
        </Link>

        {/* Card 3: Certificates */}
        <Link to="/participant/certificates" className="summary-stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-number-box">
            <Award size={22} className="stat-badge-icon" />
            <span>{totalCertificatesCount}</span>
          </div>
          <div className="stat-label-text">
            {language === 'vi' ? 'Chứng nhận đạt được' : 'Certificates'}
          </div>
        </Link>
      </div>

      {/* 3. CALENDAR CARD (WITH RESPONSIVE SWIPE ON MOBILE) */}
      <div className="dashboard-calendar-card">
        {/* Top Header: Month title with nav arrows on left, Filter tabs on right */}
        <div className="dashboard-calendar-header">
          {/* Left Month & Nav */}
          <div className="dashboard-calendar-title-wrap">
            <h2 className="dashboard-calendar-month-title">
              {currentMonthName} <span style={{ color: '#8C6519', fontWeight: 600 }}>{currentYear}</span>
            </h2>

            <div className="dashboard-calendar-nav-btns">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Tháng trước"
                className="calendar-arrow-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Tháng sau"
                className="calendar-arrow-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Right Filter Tabs */}
          <div className="dashboard-calendar-filter-tabs">
            <button
              type="button"
              className={`partner-tab-btn ${activeFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              {language === 'vi' ? 'Tất cả sự kiện' : 'All Events'}
            </button>
            <button
              type="button"
              className={`partner-tab-btn ${activeFilter === 'happening' ? 'is-active' : ''}`}
              onClick={() => setActiveFilter('happening')}
            >
              {language === 'vi' ? 'Đang diễn ra' : 'Happening'}
            </button>
            <button
              type="button"
              className={`partner-tab-btn ${activeFilter === 'upcoming' ? 'is-active' : ''}`}
              onClick={() => setActiveFilter('upcoming')}
            >
              {language === 'vi' ? 'Sắp tới' : 'Upcoming'}
            </button>
          </div>
        </div>

        <div className="participant-calendar-legend" aria-label={language === 'vi' ? 'Trạng thái trên lịch' : 'Calendar status'}>
          <span className="is-registered"><CheckCircle2 size={14} />{registrationLabel(true)}</span>
          <span className="is-unregistered"><CalendarIcon size={14} />{registrationLabel(false)}</span>
        </div>
        {/* Scrollable Calendar Area on Mobile */}
        <div className="dashboard-calendar-scroll-wrap">
          <div className="dashboard-calendar-inner-grid">
            {/* Weekday Columns Header */}
            <div className="dashboard-weekdays-row">
              <div>{language === 'vi' ? 'THỨ 2' : 'MON'}</div>
              <div>{language === 'vi' ? 'THỨ 3' : 'TUE'}</div>
              <div>{language === 'vi' ? 'THỨ 4' : 'WED'}</div>
              <div>{language === 'vi' ? 'THỨ 5' : 'THU'}</div>
              <div>{language === 'vi' ? 'THỨ 6' : 'FRI'}</div>
              <div>{language === 'vi' ? 'THỨ 7' : 'SAT'}</div>
              <div style={{ color: '#DC2626' }}>{language === 'vi' ? 'CHỦ NHẬT' : 'SUN'}</div>
            </div>

            {/* 7-Column Days Grid */}
            <div className="dashboard-days-grid">
              {calendarCells.map((cell, idx) => {
                const hasEvents = cell.events.length > 0;
                const isSelected = cell.dateStr === selectedDateStr;
                const isToday = cell.dateStr === vietnamToday;
                const maxVisible = 2;
                const visibleEvents = cell.events.slice(0, maxVisible);
                const extraCount = cell.events.length - maxVisible;

                return (
                  <div
                    key={idx}
                    className={`participant-calendar-day ${hasEvents ? 'has-events' : ''} ${cell.events.some(item => item.isRegistered) ? 'has-registrations' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${displayDateText(cell.dateStr)}, ${cell.events.length} ${language === 'vi' ? 'sự kiện' : 'events'}`}
                    aria-pressed={isSelected}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDateStr(cell.dateStr);
                      }
                    }}
                    onClick={() => {
                      setSelectedDateStr(cell.dateStr);
                      if (hasEvents) {
                        if (cell.events.length > 1) {
                          setSelectedDayEvents({
                            day: cell.day,
                            dateStr: displayDateText(cell.dateStr),
                            events: cell.events
                          });
                        }
                      }
                    }}
                    style={{
                      minHeight: '148px',
                      padding: '8px',
                      borderRadius: '12px',
                      background: isSelected
                        ? '#F0F7F4'
                        : hasEvents
                          ? '#FCFAF6'
                          : cell.isCurrentMonth
                            ? '#FFFFFF'
                            : '#FAFAFA',
                      border: isSelected
                        ? '2px solid #17382E'
                        : hasEvents
                          ? '1px solid #EAE0CE'
                          : '1px solid #EEF2F0',
                      cursor: hasEvents ? 'pointer' : 'default',
                      opacity: cell.isCurrentMonth ? 1 : 0.35,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      transition: 'all 160ms cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected
                        ? '0 4px 16px rgba(23, 56, 46, 0.12)'
                        : hasEvents
                          ? '0 2px 8px rgba(0, 0, 0, 0.02)'
                          : 'none'
                    }}
                  >
                    {/* Header of Cell: Day Number + Event Badge / + Trống */}
                    <div className="participant-calendar-day-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px'
                    }}>
                      <span className={`participant-day-number${isToday ? ' is-today' : ''}`} style={{
                        fontSize: '0.88rem',
                        fontWeight: isSelected || isToday ? 850 : 650,
                        color: isToday ? '#FFFFFF' : isSelected ? '#17382E' : '#2C3E3A',
                        width: isToday ? '26px' : 'auto',
                        height: isToday ? '26px' : 'auto',
                        borderRadius: isToday ? '50%' : 'none',
                        background: isToday ? '#17382E' : 'transparent',
                        display: 'grid',
                        placeItems: 'center'
                      }}>
                        {cell.day}
                      </span>

                      {hasEvents ? (
                        <span className="participant-day-count-badge" style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: cell.events.length > 2 ? '#FEF3C7' : '#E8F5EF',
                          color: cell.events.length > 2 ? '#92400E' : '#065F46',
                          padding: '1px 6px',
                          borderRadius: '10px'
                        }}>
                          {cell.events.length} sự kiện
                        </span>
                      ) : (
                        <span className="participant-day-empty-badge"
                          style={{ fontSize: '0.7rem', color: '#B3BDB9', opacity: 0.6 }}
                        >
                          + Trống
                        </span>
                      )}
                    </div>

                    {/* Mobile Dots Indicator (Inside cell at bottom on mobile) */}
                    <div className="participant-calendar-mobile-dots" aria-hidden="true">
                      {cell.events.slice(0, 3).map((ev, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`calendar-day-dot ${ev.isRegistered ? 'dot-registered' : 'dot-unregistered'}`}
                        />
                      ))}
                    </div>

                    {/* Event Chips (Max 2) */}
                    {hasEvents && (
                      <div className="participant-calendar-chips-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                        {visibleEvents.map((ev) => {
                          const isJoined = ev.isRegistered;
                          const borderColor = isJoined ? '#78B99D' : '#DEC994';
                          const leftBarColor = isJoined ? '#185E48' : '#976512';
                          const bgCard = isJoined ? '#E8F5EF' : '#FFFAED';

                          return (
                            <div
                              key={`${ev.type}-${ev.id}`}
                              className={`participant-calendar-entry ${isJoined ? 'is-registered' : 'is-unregistered'}`}
                              data-calendar-id={`${ev.type}-${ev.id}`}
                              data-registered={Boolean(isJoined)}
                              onClick={(e) => handleEventClick(ev, e)}
                              style={{
                                borderRadius: '8px',
                                background: bgCard,
                                border: `1.5px solid ${borderColor}`,
                                borderLeft: `4px solid ${leftBarColor}`,
                                padding: '6px 7px',
                                boxShadow: isJoined ? '0 1px 4px rgba(16, 185, 129, 0.1)' : '0 1px 4px rgba(239, 68, 68, 0.1)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                transition: 'all 140ms ease'
                              }}
                              title={ev.isRegistered ? `${ev.title} (Đã tham gia - Nhấn để xem chi tiết)` : `${ev.title} (Chưa tham gia - Nhấn để đăng ký)`}
                            >
                              {/* 1. Time on 1 clean straight line at top */}
                              <div style={{
                                fontSize: '0.68rem',
                                fontWeight: 750,
                                color: isJoined ? '#185E48' : '#80570E',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3.5px',
                                whiteSpace: 'nowrap'
                              }}>
                                <Clock size={11} style={{ flexShrink: 0 }} />
                                <span>{ev.time}</span>
                              </div>

                              {/* 2. Event Title in the middle */}
                              <div style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                lineHeight: 1.35,
                                color: '#172421',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                marginTop: '1px',
                                marginBottom: '2px'
                              }}>
                                {ev.title}
                              </div>

                              {/* 3. Participation Status at the bottom */}
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {ev.isRegistered ? (
                                  <span style={{
                                    fontSize: '0.63rem',
                                    fontWeight: 800,
                                    background: '#ECFDF5',
                                    color: '#059669',
                                    border: '1px solid #A7F3D0',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <CheckCircle2 size={10} />
                                    <span>{registrationLabel(true)}</span>
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 750,
                                    background: '#FFF4D5',
                                    color: '#80570E',
                                    border: '1px solid #DEC994',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <span>{registrationLabel(false, ev.registrationDeadlineAt)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Button Xem Thêm if > 2 events */}
                        {extraCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateStr(cell.dateStr);
                              setSelectedDayEvents({
                                day: cell.day,
                                dateStr: displayDateText(cell.dateStr),
                                events: cell.events
                              });
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: '#FFFBEB',
                              border: '1px dashed #F59E0B',
                              color: '#B45309',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              textAlign: 'center',
                              cursor: 'pointer',
                              marginTop: '2px',
                              display: 'block',
                              width: '100%',
                              transition: 'all 140ms ease'
                            }}
                          >
                            + Xem thêm {extraCount} sự kiện...
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <section className="participant-mobile-agenda" aria-live="polite" aria-label={language === 'vi' ? 'Lịch trong ngày' : 'Daily schedule'}>
          <div className="participant-agenda-heading">
            <div className="agenda-heading-date">
              <h3>{new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${selectedDateStr}T12:00:00`))}</h3>
              <span className="agenda-event-count">
                {(calendarCells.find(cell => cell.dateStr === selectedDateStr)?.events || []).length} {language === 'vi' ? 'hoạt động' : 'activities'}
              </span>
            </div>
            <Link to="/participant/events" className="agenda-view-all-link">
              {language === 'vi' ? 'Sự kiện của tôi' : 'My events'} →
            </Link>
          </div>

          <div className="participant-agenda-list">
            {(calendarCells.find(cell => cell.dateStr === selectedDateStr)?.events || []).map(item => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className={`participant-agenda-item ${item.isRegistered ? 'is-registered' : 'is-unregistered'}`}
                data-calendar-id={`${item.type}-${item.id}`}
                data-registered={Boolean(item.isRegistered)}
                onClick={() => { setRegistrationError(''); setConfirmingEvent(item); }}
              >
                <div className="agenda-item-left-icon">
                  <CalendarIcon size={18} aria-hidden="true" />
                </div>
                <div className="agenda-item-content">
                  <div className="agenda-item-meta-top">
                    <span className="agenda-item-time">
                      <Clock size={11} aria-hidden="true" />
                      <span>{item.time || (language === 'vi' ? 'Cả ngày' : 'All day')}</span>
                    </span>
                    <span className="participant-calendar-status">
                      {item.isRegistered && <CheckCircle2 size={12} />}
                      {registrationLabel(item.isRegistered, item.registrationDeadlineAt)}
                    </span>
                  </div>
                  <strong className="agenda-item-title">{item.title}</strong>
                  <div className="agenda-item-meta-bottom">
                    <span className="agenda-item-location">
                      <MapPin size={11} aria-hidden="true" />
                      <span>{item.location || (language === 'vi' ? 'Đường Sách TP.HCM' : 'Book Street')}</span>
                    </span>
                  </div>
                </div>
                <div className="agenda-item-arrow">
                  <ChevronRight size={18} aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>

          {!calendarCells.find(cell => cell.dateStr === selectedDateStr)?.events.length && (
            <div className="participant-agenda-empty-box">
              <div className="agenda-empty-icon-pill">
                <CalendarIcon size={18} />
              </div>
              <p className="agenda-empty-msg">
                {language === 'vi' ? 'Chưa có lịch trong ngày này. Chọn ngày có dấu chấm để xem hoạt động.' : 'No plans for this day. Select a marked date to view your schedule.'}
              </p>
            </div>
          )}

          {/* Sắp tới / Upcoming events list when database has upcoming events */}
          {upcomingEventsList.length > 0 && (
            <div className="participant-agenda-upcoming-section">
              <div className="agenda-upcoming-section-header">
                <div className="agenda-upcoming-title">
                  <span>{language === 'vi' ? 'Sự kiện sắp diễn ra tại Đường Sách' : 'Upcoming events at Book Street'}</span>
                </div>
                <Link to="/participant/events" className="agenda-upcoming-link">
                  {language === 'vi' ? 'Tất cả' : 'All'}
                </Link>
              </div>
              <div className="agenda-upcoming-cards-wrap">
                {upcomingEventsList.slice(0, 3).map(item => (
                  <button
                    key={`upcoming-${item.type}-${item.id}`}
                    type="button"
                    className={`participant-agenda-item is-upcoming-card ${item.isRegistered ? 'is-registered' : 'is-unregistered'}`}
                    data-calendar-id={`${item.type}-${item.id}`}
                    data-registered={Boolean(item.isRegistered)}
                    onClick={() => {
                      if (item.cellDateStr) setSelectedDateStr(item.cellDateStr);
                      setRegistrationError('');
                      setConfirmingEvent(item);
                    }}
                  >
                    <div className="agenda-upcoming-date-box">
                      <span className="upcoming-date-text">{item.displayDate}</span>
                    </div>
                    <div className="agenda-item-content">
                      <div className="agenda-item-meta-top">
                        {item.time && (
                          <span className="agenda-item-time">
                            <Clock size={11} aria-hidden="true" />
                            <span>{item.time}</span>
                          </span>
                        )}
                        <span className="participant-calendar-status">
                          {item.isRegistered && <CheckCircle2 size={12} />}
                          {registrationLabel(item.isRegistered, item.registrationDeadlineAt)}
                        </span>
                      </div>
                      <strong className="agenda-item-title">{item.title}</strong>
                      <div className="agenda-item-meta-bottom">
                        <span className="agenda-item-location">
                          <MapPin size={11} aria-hidden="true" />
                          <span>{item.location || (language === 'vi' ? 'Đường Sách TP.HCM' : 'Book Street')}</span>
                        </span>
                      </div>
                    </div>
                    <div className="agenda-item-arrow">
                      <ChevronRight size={18} aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 4. Modal "Xem Thêm" Sự Kiện trong ngày */}
      {selectedDayEvents && (
        <div
          className="participant-calendar-modal-backdrop"
          {...calendarBackdropHandlers}
        >
          <div className="participant-calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <div className="calendar-modal-title-group">
                <div className="calendar-modal-date-tag">
                  <CalendarIcon size={14} color="#E9BC63" />
                  <span>{displayDateText(selectedDayEvents.dateStr)}</span>
                </div>
                <h3>{language === 'vi' ? 'Danh sách Sự kiện & Hoạt động' : 'Day Events & Activities'}</h3>
              </div>
              <button
                type="button"
                className="calendar-modal-close-btn"
                onClick={() => setSelectedDayEvents(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="calendar-modal-body">
              <PaginatedList items={selectedDayEvents.events}>{pageItems => (<div className="calendar-modal-events-list">
                {pageItems.map((evt) => (
                  <div key={`${evt.type}-${evt.id}`} className={`calendar-modal-event-card ${evt.isRegistered ? 'is-registered' : 'is-unregistered'}`}>
                    <div className="modal-event-card-left" style={{ borderLeftColor: evt.badgeColor || '#185E48' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <div className="modal-event-badge">
                          <Tag size={12} />
                          <span>{evt.category || (evt.type === 'event' ? 'Sự kiện lớn' : 'Hoạt động')}</span>
                        </div>
                        {evt.isRegistered && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: '#ECFDF5',
                            color: '#059669',
                            border: '1px solid #A7F3D0',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <CheckCircle2 size={11} />
                            <span>{language === 'vi' ? 'Đã đăng ký' : 'Registered'}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="modal-event-title">{evt.title}</h4>

                      <div className="modal-event-meta-row">
                        {evt.time && (
                          <span className="modal-event-meta-item">
                            <Clock size={13} color="#185E48" />
                            <span>{evt.time}</span>
                          </span>
                        )}
                        {evt.location && (
                          <span className="modal-event-meta-item">
                            <MapPin size={13} color="#185E48" />
                            <span>{evt.location}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {!evt.isRegistered && evt.status !== 'ended' ? (
                        <button
                          type="button"
                          className="modal-event-action-btn"
                          disabled={registrationDeadlinePassed(evt.registrationDeadlineAt, registrationNow)}
                          style={{ background: '#185E48', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            setRegistrationError('');
                            setConfirmingEvent(evt);
                          }}
                        >
                          <CalendarCheck size={14} />
                          <span>{registrationDeadlinePassed(evt.registrationDeadlineAt, registrationNow) ? (language === 'vi' ? 'Đã quá hạn đăng ký' : 'Registration deadline passed') : (language === 'vi' ? 'Đăng ký tham gia' : 'Register')}</span>
                        </button>
                      ) : (
                        <>
                          {evt.isRegistered && (evt.canCancel ?? evt.status !== 'ended') && (
                            <button
                              type="button"
                              className="modal-event-action-btn"
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer' }}
                              onClick={() => {
                                setRegistrationError('');
                                setConfirmingEvent(evt);
                              }}
                            >
                              <X size={14} />
                              <span>{language === 'vi' ? 'Hủy đăng ký' : 'Cancel registration'}</span>
                            </button>
                          )}
                          <Link
                            to={evt.link}
                            className="modal-event-action-btn"
                            onClick={() => setSelectedDayEvents(null)}
                          >
                            <span>{language === 'vi' ? 'Chi tiết' : 'View'}</span>
                            <ArrowRight size={14} />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>)}</PaginatedList>
            </div>
          </div>
        </div>
      )}

      {/* 5. Confirmation Modal: Xác nhận Đăng ký Tham gia */}
      {confirmingEvent && (
        <div
          className="participant-calendar-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'vi' ? 'Đăng ký trên lịch' : 'Calendar registration'}
          style={{ zIndex: 10000 }}
          {...registrationBackdropHandlers}
        >
          <div
            className="participant-calendar-modal"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calendar-modal-header" style={{ background: confirmingEvent.isRegistered ? '#ECFDF5' : '#F0F7F4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: confirmingEvent.isRegistered ? '#059669' : '#185E48',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#FFFFFF'
                }}>
                  {confirmingEvent.isRegistered ? <CheckCircle2 size={20} /> : <CalendarCheck size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#172421', fontWeight: 800 }}>
                    {confirmingEvent.isRegistered
                      ? (language === 'vi' ? 'Thông tin đăng ký tham gia' : 'Registration Information')
                      : (language === 'vi' ? 'Xác nhận đăng ký tham gia' : 'Confirm Registration')}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#556B65' }}>
                    {language === 'vi' ? 'Đường Sách TP.HCM' : 'HCMC Book Street'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="calendar-modal-close-btn"
                disabled={isRegistering}
                aria-label={language === 'vi' ? 'Đóng đăng ký' : 'Close registration'}
                onClick={() => setConfirmingEvent(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="calendar-modal-body" style={{ padding: '1.5rem' }}>
              <div style={{
                background: '#FAFBFB',
                border: confirmingEvent.isRegistered ? '1.5px solid #A7F3D0' : '1px solid #E5ECE8',
                borderRadius: '12px',
                padding: '1.15rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: confirmingEvent.badgeColor || '#185E48',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    {confirmingEvent.category || (confirmingEvent.type === 'event' ? 'Sự kiện chính' : 'Hoạt động trải nghiệm')}
                  </div>

                  {confirmingEvent.isRegistered ? (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: '#D1FAE5',
                      color: '#065F46',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <CheckCircle2 size={12} />
                      <span>{language === 'vi' ? 'Đã đăng ký' : 'Registered'}</span>
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 750,
                      background: '#FEE2E2',
                      color: '#B91C1C',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {registrationLabel(false, confirmingEvent.registrationDeadlineAt)}
                    </span>
                  )}
                </div>

                <h4 style={{ margin: '0 0 0.65rem', fontSize: '1.05rem', color: '#172421', fontWeight: 750, lineHeight: 1.4 }}>
                  {confirmingEvent.title}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: '#526661' }}>
                  {confirmingEvent.time && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Clock size={14} color="#185E48" />
                      <span>{confirmingEvent.time}</span>
                    </div>
                  )}
                  {confirmingEvent.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <MapPin size={14} color="#185E48" />
                      <span>{confirmingEvent.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {confirmingEvent.isRegistered ? (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.85rem 1rem',
                    background: '#ECFDF5',
                    borderRadius: '8px',
                    color: '#065F46',
                    fontSize: '0.8rem',
                    lineHeight: 1.45,
                    marginBottom: '1.5rem',
                    border: '1px solid #A7F3D0'
                  }}>
                    <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px', color: '#059669' }} />
                    <span>
                      {confirmingEvent.type === 'activity'
                        ? (language === 'vi'
                          ? 'Hoạt động đã có trong lịch của bạn. Khi đến nơi, hãy quét mã QR hoạt động do Ban tổ chức hiển thị để điểm danh.'
                          : 'This activity is in your schedule. At the venue, scan the Activity QR displayed by the Organizer to check in.')
                        : (language === 'vi'
                          ? 'Sự kiện đã có trong danh sách của bạn. Bạn có thể tiếp tục chọn và đăng ký các hoạt động phù hợp.'
                          : 'This event is in your list. You can continue by choosing and registering for activities.')}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  padding: '0.85rem 1rem',
                  background: '#FEF3C7',
                  borderRadius: '8px',
                  color: '#92400E',
                  fontSize: '0.8rem',
                  lineHeight: 1.45,
                  marginBottom: '1.5rem'
                }}>
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    {language === 'vi'
                      ? 'Sau khi đăng ký, mục này sẽ được lưu vào danh sách của bạn để theo dõi và tham gia đúng lịch.'
                      : 'After registration, this item will be saved to your list so you can follow its schedule.'}
                  </span>
                </div>
              )}

              {registrationError && <p className="participant-inline-error" role="alert">{registrationError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #D3DFDA',
                    background: '#FFFFFF',
                    color: '#4B5563',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setConfirmingEvent(null)}
                  disabled={isRegistering}
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>

                {confirmingEvent.isRegistered && (confirmingEvent.canCancel ?? confirmingEvent.status !== 'ended') && (
                  <button
                    type="button"
                    style={{
                      padding: '0.65rem 1.35rem',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      fontWeight: 750,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                    onClick={handleCancelRegistration}
                    disabled={isRegistering}
                  >
                    <X size={16} />
                    <span>{isRegistering ? (language === 'vi' ? 'Đang hủy...' : 'Cancelling...') : (language === 'vi' ? 'Hủy đăng ký' : 'Cancel Registration')}</span>
                  </button>
                )}

                {!confirmingEvent.isRegistered && (
                  <button
                    type="button"
                    style={{
                      padding: '0.65rem 1.45rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#185E48',
                      color: '#FFFFFF',
                      fontWeight: 750,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 12px rgba(24, 94, 72, 0.25)'
                    }}
                    onClick={handleConfirmRegistration}
                    disabled={isRegistering || registrationDeadlinePassed(confirmingEvent.registrationDeadlineAt, registrationNow)}
                  >
                    <CheckCircle2 size={16} />
                    <span>{registrationDeadlinePassed(confirmingEvent.registrationDeadlineAt, registrationNow) ? (language === 'vi' ? 'Đã quá hạn đăng ký' : 'Registration deadline passed') : isRegistering ? (language === 'vi' ? 'Đang đăng ký...' : 'Registering...') : (language === 'vi' ? 'Xác nhận Đăng ký' : 'Confirm Registration')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
