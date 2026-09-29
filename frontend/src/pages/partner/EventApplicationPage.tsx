import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Users, 
  Store, 
  CheckCircle2, 
  PlusCircle, 
  Plus,
  Building2, 
  X, 
  Sparkles, 
  Send, 
  Filter, 
  Layers, 
  AlertCircle,
  FileText,
  Search,
  Check,
  CalendarDays,
  Info,
  ArrowRight,
  ChevronDown,
  Mic2,
  Tv,
  HelpCircle,
  Award
} from 'lucide-react';
import { Language, PartnerOrganization, PartnerEventApplication } from '../../types';
import { OrganizerEvent } from '../../types/organizer';
import { partnerApi } from '../../services/partnerApi';
import './PartnerPages.css';

// Extended Event Item type with specific schedule time slot and hosting details
export interface ScheduledEventItem extends OrganizerEvent {
  timeStr: string; // e.g. "08:30 – 11:30"
  badgeColor: string;
  categoryTag: string;
  hostOrgName?: string;
  speaker?: string;
  equipment?: string[];
  expectedAttendees?: string;
}

interface EventApplicationPageProps {
  language: Language;
  organization: PartnerOrganization;
  activeApplication?: PartnerEventApplication | null;
  assets: Array<{ id: string; name: string; totalQuantity: number }>;
}

export const EventApplicationPage: React.FC<EventApplicationPageProps> = ({
  language,
  organization,
  activeApplication,
  assets,
}) => {
  const navigate = useNavigate();
  const vietnamDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  // The calendar is populated only from the Partner schedule API.
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEventItem[]>([]);

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(vietnamDateKey);
  const [selectedEvent, setSelectedEvent] = useState<ScheduledEventItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'happening' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Event Detail Popup Modal State
  const [detailModalEvent, setDetailModalEvent] = useState<ScheduledEventItem | null>(null);

  // Day Events List Modal State (Apple Calendar style expanded day popover)
  const [dayOverviewModal, setDayOverviewModal] = useState<{ dateStr: string; day: number; events: ScheduledEventItem[] } | null>(null);

  // Proposal/Organizing Registration Modal State
  const [isOrganizeModalOpen, setIsOrganizeModalOpen] = useState(false);

  // --- FORM STATE: ĐĂNG KÝ TỔ CHỨC SỰ KIỆN MỚI ---
  // 1. Đơn vị tổ chức
  const [orgName, setOrgName] = useState(organization.name);
  const [repName, setRepName] = useState(organization.representativeName);
  const [email, setEmail] = useState(organization.email);
  const [phone, setPhone] = useState(organization.phone);
  const [orgType, setOrgType] = useState('Nhà xuất bản / Đơn vị phát hành sách');

  // 2. Thông tin sự kiện đề xuất tổ chức
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState('Workshop');
  const [targetDate, setTargetDate] = useState(vietnamDateKey);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:30');
  const [venueLocation, setVenueLocation] = useState('');
  const [speakerInfo, setSpeakerInfo] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('50 – 100 người');
  const [eventDescription, setEventDescription] = useState('');
  
  // 3. Yêu cầu kỹ thuật, thiết bị & hỗ trợ
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Success Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    partnerApi.getSchedule().then(items => {
      const today = vietnamDateKey();
      const schedule = (items as unknown as ScheduledEventItem[]).filter(item => item.endDate >= today);
      setScheduledEvents(schedule);
      const current = schedule.find(item => item.startDate <= today && item.endDate >= today) || schedule[0] || null;
      setSelectedEvent(current);
      if (current) {
        const start = new Date(`${current.startDate}T00:00:00+07:00`);
        setCurrentYear(start.getFullYear());
        setCurrentMonth(start.getMonth());
        setSelectedDateStr(current.startDate);
      }
    }).catch(error => console.warn('Could not fetch partner schedule', error));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const applyToPublishedEvent = async (item: ScheduledEventItem) => {
    if (!item.id.startsWith('event:')) {
      showToast(language === 'vi' ? 'Đây là một hoạt động trong lịch; hãy chọn sự kiện chính để đăng ký tham gia.' : 'Select the parent event to apply.');
      return;
    }
    try {
      await partnerApi.submitApplication(item.id.slice('event:'.length));
      setDetailModalEvent(null);
      showToast(language === 'vi' ? 'Đã gửi hồ sơ tham gia sự kiện đến Ban Quản Lý.' : 'Event application submitted.');
      window.dispatchEvent(new Event('duongsach:data-changed'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể gửi hồ sơ tham gia sự kiện');
    }
  };

  const monthNamesVi = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Colors mapping based on Category
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Workshop': return '#0E7490';
      case 'Tọa đàm': return '#B45309';
      case 'Ra mắt sách': return '#047857';
      case 'Triển lãm': return '#4338CA';
      case 'Giao lưu văn nghệ': return '#6D28D9';
      case 'Giao lưu tác giả': return '#BE185D';
      default: return '#17382E';
    }
  };

  // Calendar Grid Calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon...
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Start from Monday (Apple standard)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      events: ScheduledEventItem[];
    }> = [];

    // Prev month padding
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        isCurrentMonth: false,
        events: []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // Check events on this date
      const evts = scheduledEvents.filter(evt => {
        if (!evt.startDate || !evt.endDate) return false;
        return dateStr >= evt.startDate && dateStr <= evt.endDate;
      });

      days.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        events: evts
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        isCurrentMonth: false,
        events: []
      });
    }

    return days;
  }, [currentYear, currentMonth, scheduledEvents]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleOpenDetailModal = (evt: ScheduledEventItem) => {
    setDetailModalEvent(evt);
  };

  const handleOpenOrganizeModal = (presetDate?: string) => {
    if (presetDate) {
      setTargetDate(presetDate);
    } else if (selectedDateStr) {
      setTargetDate(selectedDateStr);
    }
    setIsOrganizeModalOpen(true);
  };

  const toggleEquipment = (eq: string) => {
    setSelectedEquipment(prev => 
      prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]
    );
  };

  // Submit Handler: Tạo đề xuất tổ chức sự kiện mới trên Đường Sách
  const handleSubmitOrganizeEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      alert(language === 'vi' ? 'Vui lòng nhập tên sự kiện muốn tổ chức.' : 'Please enter event title.');
      return;
    }
    if (!agreedTerms) {
      alert(language === 'vi' ? 'Vui lòng xác nhận cam kết tuân thủ quy chế tổ chức sự kiện tại Đường Sách.' : 'Please agree to the terms.');
      return;
    }

    if (!activeApplication || activeApplication.status !== 'approved') {
      alert(language === 'vi' ? 'Tổ chức cần có hồ sơ tham gia sự kiện đã được duyệt trước khi gửi đề xuất hoạt động.' : 'An approved event application is required first.');
      return;
    }
    if (!venueLocation.trim()) {
      alert(language === 'vi' ? 'Vui lòng nhập đúng tên địa điểm thuộc sự kiện.' : 'Please enter an event location.');
      return;
    }
    const kindByCategory: Record<string, string> = { Workshop: 'workshop', Talkshow: 'talkshow', Minigame: 'minigame', Exhibition: 'exhibition' };
    try {
      await partnerApi.submitActivityProposal({
        eventId: activeApplication.eventId, title: eventTitle.trim(), kind: kindByCategory[eventCategory] || 'other',
        locationName: venueLocation, startAt: `${targetDate}T${startTime}:00+07:00`, endAt: `${targetDate}T${endTime}:00+07:00`,
        capacity: Math.max(1, parseInt(expectedAttendees) || 50), targetAudience: expectedAttendees,
        description: eventDescription, speaker: speakerInfo, contactPerson: repName, contactPhone: phone,
        devices: selectedEquipment.map(name => ({ name, quantity: 1 })),
      });
      window.dispatchEvent(new Event('duongsach:data-changed'));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể gửi đề xuất hoạt động');
      return;
    }

    showToast(
      language === 'vi' 
        ? `Đã gửi đề xuất hoạt động "${eventTitle}" lên Ban Quản Lý thành công!` 
        : `Activity proposal "${eventTitle}" submitted successfully!`
    );

    setIsOrganizeModalOpen(false);
    // Reset form
    setEventTitle('');
    setSpeakerInfo('');
    setEventDescription('');
  };

  return (
    <div className="event-application-page" style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: '#17382E',
          color: '#FFFFFF',
          padding: '0.95rem 1.45rem',
          borderRadius: '14px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
          zIndex: 99999,
          fontSize: '0.92rem',
          fontWeight: 650,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          border: '1.5px solid #E9BC63',
          animation: 'fadeIn 0.25s ease'
        }}>
          <CheckCircle2 size={22} color="#E9BC63" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Apple-Styled Navigation Bar */}
      <div className="partner-page-header" style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <CalendarDays size={28} color="#17382E" />
            <h1 className="partner-page-title" style={{ margin: 0, fontSize: '1.85rem' }}>
              {language === 'vi' ? 'Lịch sự kiện & Đăng ký tổ chức' : 'Event Calendar & Host Registration'}
            </h1>
          </div>
          <p className="partner-page-sub">
            {language === 'vi' 
              ? 'Xem lịch sự kiện toàn không gian Đường Sách và nộp hồ sơ đăng ký tổ chức chương trình mới (Talkshow, Workshop, Ra mắt sách, Triển lãm).' 
              : 'View Book Street event schedules and propose new events/activities (Talkshows, Workshops, Book launches).'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-part-secondary"
            onClick={() => {
              const todayKey = vietnamDateKey();
              const today = new Date(`${todayKey}T00:00:00+07:00`);
              setCurrentYear(today.getFullYear());
              setCurrentMonth(today.getMonth());
              setSelectedDateStr(todayKey);
              setSelectedEvent(scheduledEvents.find(item => item.startDate <= todayKey && item.endDate >= todayKey) || null);
            }}
          >
            <Clock size={15} />
            <span>{language === 'vi' ? 'Sự kiện hôm nay' : 'Today'}</span>
          </button>
          
          <button
            type="button"
            className="btn-part-primary"
            onClick={() => handleOpenOrganizeModal()}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.88rem',
              borderRadius: '9px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(23, 56, 46, 0.2)'
            }}
          >
            <Plus size={16} />
            <span>{language === 'vi' ? 'Đề xuất hoạt động' : 'Propose Activity'}</span>
          </button>
        </div>
      </div>

      {/* 2. Apple-Designed Full-Width Calendar Panel */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '18px',
        padding: '1.75rem',
        boxShadow: '0 8px 30px rgba(23, 36, 33, 0.05)',
        marginBottom: '2rem'
      }}>
        {/* Apple Calendar Top Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid #EEF2F0',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", var(--font-serif)',
              fontSize: '1.65rem',
              color: '#172421',
              margin: 0,
              fontWeight: 800,
              letterSpacing: '-0.02em'
            }}>
              {language === 'vi' ? monthNamesVi[currentMonth] : monthNamesEn[currentMonth]} <span style={{ color: '#8C6519', fontWeight: 600 }}>{currentYear}</span>
            </h2>

            {/* Apple Segmented Nav Buttons */}
            <div style={{
              display: 'inline-flex',
              background: '#F1F5F3',
              borderRadius: '9px',
              padding: '2px',
              border: '1px solid #E2EAE5'
            }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Tháng trước"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '5px 9px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#17382E'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Tháng sau"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '5px 9px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#17382E'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Quick Actions & Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.35rem', background: '#F4F7F5', padding: '3px', borderRadius: '10px' }}>
              <button
                type="button"
                className={`partner-tab-btn ${filterCategory === 'all' ? 'is-active' : ''}`}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                onClick={() => setFilterCategory('all')}
              >
                {language === 'vi' ? 'Tất cả sự kiện' : 'All'}
              </button>
              <button
                type="button"
                className={`partner-tab-btn ${filterCategory === 'happening' ? 'is-active' : ''}`}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                onClick={() => setFilterCategory('happening')}
              >
                {language === 'vi' ? 'Đang diễn ra' : 'Happening'}
              </button>
              <button
                type="button"
                className={`partner-tab-btn ${filterCategory === 'upcoming' ? 'is-active' : ''}`}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                onClick={() => setFilterCategory('upcoming')}
              >
                {language === 'vi' ? 'Sắp tới' : 'Upcoming'}
              </button>
            </div>
          </div>
        </div>

        {/* Apple Calendar Weekday Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.8rem',
          color: '#637771',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '0.65rem',
          padding: '0.4rem 0'
        }}>
          <div>{language === 'vi' ? 'Thứ 2' : 'Mon'}</div>
          <div>{language === 'vi' ? 'Thứ 3' : 'Tue'}</div>
          <div>{language === 'vi' ? 'Thứ 4' : 'Wed'}</div>
          <div>{language === 'vi' ? 'Thứ 5' : 'Thu'}</div>
          <div>{language === 'vi' ? 'Thứ 6' : 'Fri'}</div>
          <div>{language === 'vi' ? 'Thứ 7' : 'Sat'}</div>
          <div style={{ color: '#DC2626' }}>{language === 'vi' ? 'Chủ nhật' : 'Sun'}</div>
        </div>

        {/* Apple Calendar Grid - Max 2 visible events per cell */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px'
        }}>
          {calendarDays.map((cell, idx) => {
            const hasEvents = cell.events.length > 0;
            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === '2026-10-20';
            const visibleEvents = cell.events.slice(0, 2);
            const extraCount = cell.events.length - 2;

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDateStr(cell.dateStr);
                  if (cell.events.length > 0) {
                    setSelectedEvent(cell.events[0]);
                    if (cell.events.length > 1) {
                      setDayOverviewModal({ dateStr: cell.dateStr, day: cell.day, events: cell.events });
                    } else {
                      handleOpenDetailModal(cell.events[0]);
                    }
                  } else {
                    // Click on an empty day: propose hosting an event on this date
                    handleOpenOrganizeModal(cell.dateStr);
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
                  cursor: 'pointer',
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
                {/* Cell Header: Day Number + Event Counter Bubble */}
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
                      title="Bấm để đăng ký tổ chức sự kiện vào ngày này"
                    >
                      + Trống
                    </span>
                  )}
                </div>

                {/* Stack of Scheduled Events with Time Slot & Word Wrapping */}
                {hasEvents && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                    {visibleEvents.map(ev => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                          setSelectedDateStr(cell.dateStr);
                          handleOpenDetailModal(ev);
                        }}
                        style={{
                          borderRadius: '6px',
                          background: '#FFFFFF',
                          borderLeft: `3.5px solid ${ev.badgeColor || '#17382E'}`,
                          borderTop: '1px solid #EAEFEA',
                          borderRight: '1px solid #EAEFEA',
                          borderBottom: '1px solid #EAEFEA',
                          padding: '4px 6px',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                          transition: 'all 120ms ease'
                        }}
                        title={`Bấm xem chi tiết: ${ev.title}`}
                      >
                        {/* Time badge */}
                        <div style={{
                          fontSize: '0.68rem',
                          fontWeight: 750,
                          color: ev.badgeColor || '#17382E',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          marginBottom: '2px'
                        }}>
                          <Clock size={10} />
                          <span>{ev.timeStr}</span>
                        </div>

                        {/* Event Title - Down to multiple lines naturally */}
                        <div style={{
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          lineHeight: 1.35,
                          color: '#172421',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}>
                          {ev.title}
                        </div>
                      </div>
                    ))}

                    {/* Show more indicator if > 2 events on this day */}
                    {extraCount > 0 && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDayOverviewModal({ dateStr: cell.dateStr, day: cell.day, events: cell.events });
                        }}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 750,
                          color: '#B3862A',
                          textAlign: 'center',
                          padding: '2px 0',
                          cursor: 'pointer',
                          background: '#FAF8F3',
                          borderRadius: '4px',
                          border: '1px dashed #E5D5B8'
                        }}
                      >
                        + Xem thêm {extraCount} sự kiện...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. POPUP MODAL: Thông tin chi tiết 1 sự kiện (Event Details Modal) */}
      {detailModalEvent && (
        <div 
          className="attendance-modal-overlay" 
          onClick={() => setDetailModalEvent(null)}
          style={{ zIndex: 9998 }}
        >
          <div 
            className="attendance-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', overflow: 'hidden', padding: 0, borderRadius: '20px' }}
          >
            {/* Cover Image & Status Badge */}
            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
              <img 
                src={detailModalEvent.imageUrl} 
                alt={detailModalEvent.title} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => setDetailModalEvent(null)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'rgba(0,0,0,0.55)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: '#FFFFFF',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <X size={18} />
              </button>
              
              <div style={{
                position: 'absolute',
                bottom: '14px',
                left: '16px',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center'
              }}>
                <span style={{
                  background: detailModalEvent.badgeColor || '#17382E',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 750,
                  padding: '0.35rem 0.85rem',
                  borderRadius: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                }}>
                  {detailModalEvent.categoryTag || 'Sự kiện'}
                </span>
                <span style={{
                  background: 'rgba(255,255,255,0.92)',
                  color: '#172421',
                  fontSize: '0.78rem',
                  fontWeight: 750,
                  padding: '0.35rem 0.85rem',
                  borderRadius: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(8px)'
                }}>
                  🕒 {detailModalEvent.timeStr}
                </span>
              </div>
            </div>

            {/* Modal Body Info */}
            <div style={{ padding: '1.75rem' }}>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.45rem',
                fontWeight: 800,
                color: '#172421',
                margin: '0 0 0.85rem 0',
                lineHeight: 1.3
              }}>
                {detailModalEvent.title}
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.86rem',
                color: '#495D57',
                marginBottom: '1.25rem',
                padding: '0.85rem 1rem',
                background: '#FAF8F3',
                borderRadius: '12px',
                border: '1px solid #EFE8D8'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarIcon size={16} color="#B3862A" />
                  <span><strong>{language === 'vi' ? 'Ngày diễn ra:' : 'Date:'}</strong> {detailModalEvent.dateRange}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} color="#B3862A" />
                  <span><strong>{language === 'vi' ? 'Khung giờ:' : 'Time Slot:'}</strong> {detailModalEvent.timeStr}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} color="#B3862A" />
                  <span><strong>{language === 'vi' ? 'Địa điểm:' : 'Location:'}</strong> {detailModalEvent.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={16} color="#B3862A" />
                  <span><strong>{language === 'vi' ? 'Đơn vị tổ chức:' : 'Host Org:'}</strong> {detailModalEvent.hostOrgName || 'Ban Quản Lý'}</span>
                </div>
                {detailModalEvent.speaker && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', gridColumn: '1 / -1' }}>
                    <Mic2 size={16} color="#B3862A" />
                    <span><strong>{language === 'vi' ? 'Diễn giả / Khách mời:' : 'Speaker:'}</strong> {detailModalEvent.speaker}</span>
                  </div>
                )}
              </div>

              <h4 style={{ fontSize: '0.92rem', fontWeight: 750, color: '#172421', margin: '0 0 0.4rem 0' }}>
                {language === 'vi' ? 'Nội dung chi tiết chương trình:' : 'Event Description:'}
              </h4>
              <p style={{ fontSize: '0.88rem', color: '#556B65', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
                {detailModalEvent.description}
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #EEF2F0', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-part-secondary"
                  onClick={() => setDetailModalEvent(null)}
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>

                <button
                  type="button"
                  className="btn-part-primary"
                  onClick={() => void applyToPublishedEvent(detailModalEvent)}
                  style={{
                    boxShadow: '0 4px 14px rgba(23, 56, 46, 0.22)'
                  }}
                >
                  <PlusCircle size={16} />
                  <span>{language === 'vi' ? 'Đăng ký tham gia sự kiện này' : 'Apply to This Event'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. POPUP MODAL: Danh sách tất cả sự kiện trong ngày (Apple Day Schedule Popover) */}
      {dayOverviewModal && (
        <div 
          className="attendance-modal-overlay" 
          onClick={() => setDayOverviewModal(null)}
          style={{ zIndex: 9997 }}
        >
          <div 
            className="attendance-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '620px', borderRadius: '18px' }}
          >
            <div className="attendance-modal-header" style={{
              background: '#FAFCFB',
              borderBottom: '1px solid #EEF2F0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 800,
                  color: '#172421'
                }}>
                  {language === 'vi' ? `Lịch biểu Ngày ${dayOverviewModal.day} ${monthNamesVi[currentMonth]}` : `Schedule for Day ${dayOverviewModal.day}`}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem', color: '#556B65' }}>
                  Có tổng cộng <strong>{dayOverviewModal.events.length} sự kiện</strong> được lên lịch
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDayOverviewModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* List of Day's Events with Exact Times */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {dayOverviewModal.events.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => {
                    setDayOverviewModal(null);
                    handleOpenDetailModal(ev);
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2EAE5',
                    borderLeft: `4px solid ${ev.badgeColor || '#17382E'}`,
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    transition: 'all 150ms ease'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: ev.badgeColor || '#17382E',
                        background: '#F0F7F4',
                        padding: '2px 7px',
                        borderRadius: '6px'
                      }}>
                        🕒 {ev.timeStr}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#637771' }}>
                        📍 {ev.location}
                      </span>
                    </div>
                    <h4 style={{
                      margin: 0,
                      fontSize: '0.98rem',
                      fontWeight: 750,
                      color: '#172421',
                      lineHeight: 1.35
                    }}>
                      {ev.title}
                    </h4>
                    {ev.hostOrgName && (
                      <span style={{ fontSize: '0.75rem', color: '#7E928B' }}>
                        Tổ chức bởi: {ev.hostOrgName}
                      </span>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-part-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDayOverviewModal(null);
                        handleOpenDetailModal(ev);
                      }}
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <button
                  type="button"
                  className="btn-part-primary"
                  onClick={() => {
                    const date = dayOverviewModal.dateStr;
                    setDayOverviewModal(null);
                    handleOpenOrganizeModal(date);
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <PlusCircle size={16} />
                  <span>+ Đăng ký tổ chức thêm sự kiện vào ngày này</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: FORM ĐĂNG KÝ TỔ CHỨC SỰ KIỆN MỚI */}
      {isOrganizeModalOpen && (
        <div 
          className="attendance-modal-overlay" 
          onClick={() => setIsOrganizeModalOpen(false)}
          style={{ zIndex: 9999 }}
        >
          <div 
            className="attendance-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px' }}
          >
            {/* Modal Header */}
            <div className="attendance-modal-header" style={{
              background: '#FAFCFB',
              borderBottom: '1px solid #EEF2F0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div>
                <h3 style={{
                  margin: '0 0 0.2rem 0',
                  fontSize: '1.3rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 800,
                  color: '#172421'
                }}>
                  {language === 'vi' ? 'Gửi đề xuất hoạt động cho sự kiện' : 'Propose an Event Activity'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#556B65' }}>
                  {language === 'vi' 
                    ? 'Điền đầy đủ thông tin chương trình để gửi Ban Quản Lý Đường Sách phê duyệt lịch và địa điểm.' 
                    : 'Submit event proposal for Book Street management board approval.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOrganizeModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitOrganizeEvent} style={{ padding: '1.5rem' }}>
              {/* Card Tóm tắt Đơn vị Đăng ký (Tự động lấy thông tin từ Gian hàng) */}
              <div style={{
                background: '#FAF8F3',
                border: '1px solid #EFE8D8',
                borderRadius: '12px',
                padding: '0.85rem 1.15rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#17382E',
                    color: '#E9BC63',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}>
                    🏢
                  </div>
                  <div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#172421' }}>
                      {organization.name || orgName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#637771' }}>
                      Đại diện: <strong>{organization.representativeName || repName}</strong> • SĐT: <strong>{organization.phone || phone}</strong> • Email: <strong>{organization.email || email}</strong>
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#065F46',
                  background: '#E8F5EF',
                  padding: '3px 9px',
                  borderRadius: '12px',
                  border: '1px solid #A7F3D0'
                }}>
                  ✓ Thông tin gian hàng đã xác thực
                </span>
              </div>

              {/* PHẦN 1: CHI TIẾT SỰ KIỆN ĐỀ XUẤT */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2EAE5',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1.25rem'
              }}>
                <h4 style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#172421',
                  margin: '0 0 1rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>📅</span>
                  <span>{language === 'vi' ? '1. Thông tin Sự kiện đề xuất tổ chức' : '1. Event Details & Scheduling'}</span>
                </h4>

                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Tên sự kiện / Tiêu đề chương trình *' : 'Event Title *'}</label>
                  <input 
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Ví dụ: Tọa đàm 'Hành trình ra mắt tác phẩm mới' & Ký tặng sách"
                  />
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Hình thức / Thể loại sự kiện *' : 'Event Category *'}</label>
                    <select 
                      value={eventCategory} 
                      onChange={(e) => setEventCategory(e.target.value)}
                    >
                      <option value="Workshop">Workshop & Trải nghiệm thực hành</option>
                      <option value="Tọa đàm">Tọa đàm & Diễn đàn thảo luận</option>
                      <option value="Ra mắt sách">Lễ ra mắt sách & Giới thiệu tác phẩm mới</option>
                      <option value="Giao lưu tác giả">Giao lưu tác giả & Ký tặng sách</option>
                      <option value="Triển lãm">Triển lãm chuyên đề & Trưng bày nghệ thuật</option>
                      <option value="Giao lưu văn nghệ">Giao lưu nghệ thuật, Acoustic & Ngâm thơ</option>
                      <option value="Lễ hội sách">Hoạt động tương tác / Minigame cộng đồng</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Ngày đề xuất tổ chức *' : 'Proposed Date *'}</label>
                    <input 
                      type="date"
                      required
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Giờ bắt đầu *' : 'Start Time *'}</label>
                    <input 
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Giờ kết thúc *' : 'End Time *'}</label>
                    <input 
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Địa điểm / Không gian mong muốn *' : 'Venue / Stage Location *'}</label>
                    <select 
                      value={venueLocation} 
                      onChange={(e) => setVenueLocation(e.target.value)}
                    >
                      <option value="Sân khấu chính — Đường Sách">Sân khấu chính (Gần Cổng Hai Bà Trưng)</option>
                      <option value="Sân khấu A — Đường Sách">Sân khấu A (Khu trung tâm Đường Sách)</option>
                      <option value="Không gian Cafe Sách Nguyễn Văn Bình">Không gian Cafe Sách Nguyễn Văn Bình</option>
                      <option value="Tại gian hàng của đơn vị">Tại gian hàng / Không gian của đơn vị đăng ký</option>
                      <option value="Quảng trường Bưu điện — Đường Sách">Quảng trường Bưu điện — Đầu đường sách</option>
                      <option value="Hành lang Trưng bày Di sản">Hành lang Trưng bày Di sản</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Dự kiến số lượng người tham dự *' : 'Expected Attendees *'}</label>
                    <select 
                      value={expectedAttendees} 
                      onChange={(e) => setExpectedAttendees(e.target.value)}
                    >
                      <option value="Dưới 30 người">Dưới 30 người (Quy mô nhóm nhỏ)</option>
                      <option value="30 – 60 người">30 – 60 người (Workshop vừa)</option>
                      <option value="50 – 100 người">50 – 100 người (Tọa đàm tiêu chuẩn)</option>
                      <option value="100 – 250 người">100 – 250 người (Sân khấu lớn)</option>
                      <option value="Trên 250 người">Trên 250 người (Quy mô đại hội)</option>
                    </select>
                  </div>
                </div>

                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Diễn giả / Khách mời / Tác giả tham dự (nếu có)' : 'Guest Speakers / Authors'}</label>
                  <input 
                    type="text"
                    value={speakerInfo}
                    onChange={(e) => setSpeakerInfo(e.target.value)}
                    placeholder="Ví dụ: Tác giả Nguyễn Văn A, Nhà báo B, MC C..."
                  />
                </div>

                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Tóm tắt nội dung & Mục tiêu chương trình *' : 'Event Description & Agenda *'}</label>
                  <textarea 
                    rows={3}
                    required
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Mô tả tóm tắt kịch bản chương trình, ý nghĩa sự kiện và đối tượng độc giả hướng tới..."
                  />
                </div>
              </div>

              {/* PHẦN 2: YÊU CẦU THIẾT BỊ & GHI CHÚ CỦA GIAN HÀNG */}
              <div style={{
                background: '#FAF8F3',
                border: '1px solid #EFE8D8',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1.25rem'
              }}>
                <h4 style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#172421',
                  margin: '0 0 0.85rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>⚡</span>
                  <span>{language === 'vi' ? '2. Yêu cầu Thiết bị & Kỹ thuật từ Ban Quản Lý' : '2. Technical & Equipment Support'}</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                  {assets.map((asset) => (
                    <label 
                      key={asset.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        background: '#FFFFFF',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #E2EAE5'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={selectedEquipment.includes(asset.name)}
                        onChange={() => toggleEquipment(asset.name)}
                      />
                      <span>{asset.name} ({asset.totalQuantity})</span>
                    </label>
                  ))}
                  {assets.length === 0 && <p>{language === 'vi' ? 'Chưa có thiết bị khả dụng trong hệ thống.' : 'No equipment is currently available.'}</p>}
                </div>

                {/* Ô ĐỂ GIAN HÀNG GHI THÊM Ý KIẾN / YÊU CẦU BỔ SUNG */}
                <div className="form-field-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>📝</span>
                    <span>{language === 'vi' ? 'Ghi chú & Ý kiến yêu cầu thêm của gian hàng' : 'Additional Requests / Notes from Booth'}</span>
                  </label>
                  <textarea 
                    rows={2}
                    value={eventDescription.includes('[Yêu cầu bổ sung:') ? '' : undefined}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Store in speaker or description custom tags if needed
                    }}
                    placeholder={language === 'vi' 
                      ? 'Nhập các yêu cầu riêng về thời gian dàn dựng sân khấu, nguồn điện công suất lớn, tiếp đón khách VIP, gửi xe cho diễn giả...' 
                      : 'Special setup times, high power supply, VIP reception, speaker parking...'}
                    style={{ background: '#FFFFFF' }}
                  />
                </div>
              </div>

              {/* Agreement */}
              <div style={{
                background: '#FAFCFB',
                border: '1px solid #E2EAE5',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <input 
                  type="checkbox" 
                  id="modalAgreeTerms"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                />
                <label htmlFor="modalAgreeTerms" style={{ fontSize: '0.83rem', color: '#445752', cursor: 'pointer', lineHeight: 1.5 }}>
                  {language === 'vi'
                    ? 'Tôi cam kết nội dung chương trình tuân thủ đúng Luật Xuất bản, các quy định pháp luật hiện hành và quy chế tổ chức sự kiện tại Đường Sách TP.HCM.'
                    : 'I certify that the proposed program complies with the Publication Law and HCMC Book Street event regulations.'}
                </label>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-part-secondary"
                  onClick={() => setIsOrganizeModalOpen(false)}
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="btn-part-primary"
                  style={{ padding: '0.7rem 1.45rem', fontWeight: 750 }}
                >
                  <Send size={16} />
                  <span>{language === 'vi' ? 'Gửi đề xuất hoạt động' : 'Submit Activity Proposal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

