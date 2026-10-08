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
import { QRCodeSVG } from 'qrcode.react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationCallout } from '../../components/ui/NotificationCallout';
import { Language, ParticipantActivity, ParticipantEvent, ParticipantProfile } from '../../types';
import './ParticipantPages.css';

interface ParticipantDashboardProps {
  language: Language;
  profile: ParticipantProfile;
  events: ParticipantEvent[];
  activities: ParticipantActivity[];
  totalCertificatesCount: number;
  onJoinEvent?: (eventId: string) => void | Promise<void>;
  onRegisterActivity?: (activityId: string) => void | Promise<void>;
}

interface CalendarEventItem {
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
  shortDesc?: string;
  dateStr?: string;
  qrToken?: string;
}

export const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({
  language,
  profile,
  events,
  activities,
  totalCertificatesCount,
  onJoinEvent,
  onRegisterActivity,
}) => {
  // Chỉ lấy những hoạt động người dùng thực sự đã đăng ký (status === 'registered' hoặc 'attended')
  const registeredActivities = activities.filter(a => a.status === 'registered' || a.status === 'attended');

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
  const [confirmingEvent, setConfirmingEvent] = useState<CalendarEventItem | null>(null);
  const [registerSuccessToast, setRegisterSuccessToast] = useState<string | null>(null);

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
      const match = activity.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      return Boolean(match && `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` === date);
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
      shortDesc: activity.description,
      dateStr: date,
      qrToken: activity.qrCodeValue || activity.registrationCode,
    }));

  const getEventsForDay = (day: number): CalendarEventItem[] => {
    const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const calendarEvents = events
      .filter(event => {
        const dates = event.dateRange.match(/\d{4}-\d{2}-\d{2}/g) || [];
        const startDate = dates[0];
        // An event may span several days, but the calendar presents its card once
        // on its first day; activities remain displayed on their actual dates.
        // Lịch tổng quan chỉ là lịch sắp diễn ra: không hiển thị lại thẻ của
        // sự kiện đã bắt đầu ở ngày trước đó. Lịch sử vẫn nằm trong “Sự kiện của tôi”.
        return startDate === date && startDate >= vietnamToday;
      })
      .map(event => ({
        id: event.id,
        title: event.title,
        location: event.location,
        category: language === 'vi' ? 'Sự kiện' : 'Event',
        type: 'event' as const,
        link: '/participant/events',
        badgeColor: '#185E48',
        status: event.status === 'ended' ? 'ended' as const : statusForDate(date),
        isRegistered: event.isJoined,
        shortDesc: event.shortDesc,
        dateStr: event.dateRange,
      }));
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

  // Handler when clicking on an event chip
  const handleEventClick = (ev: CalendarEventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Luôn mở popup đăng ký / chi tiết sự kiện
    setConfirmingEvent(ev);
  };

  // Perform registration on confirmation
  const handleConfirmRegistration = async () => {
    if (!confirmingEvent) return;

    try {
      if (confirmingEvent.type === 'event') {
        await onJoinEvent?.(confirmingEvent.id);
      } else {
        await onRegisterActivity?.(confirmingEvent.id);
      }
    } catch (error) {
      setRegisterSuccessToast(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể đăng ký. Vui lòng thử lại.' : 'Registration failed. Please try again.'));
      return;
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

  return (
    <div className="participant-dashboard-view">
      {/* Registration Success Toast Notification */}
      {registerSuccessToast && (
        <NotificationCallout
          variant={registerSuccessToast.toLowerCase().includes('failed') || registerSuccessToast.toLowerCase().includes('khÃ´ng') ? 'error' : 'success'}
          title={language === 'vi' ? 'Cáº­p nháº­t Ä‘Äƒng kÃ½' : 'Registration update'}
          floating
        >
          {registerSuccessToast}
          <button 
            type="button" 
            onClick={() => setRegisterSuccessToast(null)} 
            style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', marginLeft: '0.5rem' }}
            aria-label={language === 'vi' ? 'ÄÃ³ng thÃ´ng bÃ¡o' : 'Dismiss notification'}
          >
            <X size={16} />
          </button>
        </NotificationCallout>
      )}

      {/* 1. Header with Welcome Greeting */}
      <div className="participant-page-header">
        <h1 className="participant-page-title">
          {language === 'vi' ? `Xin chào, ${profile.name}!` : `Welcome back, ${profile.name}!`}
        </h1>
        <p className="participant-page-sub">
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
            <span>{profile.points}</span>
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
                onClick={() => {
                  setSelectedDateStr(cell.dateStr);
                  if (hasEvents) {
                    if (cell.events.length > 1) {
                      setSelectedDayEvents({
                        day: cell.day,
                        dateStr: `${cell.day} ${currentMonthName}, ${currentYear}`,
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px'
                }}>
                  <span style={{
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
                    <span style={{
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
                    <span 
                      style={{ fontSize: '0.7rem', color: '#B3BDB9', opacity: 0.6 }}
                    >
                      + Trống
                    </span>
                  )}
                </div>

                {/* Event Chips (Max 2) */}
                {hasEvents && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                    {visibleEvents.map((ev) => {
                      const isJoined = ev.isRegistered;
                      const borderColor = isJoined ? '#10B981' : '#EF4444'; // Green if registered, Red if unregistered/not joined
                      const leftBarColor = isJoined ? '#059669' : '#DC2626';
                      const bgCard = isJoined ? '#F0FDF4' : '#FEF2F2';

                      return (
                        <div
                          key={ev.id}
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
                            color: isJoined ? '#047857' : '#B91C1C',
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
                                <span>Sẽ tham gia</span>
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 750,
                                background: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap'
                              }}>
                                <span>Chưa đăng ký</span>
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
                            dateStr: `${cell.day} ${currentMonthName}, ${currentYear}`,
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
      </div>

      {/* 4. Modal "Xem Thêm" Sự Kiện trong ngày */}
      {selectedDayEvents && (
        <div className="participant-calendar-modal-backdrop" onClick={() => setSelectedDayEvents(null)}>
          <div className="participant-calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <div className="calendar-modal-title-group">
                <div className="calendar-modal-date-tag">
                  <CalendarIcon size={14} color="#E9BC63" />
                  <span>{selectedDayEvents.dateStr}</span>
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
              <div className="calendar-modal-events-list">
                {selectedDayEvents.events.map((evt) => (
                  <div key={evt.id} className="calendar-modal-event-card">
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
                            <span>Đã đăng ký (Sẽ tham gia)</span>
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
                          style={{ background: '#185E48', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            setConfirmingEvent(evt);
                          }}
                        >
                          <CalendarCheck size={14} />
                          <span>{language === 'vi' ? 'Đăng ký tham gia' : 'Register'}</span>
                        </button>
                      ) : (
                        <Link 
                          to={evt.link} 
                          className="modal-event-action-btn"
                          onClick={() => setSelectedDayEvents(null)}
                        >
                          <span>{language === 'vi' ? 'Chi tiết' : 'View'}</span>
                          <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Confirmation Modal: Xác nhận Đăng ký Tham gia */}
      {confirmingEvent && (
        <div 
          className="participant-calendar-modal-backdrop" 
          style={{ zIndex: 10000 }}
          onClick={() => setConfirmingEvent(null)}
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
                      <span>{language === 'vi' ? 'Đã đăng ký (Sẽ tham gia)' : 'Registered (Attending)'}</span>
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
                      {language === 'vi' ? 'Chưa đăng ký' : 'Not registered'}
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
                  {/* Mã QR Check-in chỉ được cấp cho đăng ký hoạt động */}
                  {confirmingEvent.type === 'activity' && confirmingEvent.qrToken && (
                  <div style={{
                    background: '#F8FAFC',
                    border: '1.5px dashed #A7F3D0',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    textAlign: 'center',
                    marginBottom: '1.25rem'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.65rem' }}>
                      {language === 'vi' ? 'Mã QR Check-in Tham Gia' : 'Check-in QR Code'}
                    </span>
                    <div style={{
                      display: 'inline-block',
                      background: '#FFFFFF',
                      padding: '10px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #E2E8F0',
                      marginBottom: '0.65rem'
                    }}>
                      <QRCodeSVG value={confirmingEvent.qrToken} size={150} level="M" />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      <span>{language === 'vi' ? 'Mã số:' : 'Code:'} </span>
                      <strong style={{ fontFamily: 'monospace', color: '#17382E', fontSize: '0.9rem' }}>
                        {confirmingEvent.qrToken}
                      </strong>
                    </div>
                  </div>
                  )}

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
                      {language === 'vi' 
                        ? 'Bạn đã đăng ký sự kiện này thành công. Hãy đưa mã QR này cho ban tổ chức khi tham gia để tích điểm nhé!' 
                        : 'You have registered for this event. Present this QR code when attending to check in!'}
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
                        ? 'Sau khi đăng ký, mục này sẽ được lưu vào danh sách của bạn. Mã QR chỉ được cấp cho hoạt động đã đăng ký.'
                        : 'After registration, this item is saved to your list. QR codes are issued only for registered activities.'}
                  </span>
                </div>
              )}

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
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>

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
                  >
                    <CheckCircle2 size={16} />
                    <span>{language === 'vi' ? 'Xác nhận Đăng ký' : 'Confirm Registration'}</span>
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
