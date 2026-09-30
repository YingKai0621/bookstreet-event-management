import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Search, ArrowLeft, Check } from 'lucide-react';
import { Language, ParticipantEvent, ParticipantActivity } from '../../types';
import './ParticipantPages.css';

interface EventDetailPageProps {
  language: Language;
  events: ParticipantEvent[];
  activities: ParticipantActivity[];
  onRegisterActivity: (activityId: string) => void;
  onLeaveEvent: (eventId: string) => void | Promise<void>;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  language,
  events,
  activities,
  onRegisterActivity,
  onLeaveEvent,
}) => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'booths' | 'map' | 'info'>('activities');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all-days');
  const [searchQuery, setSearchQuery] = useState('');

  // Find event
  const currentEvent = events.find(e => e.id === eventId) || events[0];
  if (!currentEvent) {
    return <div className="event-detail-for-participant"><p>{language === 'vi' ? 'Không tìm thấy sự kiện.' : 'Event not found.'}</p></div>;
  }
  const eventActivities = activities.filter(a => a.eventId === currentEvent.id);
  const activityDates = [...new Set(eventActivities.map(activity => activity.date).filter(Boolean))];

  // Filter activities
  const filteredActivities = eventActivities.filter(act => {
    const matchCat = categoryFilter === 'all' || act.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchDate = dateFilter === 'all-days' || act.date === dateFilter;
    const matchSearch = searchQuery === '' || 
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.venue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchDate && matchSearch;
  });

  return (
    <div className="event-detail-for-participant">
      {/* Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <button 
          type="button" 
          className="btn-part-secondary"
          onClick={() => navigate('/participant/events')}
          style={{ gap: '0.4rem', padding: '0.35rem 0.85rem', height: '34px' }}
        >
          <ArrowLeft size={14} />
          <span>{language === 'vi' ? 'Quay lại danh sách sự kiện' : 'Back to My Events'}</span>
        </button>
      </div>

      {/* 1. Event Hero/Banner with Title and Leave Event Button (Screen 3) */}
      <div className="event-detail-hero">
        <img src={currentEvent.imageUrl} alt={currentEvent.title} />
        <div className="event-detail-overlay"></div>
        <div className="event-detail-hero-content">
          <div className="event-hero-title-group">
            <h1>{currentEvent.title}</h1>
            <div className="event-hero-meta">
              <span>📅 {currentEvent.dateRange}</span>
              <span>📍 {currentEvent.location}</span>
            </div>
            <div>
              <span className="hero-status-pill">
                {language === 'vi' ? 'Chọn hoạt động để đăng ký' : 'Choose an activity to register'}
              </span>
            </div>
          </div>

          {currentEvent.isJoined && currentEvent.canLeave && (
            <button type="button" className="btn-part-secondary" onClick={() => void onLeaveEvent(currentEvent.id)}>
              {language === 'vi' ? 'Rời sự kiện' : 'Leave event'}
            </button>
          )}

        </div>
      </div>

      {/* 2. Tab Navigation: Tổng quan | Hoạt động (12) | Gian hàng | Bản đồ | Thông tin */}
      <div className="participant-tabs-bar">
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          {language === 'vi' ? 'Tổng quan' : 'Overview'}
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'activities' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          {language === 'vi' ? `Hoạt động (${eventActivities.length})` : `Activities (${eventActivities.length})`}
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'booths' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('booths')}
        >
          {language === 'vi' ? 'Gian hàng' : 'Bookstalls'}
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'map' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          {language === 'vi' ? 'Bản đồ' : 'Map'}
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'info' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          {language === 'vi' ? 'Thông tin' : 'Information'}
        </button>
      </div>

      {/* TAB CONTENT: ACTIVITIES LIST */}
      {activeTab === 'activities' && (
        <div className="event-activities-tab-content">
          <div className="participant-section-heading">
            <h2 className="section-heading-title">
              {language === 'vi' ? 'Danh sách hoạt động' : 'Activities List'}
            </h2>
          </div>

          {/* Filters Bar: Lọc: Tất cả loại | Tất cả ngày | Tìm kiếm hoạt động */}
          <div className="activities-filter-bar">
            <div className="activities-filter-group">
              <span style={{ fontSize: '0.82rem', color: '#637771', fontWeight: 600 }}>
                {language === 'vi' ? 'Lọc:' : 'Filter:'}
              </span>
              <select 
                className="part-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">{language === 'vi' ? 'Tất cả loại' : 'All Categories'}</option>
                <option value="Talkshow">Talkshow</option>
                <option value="Workshop">Workshop</option>
                <option value="Game">Mini game</option>
                <option value="Exhibition">{language === 'vi' ? 'Triển lãm' : 'Exhibition'}</option>
              </select>

              <select className="part-select" value={dateFilter} onChange={event => setDateFilter(event.target.value)}>
                <option value="all-days">{language === 'vi' ? 'Tất cả ngày' : 'All Dates'}</option>
                {activityDates.map(date => <option value={date} key={date}>{date}</option>)}
              </select>
            </div>

            <div className="part-search-input">
              <Search size={15} className="icon" />
              <input
                type="text"
                placeholder={language === 'vi' ? 'Tìm hoạt động...' : 'Search activity...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* List of Activities matching Sketch Screen 3 */}
          <div className="activities-list-stack">
            {filteredActivities.map((act) => {
              const isRegistered = act.status === 'registered';
              const isFull = act.status === 'full' || act.registeredCount >= act.capacity;
              const seatsLeft = Math.max(0, act.capacity - act.registeredCount);

              return (
                <div key={act.id} className="activity-row-card">
                  <img src={act.imageUrl} alt={act.title} className="activity-thumb" />

                  <div className="activity-row-info">
                    <h3 className="activity-row-title">{act.title}</h3>
                    <div className="activity-badge-group">
                      <span className="activity-tag">{act.category}</span>
                      <span className="activity-tag">{act.venue}</span>
                    </div>
                    <div className="activity-row-meta">
                      <span>📅 {act.date}</span>
                      <span>⏰ {act.time}</span>
                    </div>
                  </div>

                  {/* Capacity indicator */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.45rem' }}>
                    {isRegistered ? (
                      <span className="activity-capacity-badge registered">
                        ✓ {language === 'vi' ? 'Đã đăng ký' : 'Registered'}
                      </span>
                    ) : isFull ? (
                      <span className="activity-capacity-badge full">
                        {language === 'vi' ? `Hết chỗ: ${act.capacity}/${act.capacity}` : `Full: ${act.capacity}/${act.capacity}`}
                      </span>
                    ) : (
                      <span className="activity-capacity-badge available">
                        {language === 'vi' ? `Còn chỗ: ${seatsLeft}/${act.capacity}` : `Seats left: ${seatsLeft}/${act.capacity}`}
                      </span>
                    )}

                    <div className="activity-row-actions">
                      <Link 
                        to={`/participant/activities/detail/${act.id}`} 
                        className="btn-part-secondary"
                        style={{ height: '34px', padding: '0 0.85rem', fontSize: '0.78rem' }}
                      >
                        {language === 'vi' ? 'Chi tiết' : 'Details'}
                      </Link>

                      {isRegistered ? (
                        <Link 
                          to={`/participant/activities/qr/${act.id}`} 
                          className="btn-part-primary"
                          style={{ height: '34px', padding: '0 0.95rem', fontSize: '0.78rem' }}
                        >
                          {language === 'vi' ? 'Xem QR' : 'View QR'}
                        </Link>
                      ) : isFull ? (
                        <button
                          type="button"
                          className="btn-part-primary"
                          disabled
                          style={{ height: '34px', padding: '0 0.95rem', fontSize: '0.78rem' }}
                        >
                          {language === 'vi' ? 'Đã hết chỗ' : 'Full'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-part-primary"
                          onClick={() => onRegisterActivity(act.id)}
                          style={{ height: '34px', padding: '0 0.95rem', fontSize: '0.78rem' }}
                        >
                          {language === 'vi' ? 'Đăng ký' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid #E2EAE5' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', marginBottom: '0.75rem' }}>{currentEvent.title}</h2>
          <p style={{ color: '#495D57', lineHeight: '1.6' }}>{currentEvent.shortDesc}</p>
        </div>
      )}

      {/* BOOTHS TAB */}
      {activeTab === 'booths' && (
        <div style={{ background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid #E2EAE5' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            {language === 'vi' ? 'Gian hàng tiêu biểu trong lễ hội' : 'Featured Bookstalls'}
          </h2>
          <div className="activities-list-stack">
            {(currentEvent.booths || []).map(booth => <div className="activity-row-card" key={booth.id}>{booth.imageUrl && <img src={booth.imageUrl} alt={booth.name} className="activity-thumb" />}<div className="activity-row-info"><h3>{booth.code} · {booth.name}</h3><p>{booth.organizationName}</p></div></div>)}
            {!currentEvent.booths?.length && <p>{language === 'vi' ? 'Chưa có gian hàng được phân bổ.' : 'No booths have been assigned.'}</p>}
          </div>
        </div>
      )}

      {/* MAP TAB */}
      {activeTab === 'map' && (
        <div style={{ background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid #E2EAE5', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            {language === 'vi' ? 'Sơ đồ vị trí sân khấu & gian hàng' : 'Event Map'}
          </h2>
          <p style={{ color: '#495D57', marginBottom: '1.5rem' }}>{currentEvent.location}</p>
          <p>{language === 'vi' ? `${currentEvent.booths?.length || 0} gian hàng đang được phân bổ cho sự kiện này.` : `${currentEvent.booths?.length || 0} booths are assigned to this event.`}</p>
        </div>
      )}

      {/* INFO TAB */}
      {activeTab === 'info' && (
        <div style={{ background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid #E2EAE5' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
            {language === 'vi' ? 'Quy định & Lưu ý cho bạn đọc' : 'Information & Guidelines'}
          </h2>
          <ul style={{ paddingLeft: '1.25rem', color: '#495D57', lineHeight: '1.8' }}>
            <li>Giữ gìn vệ sinh chung trên toàn trục phố sách.</li>
            <li>Xuất trình mã QR đăng ký trước mỗi hoạt động 10–15 phút.</li>
            <li>Các hoạt động hoàn toàn miễn phí tham dự cho độc giả.</li>
          </ul>
        </div>
      )}
    </div>
  );
};
