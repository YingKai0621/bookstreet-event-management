import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDays, 
  Store, 
  Layers, 
  Users, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  PlusCircle,
  QrCode
} from 'lucide-react';
import { 
  Language, 
  PartnerOrganization, 
  PartnerEventApplication, 
  PartnerBooth, 
  PartnerActivityProposal, 
  PartnerTodoItem 
} from '../../types';
import './PartnerPages.css';

interface PartnerDashboardProps {
  language: Language;
  organization: PartnerOrganization;
  activeEvent: PartnerEventApplication;
  assignedBooth?: PartnerBooth;
  activities: PartnerActivityProposal[];
  todos: PartnerTodoItem[];
  totalEngagementCount?: number;
  onOpenAttendanceModal?: () => void;
}

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({
  language,
  organization,
  activeEvent,
  assignedBooth,
  activities,
  todos,
  totalEngagementCount = 856,
  onOpenAttendanceModal,
}) => {
  const proposedActivitiesCount = activities.length;

  return (
    <div className="partner-dashboard-page">
      {/* 1. Header Greeting + Prominent QR Check-in Button */}
      <div className="partner-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1 className="partner-page-title" style={{ fontSize: '1.9rem', marginBottom: '0.35rem' }}>
            {language === 'vi' ? `Xin chào, ${organization.name}!` : `Welcome back, ${organization.name}!`}
          </h1>
          <p className="partner-page-sub">
            {language === 'vi' 
              ? 'Cổng quản lý gian hàng & hoạt động triển lãm tại Đường Sách TP.HCM.' 
              : 'Partner portal for booth and literary exhibition management at HCMC Book Street.'}
          </p>
        </div>

        {onOpenAttendanceModal && (
          <button 
            type="button" 
            className="btn-part-primary"
            onClick={onOpenAttendanceModal}
            style={{
              padding: '0.75rem 1.4rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              boxShadow: '0 6px 18px rgba(23, 56, 46, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              borderRadius: '10px'
            }}
          >
            <QrCode size={19} />
            <span>{language === 'vi' ? 'Quét mã QR điểm danh' : 'Scan Check-in QR'}</span>
          </button>
        )}
      </div>

      {/* 2. Active Event Card matching Sketch Screen 1 */}
      <div className="partner-active-event-card">
        <div className="event-card-left">
          <img 
            src={activeEvent.imageUrl} 
            alt={activeEvent.eventTitle} 
            className="event-thumb-img"
          />
          <div className="event-info-main">
            <h2>{activeEvent.eventTitle}</h2>
            <div className="event-meta-line">
              <span>📅 {activeEvent.dateRange}</span>
              <span>📍 {activeEvent.location}</span>
            </div>
            <div>
              <span className="status-badge approved">
                ✓ {language === 'vi' ? 'Đã được chấp thuận' : 'Approved'}
              </span>
            </div>
          </div>
        </div>

        <div className="event-card-right">
          <Link to="/partner/events" className="btn-part-secondary">
            <span>{language === 'vi' ? 'Xem chi tiết' : 'View Details'}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* 3. Four Summary Stat Cards matching Sketch Screen 1 */}
      <div className="partner-summary-grid">
        {/* Card 1: Joined Events */}
        <Link to="/partner/events" className="partner-stat-card">
          <div className="stat-num-box">
            1
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Sự kiện tham gia' : 'Joined Events'}
          </div>
        </Link>

        {/* Card 2: Assigned Booths */}
        <Link to="/partner/booths" className="partner-stat-card">
          <div className="stat-num-box green">
            {assignedBooth ? 1 : 0}
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Gian hàng được phân' : 'Assigned Booths'}
          </div>
        </Link>

        {/* Card 3: Proposed Activities */}
        <Link to="/partner/activities" className="partner-stat-card">
          <div className="stat-num-box gold">
            {proposedActivitiesCount}
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Hoạt động đề xuất' : 'Proposed Activities'}
          </div>
        </Link>

        {/* Card 4: Total Participants / Engagement */}
        <Link to="/partner/reports" className="partner-stat-card">
          <div className="stat-num-box">
            {totalEngagementCount}
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Tổng lượt tham gia' : 'Total Participants'}
          </div>
        </Link>
      </div>

      {/* 4. To-Do Section matching Sketch Screen 1 */}
      <div className="partner-todo-section">
        <div className="todo-header-row">
          <h2 className="todo-title">
            {language === 'vi' ? 'Việc cần làm' : 'Tasks & To-Dos'}
          </h2>
          <Link to="/partner/activities" style={{ fontSize: '0.82rem', color: '#17382E', fontWeight: 700, textDecoration: 'none' }}>
            {language === 'vi' ? 'Xem tất cả →' : 'View All →'}
          </Link>
        </div>

        <div className="todo-list-items">
          {todos.map((todo) => {
            const isNeedAction = todo.status === 'need_action';
            const isPending = todo.status === 'pending_review';

            return (
              <Link key={todo.id} to={todo.link} className="todo-item-row">
                <div className="todo-item-left">
                  {isNeedAction ? (
                    <AlertCircle size={20} color="#DC2626" />
                  ) : isPending ? (
                    <Clock size={20} color="#D97706" />
                  ) : (
                    <FileText size={20} color="#6B7280" />
                  )}
                  <div>
                    <div className="todo-item-name">{todo.title}</div>
                    <div className="todo-deadline">
                      {language === 'vi' ? `Hạn: ${todo.deadline}` : `Due: ${todo.deadline}`}
                    </div>
                  </div>
                </div>

                <div>
                  <span className={`status-badge ${todo.status}`}>
                    {todo.statusLabelVi}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 5. Quick Access Action Shortcuts */}
      <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
        <Link to="/partner/events/apply" className="btn-part-secondary">
          <PlusCircle size={15} />
          <span>{language === 'vi' ? 'Đăng ký tham gia sự kiện' : 'Apply for Event'}</span>
        </Link>
        <Link to="/partner/booths/select" className="btn-part-secondary">
          <Store size={15} />
          <span>{language === 'vi' ? 'Chọn gian hàng trên bản đồ' : 'Select Booth on Map'}</span>
        </Link>
        <Link to="/partner/activities" className="btn-part-secondary">
          <Layers size={15} />
          <span>{language === 'vi' ? 'Đề xuất hoạt động mới' : 'Propose Activity'}</span>
        </Link>
      </div>
    </div>
  );
};

