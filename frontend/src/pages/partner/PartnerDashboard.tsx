import {
  AlertCircle,
  ArrowRight,
  Clock,
  FileText,
  Layers,
  PlusCircle,
  Store
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Language,
  PartnerActivityProposal,
  PartnerBooth,
  PartnerEventApplication,
  PartnerOrganization,
  PartnerTodoItem
} from '../../types';
import './PartnerPages.css';

interface PartnerDashboardProps {
  language: Language;
  organization: PartnerOrganization;
  activeEvent?: PartnerEventApplication | null;
  assignedBooth?: PartnerBooth | null;
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
  totalEngagementCount = 0,
  onOpenAttendanceModal: _onOpenAttendanceModal,
}) => {
  const proposedActivitiesCount = activities.length;
  const applicationStatus = activeEvent ? {
    pending: {
      className: 'pending',
      labelVi: 'Đang chờ xét duyệt',
      labelEn: 'Pending review',
    },
    approved: {
      className: 'approved',
      labelVi: 'Đã được chấp thuận',
      labelEn: 'Approved',
    },
    rejected: {
      className: 'rejected',
      labelVi: 'Đã bị từ chối',
      labelEn: 'Rejected',
    },
    withdrawn: {
      className: 'withdrawn',
      labelVi: 'Đã rút hồ sơ',
      labelEn: 'Withdrawn',
    },
  }[activeEvent.status] : null;

  return (
    <div className="partner-dashboard-page">
      {/* 1. Header Greeting */}
      <div className="partner-page-header">
        <h1 className="partner-page-title">
          {language === 'vi' ? `Xin chào, ${organization.name}!` : `Welcome back, ${organization.name}!`}
        </h1>
        <p className="partner-page-sub">
          {language === 'vi' 
            ? 'Cổng quản lý gian hàng & hoạt động triển lãm tại Đường Sách TP.HCM.' 
            : 'Partner portal for booth and literary exhibition management at HCMC Book Street.'}
        </p>
      </div>

      {/* 2. Active Event Card or Waiting State */}
      {activeEvent && applicationStatus ? (
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
                <span className={`status-badge ${applicationStatus.className}`}>
                  {language === 'vi' ? applicationStatus.labelVi : applicationStatus.labelEn}
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
      ) : (
        <div className="partner-card partner-empty-event-banner">
          <div className="partner-empty-event-left">
            <div className="partner-empty-event-icon">
              <Clock size={28} />
            </div>
            <div className="partner-empty-event-text">
              <div className="partner-empty-event-kicker">
                {language === 'vi' ? 'TRẠNG THÁI SỰ KIỆN' : 'EVENT STATUS'}
              </div>
              <h2 className="partner-empty-event-heading">
                {language === 'vi' ? 'Chưa có sự kiện đang tham gia' : 'No Active Event Application'}
              </h2>
              <p className="partner-empty-event-desc">
                {language === 'vi'
                  ? 'Hãy mở danh sách sự kiện đang mở đăng ký để gửi hồ sơ tham gia gian hàng hoặc hoạt động.'
                  : 'Browse available events to register your organization for booth or workshop participation.'}
              </p>
            </div>
          </div>
          <Link to="/partner/events" className="btn-part-primary partner-empty-event-btn">
            <span>{language === 'vi' ? 'Đăng ký sự kiện' : 'Apply for Event'}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

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
          {todos.length === 0 ? (
            <div style={{ padding: '1.5rem', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DC', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#172421' }}>
                {language === 'vi' ? 'Các bước bắt đầu dành cho đối tác mới:' : 'Getting started steps for new partners:'}
              </div>
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <Link to="/partner/profile" className="todo-item-row" style={{ background: '#FFFFFF', padding: '0.75rem 1rem' }}>
                  <div className="todo-item-left">
                    <FileText size={18} color="#17382E" />
                    <div>
                      <div className="todo-item-name">{language === 'vi' ? '1. Hoàn thiện hồ sơ tổ chức / doanh nghiệp' : '1. Complete organization profile'}</div>
                      <div className="todo-deadline">{language === 'vi' ? 'Cần thiết để gửi đăng ký sự kiện' : 'Required for event application'}</div>
                    </div>
                  </div>
                  <span className="status-badge pending">{language === 'vi' ? 'Cần thực hiện' : 'Action needed'}</span>
                </Link>

                <Link to="/partner/events" className="todo-item-row" style={{ background: '#FFFFFF', padding: '0.75rem 1rem' }}>
                  <div className="todo-item-left">
                    <Clock size={18} color="#D97706" />
                    <div>
                      <div className="todo-item-name">{language === 'vi' ? '2. Chọn sự kiện và gửi hồ sơ tham gia' : '2. Apply for published event'}</div>
                      <div className="todo-deadline">{language === 'vi' ? 'Theo dõi hạn chót đăng ký' : 'Check submission deadline'}</div>
                    </div>
                  </div>
                  <span className="status-badge" style={{ background: '#F0F4F2', color: '#495D57' }}>{language === 'vi' ? 'Bước kế tiếp' : 'Next step'}</span>
                </Link>
              </div>
            </div>
          ) : (
            todos.map((todo) => {
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
            })
          )}
        </div>
      </div>

      {/* 5. Quick Access Action Shortcuts */}
      <div className="partner-quick-actions-row">
        <Link to="/partner/events/apply" className="btn-part-secondary partner-quick-action-btn">
          <PlusCircle size={15} />
          <span>{language === 'vi' ? 'Đăng ký tham gia sự kiện' : 'Apply for Event'}</span>
        </Link>
        <Link to="/partner/booths/select" className="btn-part-secondary partner-quick-action-btn">
          <Store size={15} />
          <span>{language === 'vi' ? 'Chọn gian hàng trên bản đồ' : 'Select Booth on Map'}</span>
        </Link>
        <Link to="/partner/activities" className="btn-part-secondary partner-quick-action-btn">
          <Layers size={15} />
          <span>{language === 'vi' ? 'Đề xuất hoạt động mới' : 'Propose Activity'}</span>
        </Link>
      </div>
    </div>
  );
};

