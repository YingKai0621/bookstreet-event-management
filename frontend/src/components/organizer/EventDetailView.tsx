import { PaginatedList } from '../ui/PaginatedList';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  RefreshCw,
  Send,
  Store,
  Users
} from 'lucide-react';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { OrganizerPartnerApplication } from '../../services/organizerApi';
import type { BoothRequest } from '../../types/booth';
import { Language } from '../../types';
import { OrganizerActivityItem, OrganizerBoothItem, OrganizerEvent, OrganizerParticipantItem } from '../../types/organizer';
import { EventBoothConfigurationPanel } from './EventBoothConfigurationPanel';
import { OrganizerEventStatusChip } from './OrganizerEventStatusChip';
import { OrganizerPartnerApplicationsPanel } from './OrganizerPartnerApplicationsPanel';

interface EventDetailViewProps {
  language: Language;
  event: OrganizerEvent;
  booths: OrganizerBoothItem[];
  boothRequests: BoothRequest[];
  activities: OrganizerActivityItem[];
  participants: OrganizerParticipantItem[];
  partnerApplications?: OrganizerPartnerApplication[];
  activePhysicalBoothCount: number;
  isLoadingOperations: boolean;
  operationsError: string;
  onApprovePartnerApplication?: (applicationId: string, reviewNote?: string) => Promise<void>;
  onRejectPartnerApplication?: (applicationId: string, reviewNote: string) => Promise<void>;
  onBack: () => void;
  onNavigateToBoothsMap: () => void;
  onNavigateToBoothRequests: () => void;
  onRetryOperations: () => void;
  onBoothConfigurationChanged?: () => void | Promise<void>;
  onEditEvent: (event: OrganizerEvent) => void;
  onPublishEvent: (event: OrganizerEvent) => void;
}

type DeadlineState = 'open' | 'elapsed' | 'missing';

function formatDateTime(value: string | null | undefined, language: Language): string {
  if (!value) return language === 'vi' ? 'Chưa thiết lập' : 'Not configured';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === 'vi' ? 'Không hợp lệ' : 'Invalid date';
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const datePart = date.toLocaleDateString(locale, {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(locale, {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

function deadlineState(value: string | null | undefined): DeadlineState {
  if (!value) return 'missing';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'missing';
  return timestamp < Date.now() ? 'elapsed' : 'open';
}

function formatHoldWindow(minutes: number, language: Language): string {
  if (minutes > 0 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return language === 'vi' ? `${days} ngày` : `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return language === 'vi' ? `${hours} giờ` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return language === 'vi' ? `${minutes} phút` : `${minutes} minutes`;
}

export const EventDetailView: React.FC<EventDetailViewProps> = ({
  language,
  event,
  booths,
  boothRequests,
  activities,
  participants,
  partnerApplications = [],
  activePhysicalBoothCount,
  isLoadingOperations,
  operationsError,
  onApprovePartnerApplication,
  onRejectPartnerApplication,
  onBack,
  onNavigateToBoothsMap,
  onNavigateToBoothRequests,
  onRetryOperations,
  onBoothConfigurationChanged,
  onEditEvent,
  onPublishEvent
}) => {
  type EventSection = 'overview' | 'partners' | 'booths' | 'activities' | 'participants' | 'schedule' | 'settings';
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionCandidate = searchParams.get('section');
  const validSections: EventSection[] = ['overview', 'partners', 'booths', 'activities', 'participants', 'schedule', 'settings'];
  const activeTab: EventSection = validSections.includes(sectionCandidate as EventSection)
    ? sectionCandidate as EventSection
    : 'overview';
  const selectSection = (section: EventSection) => {
    const next = new URLSearchParams(searchParams);
    if (section === 'overview') next.delete('section');
    else next.set('section', section);
    setSearchParams(next);
  };

  const pendingPartnerCount = partnerApplications.filter((application) => application.status === 'pending').length;
  const pendingBoothRequestCount = boothRequests.filter((request) => request.status === 'PENDING').length;
  const activeHoldCount = boothRequests.filter((request) => request.hold?.status === 'ACTIVE').length;

  const operationMetrics = [
    {
      key: 'partners',
      icon: Users,
      value: partnerApplications.length.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US'),
      label: language === 'vi' ? 'Hồ sơ đối tác' : 'Partner applications',
      detail: language === 'vi' ? `${pendingPartnerCount} chờ duyệt` : `${pendingPartnerCount} pending`,
      tone: 'green',
      onClick: () => selectSection('partners'),
    },
    {
      key: 'booths',
      icon: Store,
      value: activePhysicalBoothCount > 0 ? `${booths.length}/${activePhysicalBoothCount}` : String(booths.length),
      label: language === 'vi' ? 'Gian hàng đã cấu hình' : 'Configured booths',
      detail: activePhysicalBoothCount > 0
        ? (language === 'vi' ? 'Trên tổng số đang khả dụng' : 'Of all active physical booths')
        : (language === 'vi' ? 'Chưa có gian hàng vật lý khả dụng' : 'No active physical booths'),
      tone: 'gold',
      onClick: () => selectSection('booths'),
    },
    {
      key: 'requests',
      icon: Clock3,
      value: pendingBoothRequestCount.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US'),
      label: language === 'vi' ? 'Yêu cầu gian hàng' : 'Booth requests',
      detail: language === 'vi' ? 'Chờ xử lý' : 'Pending review',
      tone: 'blue',
      onClick: onNavigateToBoothRequests,
    },
    {
      key: 'holds',
      icon: Check,
      value: activeHoldCount.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US'),
      label: language === 'vi' ? 'Giữ chỗ hiệu lực' : 'Active holds',
      detail: language === 'vi' ? 'Đang hoạt động' : 'Currently active',
      tone: 'teal',
      onClick: onNavigateToBoothRequests,
    },
  ];

  const registrationDeadlines = [
    {
      label: language === 'vi' ? 'Đăng ký đối tác' : 'Partner applications',
      value: event.partnerApplicationDeadlineAt,
    },
    {
      label: language === 'vi' ? 'Đăng ký người tham gia' : 'Participant registration',
      value: event.participantRegistrationDeadlineAt,
    },
  ];

  const otherDeadlines = [
    {
      label: language === 'vi' ? 'Yêu cầu gian hàng' : 'Booth requests',
      value: event.boothRequestDeadlineAt,
    },
    {
      label: language === 'vi' ? 'Đề xuất hoạt động' : 'Activity proposals',
      value: event.activityProposalDeadlineAt,
    },
    {
      label: language === 'vi' ? 'Rút hồ sơ đối tác' : 'Partner withdrawal',
      value: event.partnerWithdrawalCutoffAt,
    },
    {
      label: language === 'vi' ? 'Hủy gian hàng' : 'Booth cancellation',
      value: event.boothCancellationCutoffAt,
    },
    {
      label: language === 'vi' ? 'Hủy hoạt động' : 'Activity cancellation',
      value: event.activityCancellationCutoffAt,
    },
  ];

  const deadlineLabel = (state: DeadlineState) => {
    if (state === 'open') return language === 'vi' ? 'Còn hiệu lực' : 'Open';
    if (state === 'elapsed') return language === 'vi' ? 'Đã qua' : 'Elapsed';
    return language === 'vi' ? 'Chưa thiết lập' : 'Not configured';
  };

  return (
    <div className="organizer-content org-event-detail">
      <button type="button" className="org-event-detail-back" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        <span>{language === 'vi' ? 'Quay lại danh sách sự kiện' : 'Back to events'}</span>
      </button>

      <header className="org-event-detail-header">
        <div className="org-event-detail-heading">
          <div className="org-event-detail-title-row">
            <h1>{event.title}</h1>
            <OrganizerEventStatusChip language={language} status={event.apiStatus} />
          </div>
          <div className="org-event-detail-actions">
            {event.apiStatus === 'DRAFT' && (
              <button type="button" className="btn-org-secondary" onClick={() => onEditEvent(event)}>
                <Edit3 size={16} />
                {language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
              </button>
            )}
            {event.apiStatus === 'DRAFT' && (
              <button type="button" className="btn-org-primary org-event-detail-publish" onClick={() => onPublishEvent(event)}>
                <Send size={16} />
                {language === 'vi' ? 'Công bố' : 'Publish'}
              </button>
            )}
          </div>
        </div>

        <nav className="org-event-detail-tabs" aria-label={language === 'vi' ? 'Điều hướng chi tiết sự kiện' : 'Event detail navigation'}>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => selectSection('overview')}
          >
            {language === 'vi' ? 'Tổng quan' : 'Overview'}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'partners' ? 'is-active' : ''}`}
            onClick={() => selectSection('partners')}
          >
            {language === 'vi' ? `Hồ sơ đối tác (${partnerApplications.length})` : `Partners (${partnerApplications.length})`}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'booths' ? 'is-active' : ''}`}
            onClick={() => selectSection('booths')}
          >
            {language === 'vi' ? 'Gian hàng' : 'Booths'}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'settings' ? 'is-active' : ''}`}
            onClick={() => selectSection('settings')}
          >
            {language === 'vi' ? 'Cài đặt' : 'Settings'}
          </button>
        </nav>
      </header>

      {/* 3. TAB CONTENT */}

      {activeTab === 'overview' && (
        <div className="org-event-overview">
          <section className="org-event-operations" aria-labelledby="event-operations-title">
            <div className="org-event-section-heading">
              <div>
                <h2 id="event-operations-title">{language === 'vi' ? 'Tình hình sự kiện' : 'Event operations'}</h2>
                <p>{language === 'vi' ? 'Số liệu vận hành hiện tại của riêng sự kiện này.' : 'Current operational data for this event.'}</p>
              </div>
            </div>

            {operationsError && (
              <div className="org-event-data-notice" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{operationsError}</span>
                <button type="button" onClick={onRetryOperations}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {language === 'vi' ? 'Thử lại' : 'Retry'}
                </button>
              </div>
            )}

            <div className="org-event-metric-grid">
              {operationMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <button
                    key={metric.key}
                    type="button"
                    className={`org-event-metric org-event-metric--${metric.tone}`}
                    onClick={metric.onClick}
                    aria-label={`${metric.label}: ${isLoadingOperations || operationsError ? '—' : metric.value}`}
                  >
                    <span className="org-event-metric-icon"><Icon size={20} aria-hidden="true" /></span>
                    <span className="org-event-metric-copy">
                      {isLoadingOperations ? (
                        <span className="org-event-metric-skeleton" aria-label={language === 'vi' ? 'Đang tải' : 'Loading'} />
                      ) : (
                        <strong>{operationsError ? '—' : metric.value}</strong>
                      )}
                      <span>{metric.label}</span>
                      <small>{operationsError ? (language === 'vi' ? 'Chưa thể tải dữ liệu' : 'Data unavailable') : metric.detail}</small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>

          <div className="org-event-overview-grid org-event-overview-grid--equal">
            <section className="org-event-overview-card">
              <div className="org-event-card-title">
                <CalendarDays size={20} aria-hidden="true" />
                <h2>{language === 'vi' ? 'Thời gian sự kiện' : 'Event schedule'}</h2>
              </div>
              <dl className="org-event-time-list">
                <div>
                  <dt>{language === 'vi' ? 'Bắt đầu' : 'Starts'}</dt>
                  <dd>{formatDateTime(event.startDate, language)}</dd>
                </div>
                <div>
                  <dt>{language === 'vi' ? 'Kết thúc' : 'Ends'}</dt>
                  <dd>{formatDateTime(event.endDate, language)}</dd>
                </div>
              </dl>
            </section>

            <section className="org-event-overview-card">
              <div className="org-event-card-title">
                <Clock3 size={20} aria-hidden="true" />
                <h2>{language === 'vi' ? 'Thời hạn đăng ký' : 'Registration deadlines'}</h2>
              </div>
              <div className="org-event-deadline-list org-event-deadline-list--registration">
                {registrationDeadlines.map((deadline) => {
                  const state = deadlineState(deadline.value);
                  return (
                    <div className="org-event-deadline-row" key={deadline.label}>
                      <div>
                        <span>{deadline.label}</span>
                        <strong>{formatDateTime(deadline.value, language)}</strong>
                      </div>
                      <span className={`org-event-deadline-state is-${state}`}>{deadlineLabel(state)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="org-event-overview-grid org-event-overview-grid--details">
            <section className="org-event-overview-card org-event-information-card">
              <div className="org-event-card-title">
                <h2>{language === 'vi' ? 'Thông tin sự kiện' : 'Event information'}</h2>
              </div>
              <p className={`org-event-description ${event.description ? '' : 'is-empty'}`}>
                {event.description || (language === 'vi' ? 'Chưa có mô tả cho sự kiện này.' : 'No event description has been provided.')}
              </p>
              <dl className="org-event-rule-list">
                <div>
                  <dt>{language === 'vi' ? 'Thời hạn giữ chỗ' : 'Booth hold window'}</dt>
                  <dd>{formatHoldWindow(event.boothPaymentWindowMinutes, language)}</dd>
                </div>
                <div>
                  <dt>{language === 'vi' ? 'Gian hàng tối đa / đối tác' : 'Maximum booths / partner'}</dt>
                  <dd>{event.maxBoothsPerPartner}</dd>
                </div>
                <div>
                  <dt>{language === 'vi' ? 'Hoạt động tối đa / đối tác' : 'Maximum activities / partner'}</dt>
                  <dd>{event.maxActivitiesPerPartner}</dd>
                </div>
              </dl>
            </section>

            <section className="org-event-overview-card">
              <div className="org-event-card-title">
                <h2>{language === 'vi' ? 'Mốc thời hạn khác' : 'Other deadlines'}</h2>
              </div>
              <div className="org-event-deadline-list">
                {otherDeadlines.map((deadline) => {
                  const state = deadlineState(deadline.value);
                  return (
                    <div className="org-event-deadline-row org-event-deadline-row--compact" key={deadline.label}>
                      <div>
                        <span>{deadline.label}</span>
                        <strong>{formatDateTime(deadline.value, language)}</strong>
                      </div>
                      <span className={`org-event-deadline-state is-${state}`}>{deadlineLabel(state)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'partners' && (
        <OrganizerPartnerApplicationsPanel
          language={language}
          applications={partnerApplications}
          isLoading={isLoadingOperations}
          error={operationsError}
          onRetry={onRetryOperations}
          onApprove={onApprovePartnerApplication}
          onReject={onRejectPartnerApplication}
        />
      )}

      {/* TAB: GIAN HÀNG */}
      {activeTab === 'booths' && (
        <EventBoothConfigurationPanel
          language={language}
          event={event}
          onChanged={onBoothConfigurationChanged}
        />
      )}

      {/* TAB: HOẠT ĐỘNG */}
      {activeTab === 'activities' && (
        <div className="organizer-card">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: '#172421', margin: '0 0 1.25rem 0' }}>
            {language === 'vi' ? 'Danh sách hoạt động thuộc sự kiện' : 'Event Activities'}
          </h2>

          <PaginatedList items={activities}>{pageItems => (<div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {pageItems.map((act) => (
              <div 
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  border: '1px solid #E2EAE5',
                  borderRadius: '8px',
                  background: '#F8FAF9'
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#172421' }}>{act.title}</strong>
                  <div style={{ fontSize: '0.78rem', color: '#556B65', marginTop: '0.2rem' }}>
                    📅 {act.dateStr} ({act.timeStr}) • 📍 {act.location} • 👤 {act.speaker}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span className={`org-chip ${act.status}`}>● {act.statusLabelVi}</span>
                  <span style={{ fontSize: '0.8rem', color: '#17382E', fontWeight: 650 }}>{act.registeredCount} / {act.capacity}</span>
                </div>
              </div>
            ))}
          </div>)}</PaginatedList>
        </div>
      )}

      {/* TAB: NGƯỜI THAM GIA */}
      {activeTab === 'participants' && (
        <div className="organizer-card">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: '#172421', margin: '0 0 1.25rem 0' }}>
            {language === 'vi' ? 'Độc giả đăng ký tham gia sự kiện' : 'Registered Participants'}
          </h2>

          <PaginatedList items={participants}>{pageItems => (<div className="org-table-container">
            <table className="org-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Mã vé</th>
                  <th>Hoạt động đăng ký</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.fullName}</strong></td>
                    <td>{p.email}</td>
                    <td><code>{p.ticketCode}</code></td>
                    <td>{p.registeredActivitiesCount} hoạt động</td>
                    <td>
                      <span className={`org-chip ${p.status}`}>● {p.statusLabelVi}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>)}</PaginatedList>
        </div>
      )}

      {/* TAB: LỊCH TRÌNH */}
      {activeTab === 'schedule' && (
        <div className="organizer-card">
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: '#172421', margin: '0 0 1.25rem 0' }}>
            {language === 'vi' ? 'Khung thời gian & Lịch trình điều hành' : 'Operational Schedule'}
          </h2>

          <PaginatedList items={activities}>{pageItems => (<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pageItems.map((activity) => (
              <div key={activity.id} style={{ borderLeft: '3px solid #17382E', paddingLeft: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 750, color: '#17382E' }}>{activity.dateStr} · {activity.timeStr}</span>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#445752' }}>
                  {activity.title} · {activity.location}{activity.speaker ? ` · ${activity.speaker}` : ''}
                </p>
              </div>
            ))}
            {activities.length === 0 && <p style={{ color: '#637771' }}>Chưa có hoạt động trong lịch sự kiện.</p>}
          </div>)}</PaginatedList>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="organizer-card" style={{ maxWidth: '760px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Cấu hình sự kiện</h2>
              <p style={{ margin: '0.35rem 0 0', color: '#556B65', fontSize: '0.82rem' }}>Các giá trị đang được lưu trên backend.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-org-secondary" onClick={onNavigateToBoothsMap}>
                <Store size={15} />
                {language === 'vi' ? 'Sơ đồ gian hàng' : 'Booth map'}
              </button>
              {event.apiStatus === 'DRAFT' && <button type="button" className="btn-org-primary" onClick={() => onEditEvent(event)}><Edit3 size={15} />Chỉnh sửa</button>}
            </div>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: '0.75rem 1rem', margin: 0 }}>
            {[
              ['Hạn đối tác đăng ký', event.partnerApplicationDeadlineAt],
              ['Hạn yêu cầu gian hàng', event.boothRequestDeadlineAt],
              ['Hạn đề xuất hoạt động', event.activityProposalDeadlineAt],
              ['Hạn người tham gia đăng ký', event.participantRegistrationDeadlineAt],
              ['Hạn đối tác rút hồ sơ', event.partnerWithdrawalCutoffAt],
              ['Hạn hủy gian hàng', event.boothCancellationCutoffAt],
              ['Hạn hủy hoạt động', event.activityCancellationCutoffAt],
              ['Thời hạn thanh toán gian hàng', `${event.boothPaymentWindowMinutes} phút`],
              ['Số gian hàng tối đa / đối tác', String(event.maxBoothsPerPartner)],
              ['Số hoạt động tối đa / đối tác', String(event.maxActivitiesPerPartner)],
            ].map(([label, value]) => <React.Fragment key={label}><dt style={{ fontWeight: 650, color: '#445752' }}>{label}</dt><dd style={{ margin: 0 }}>{value && value.includes('T') ? new Date(value).toLocaleString('vi-VN') : value || 'Chưa thiết lập'}</dd></React.Fragment>)}
          </dl>
        </div>
      )}
    </div>
  );
};

