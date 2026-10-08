import {
  ArrowRight,
  Calendar,
  FileText,
  Layers,
  MapPin,
  MessageSquare,
  Plus,
  Store,
  Users
} from 'lucide-react';
import React from 'react';
import { Language } from '../../types';
import { OrganizerActivityItem, OrganizerBoothItem, OrganizerEvent, OrganizerProfile, OrganizerTab } from '../../types/organizer';

interface OrganizerDashboardProps {
  language: Language;
  profile: OrganizerProfile;
  activeEvent: OrganizerEvent;
  events: OrganizerEvent[];
  booths: OrganizerBoothItem[];
  activities: OrganizerActivityItem[];
  onNavigateTab: (tab: OrganizerTab, extraState?: any) => void;
  onOpenCreateEvent: () => void;
  onOpenAttendanceModal: () => void;
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
  language,
  profile,
  activeEvent,
  events,
  booths,
  activities,
  onNavigateTab,
  onOpenCreateEvent,
  onOpenAttendanceModal: _onOpenAttendanceModal
}) => {
  const pendingBooths = booths.filter(item => item.status === 'pending');
  const pendingActivities = activities.filter(item => item.status === 'pending' || item.status === 'need_revision');
  const attentionCount = pendingBooths.length + pendingActivities.length;
  return (
    <div className="organizer-content">
      {/* 1. Greeting & Date Banner matching Sketch Screen 1 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div>
          <h1 className="organizer-view-title" style={{ fontSize: '1.75rem' }}>
            {language === 'vi' ? `Xin chào, ${profile.name}!` : `Welcome back, ${profile.name}!`}
          </h1>
          <p className="organizer-view-sub" style={{ fontSize: '0.92rem', marginTop: '0.35rem' }}>
            {language === 'vi' 
              ? 'Cùng quản lý và tổ chức những sự kiện ý nghĩa tại Đường Sách TP.HCM.'
              : 'Managing and organizing cultural events at HCMC Book Street.'}
          </p>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DCE5E0',
          borderRadius: '8px',
          padding: '0.45rem 0.9rem',
          fontSize: '0.82rem',
          fontWeight: 650,
          color: '#556B65',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Calendar size={15} color="#17382E" />
          <span>{new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </div>
      </div>

      {/* 2. 4 Metric KPI Cards matching Sketch Screen 1 */}
      <div className="org-metric-grid">
        <div className="org-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateTab('events')}>
          <p>{language === 'vi' ? 'Sự kiện đang diễn ra' : 'Active Events'}</p>
          <strong>{events.filter(item => item.status === 'happening').length}</strong>
          <span style={{ color: '#166534', fontWeight: 600 }}>{events.length} sự kiện trong hệ thống</span>
        </div>

        <div className="org-metric-card gold" style={{ cursor: 'pointer' }} onClick={() => onNavigateTab('activities')}>
          <p>{language === 'vi' ? 'Tổng hoạt động' : 'Total Activities'}</p>
          <strong>{activities.length}</strong>
          <span>{activities.filter(item => item.isPublished).length} đã công bố • {pendingActivities.length} cần xử lý</span>
        </div>

        <div className="org-metric-card red" style={{ cursor: 'pointer' }} onClick={() => onNavigateTab('booths')}>
          <p>{language === 'vi' ? 'Gian hàng tham gia' : 'Assigned Booths'}</p>
          <strong>{booths.filter(item => item.status === 'assigned').length}</strong>
          <span>{pendingBooths.length} yêu cầu đang chờ duyệt</span>
        </div>

        <div className="org-metric-card blue" style={{ cursor: 'pointer' }} onClick={() => onNavigateTab('participants')}>
          <p>{language === 'vi' ? 'Tổng lượt đăng ký' : 'Registrations'}</p>
          <strong>{activeEvent.registrationsCount}</strong>
          <span style={{ color: '#0369A1', fontWeight: 600 }}>Đăng ký cho sự kiện đang chọn</span>
        </div>
      </div>

      {/* 3. Two Columns: Featured Upcoming Event (Left) vs Attention Required (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Left Column: Sự kiện sắp diễn ra */}
        <div className="organizer-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: '#172421', margin: 0 }}>
              {language === 'vi' ? 'Sự kiện sắp diễn ra' : 'Upcoming Event Spotlight'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('events')}
              style={{
                background: 'none',
                border: 'none',
                color: '#17382E',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {language === 'vi' ? 'Xem tất cả →' : 'View all →'}
            </button>
          </div>

          <div style={{
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #E2EAE5',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ height: '170px', position: 'relative', overflow: 'hidden' }}>
              <img 
                src={activeEvent.imageUrl} 
                alt={activeEvent.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(23, 56, 46, 0.88)',
                backdropFilter: 'blur(4px)',
                color: '#E9BC63',
                padding: '0.3rem 0.75rem',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                ● {activeEvent.statusLabelVi}
              </div>
            </div>

            <div style={{ padding: '1.25rem', background: '#FFFFFF', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', margin: '0 0 0.5rem 0', color: '#172421' }}>
                  {activeEvent.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem', color: '#556B65', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Calendar size={14} color="#17382E" />
                    <span>{activeEvent.dateRange}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <MapPin size={14} color="#17382E" />
                    <span>{activeEvent.location}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn-org-primary"
                  style={{ width: '100%' }}
                  onClick={() => onNavigateTab('event_detail', { eventId: activeEvent.id })}
                >
                  <span>{language === 'vi' ? 'Quản lý sự kiện này' : 'Manage Event'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hoạt động cần chú ý (Attention Required) */}
        <div className="organizer-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: '#172421', margin: 0 }}>
              {language === 'vi' ? 'Hoạt động cần chú ý' : 'Attention Required'}
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#C84C32', fontWeight: 750, background: '#FEECEB', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              {attentionCount} việc cần xử lý
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
            {/* Item 1: 3 gian hàng đang chờ duyệt */}
            <div 
              onClick={() => onNavigateTab('booths')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                border: '1px solid #FEE2E2',
                background: '#FEF2F2',
                cursor: 'pointer',
                transition: 'transform 140ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEE2E2', display: 'grid', placeItems: 'center', color: '#DC2626' }}>
                <Store size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.86rem', color: '#991B1B' }}>
                  {language === 'vi' ? `${pendingBooths.length} gian hàng đang chờ duyệt` : `${pendingBooths.length} pending booth requests`}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#B91C1C' }}>
                  {pendingBooths.length ? pendingBooths.map(item => item.orgName || item.name).join(', ') : (language === 'vi' ? 'Không có yêu cầu tồn đọng' : 'No pending requests')}
                </span>
              </div>
              <ArrowRight size={16} color="#DC2626" />
            </div>

            {/* Item 2: 5 hoạt động chờ phê duyệt */}
            <div 
              onClick={() => onNavigateTab('activities')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                border: '1px solid #FEF3C7',
                background: '#FFFBEB',
                cursor: 'pointer',
                transition: 'transform 140ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEF3C7', display: 'grid', placeItems: 'center', color: '#D97706' }}>
                <Layers size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.86rem', color: '#92400E' }}>
                  {language === 'vi' ? `${pendingActivities.length} hoạt động cần phê duyệt` : `${pendingActivities.length} activity proposals pending`}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#B45309' }}>
                  {pendingActivities.length ? pendingActivities.map(item => item.title).join(', ') : (language === 'vi' ? 'Không có hoạt động tồn đọng' : 'No pending activities')}
                </span>
              </div>
              <ArrowRight size={16} color="#D97706" />
            </div>

            {/* Tổng đăng ký của sự kiện đang chọn */}
            <div 
              onClick={() => onNavigateTab('participants')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                border: '1px solid #DCFCE7',
                background: '#F0FDF4',
                cursor: 'pointer',
                transition: 'transform 140ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#DCFCE7', display: 'grid', placeItems: 'center', color: '#16A34A' }}>
                <Users size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.86rem', color: '#166534' }}>
                  {language === 'vi' ? `${activeEvent.registrationsCount} lượt đăng ký sự kiện` : `${activeEvent.registrationsCount} event registrations`}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#15803D' }}>
                  {language === 'vi' ? 'Dữ liệu đăng ký hiện tại trong hệ thống' : 'Current registrations in the system'}
                </span>
              </div>
              <ArrowRight size={16} color="#16A34A" />
            </div>

            {/* Báo cáo sự kiện */}
            <div 
              onClick={() => onNavigateTab('reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                border: '1px solid #E0F2FE',
                background: '#F0F9FF',
                cursor: 'pointer',
                transition: 'transform 140ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#E0F2FE', display: 'grid', placeItems: 'center', color: '#0284C7' }}>
                <MessageSquare size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.86rem', color: '#0369A1' }}>
                  {language === 'vi' ? 'Mở báo cáo sự kiện' : 'Open event report'}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#0284C7' }}>
                  {language === 'vi' ? 'Xem số liệu tham dự và phản hồi đã ghi nhận' : 'View recorded attendance and feedback'}
                </span>
              </div>
              <ArrowRight size={16} color="#0284C7" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Action Shortcuts */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EAEFEA', display: 'grid', placeItems: 'center', color: '#17382E' }}>
            ⚡
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: '#172421' }}>
              {language === 'vi' ? 'Lối tắt tác vụ vận hành' : 'Quick Operational Actions'}
            </strong>
            <span style={{ fontSize: '0.74rem', color: '#637771' }}>
              {language === 'vi' ? 'Thao tác nhanh cho phiên làm việc hôm nay' : 'Fast actions for today shift'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn-org-secondary"
            onClick={() => onNavigateTab('booths')}
          >
            <Store size={15} />
            <span>{language === 'vi' ? 'Bản đồ gian hàng' : 'Booth Map'}</span>
          </button>

          <button
            type="button"
            className="btn-org-secondary"
            onClick={() => onNavigateTab('reports')}
          >
            <FileText size={15} />
            <span>{language === 'vi' ? 'Báo cáo thống kê' : 'Reports'}</span>
          </button>

          <button
            type="button"
            className="btn-org-primary"
            onClick={onOpenCreateEvent}
          >
            <Plus size={15} />
            <span>{language === 'vi' ? 'Tạo sự kiện mới' : 'Create Event'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

