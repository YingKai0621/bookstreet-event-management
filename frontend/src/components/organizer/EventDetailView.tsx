import { PaginatedList } from '../ui/PaginatedList';
import {
  ArrowLeft,
  Calendar,
  Check,
  Edit3,
  Layers,
  Map,
  Send,
  Star,
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

interface EventDetailViewProps {
  language: Language;
  event: OrganizerEvent;
  booths: OrganizerBoothItem[];
  boothRequests: BoothRequest[];
  activities: OrganizerActivityItem[];
  participants: OrganizerParticipantItem[];
  partnerApplications?: OrganizerPartnerApplication[];
  onApprovePartnerApplication?: (applicationId: string, reviewNote?: string) => void | Promise<void>;
  onRejectPartnerApplication?: (applicationId: string, reviewNote: string) => void | Promise<void>;
  onBack: () => void;
  onNavigateToBoothsMap: () => void;
  onBoothConfigurationChanged?: () => void | Promise<void>;
  onEditEvent: (event: OrganizerEvent) => void;
  onPublishEvent: (event: OrganizerEvent) => void;
}

export const EventDetailView: React.FC<EventDetailViewProps> = ({
  language,
  event,
  booths,
  boothRequests,
  activities,
  participants,
  partnerApplications = [],
  onApprovePartnerApplication,
  onRejectPartnerApplication,
  onBack,
  onNavigateToBoothsMap,
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

  const handleApprovePartner = (id: string) => {
    const reviewNote = window.prompt(
      language === 'vi'
        ? 'Ghi chú xét duyệt (không bắt buộc):'
        : 'Review note (optional):',
      '',
    );
    if (reviewNote === null) return;
    void onApprovePartnerApplication?.(id, reviewNote.trim());
  };

  const handleRejectPartner = (id: string) => {
    const reviewNote = window.prompt(
      language === 'vi'
        ? 'Nhập lý do từ chối hồ sơ:'
        : 'Enter the rejection reason:',
      '',
    );
    if (reviewNote === null) return;
    void onRejectPartnerApplication?.(id, reviewNote.trim());
  };

  return (
    <div className="organizer-content">
      {/* 1. Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn-org-secondary"
          onClick={onBack}
          style={{ padding: '0.35rem 0.85rem', height: '34px' }}
        >
          <ArrowLeft size={14} />
          <span>{language === 'vi' ? 'Quay lại danh sách sự kiện' : 'Back to Events'}</span>
        </button>
      </div>

      {/* 2. Event Header Card matching Sketch Screen 3 */}
      <div className="organizer-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '320px' }}>
            {event.imageUrl && <img
              src={event.imageUrl} 
              alt={event.title}
              style={{ width: '110px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #DCE5E0' }}
            />}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <h1 className="workspace-page-title">
                  {event.title}
                </h1>
                <OrganizerEventStatusChip language={language} status={event.apiStatus} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.82rem', color: '#556B65' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} color="#17382E" />
                  <span>{event.dateRange}</span>
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {event.apiStatus === 'DRAFT' && <button type="button" className="btn-org-primary" onClick={() => onPublishEvent(event)}><Send size={15} />{language === 'vi' ? 'Công bố' : 'Publish'}</button>}
            {event.apiStatus === 'DRAFT' && <button type="button" className="btn-org-secondary" onClick={() => onEditEvent(event)}><Edit3 size={15} />{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</button>}
          </div>
        </div>

        {/* Navigation Tabs matching Sketch Screen 3 */}
        <div className="org-tabs-bar" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
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
        </div>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB: TỔNG QUAN (Matching Sketch Screen 3 layout) */}
      {activeTab === 'overview' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)',
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {/* Left: Thông tin chung */}
          <div className="organizer-card">
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: '#172421', margin: '0 0 1rem 0' }}>
              {language === 'vi' ? 'Thông tin chung' : 'General Overview'}
            </h2>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#637771', display: 'block', marginBottom: '0.35rem' }}>
                {language === 'vi' ? 'Mô tả sự kiện' : 'Description'}
              </span>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#243833', lineHeight: 1.6 }}>
                {event.description}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              borderTop: '1px solid #EEF2F0',
              paddingTop: '1rem',
              fontSize: '0.85rem'
            }}>
              <div>
                <span style={{ color: '#637771', fontSize: '0.76rem', display: 'block' }}>{language === 'vi' ? 'Thời gian' : 'Date'}</span>
                <strong style={{ color: '#172421' }}>{event.dateRange}</strong>
              </div>
              <div>
                <span style={{ color: '#637771', fontSize: '0.76rem', display: 'block' }}>{language === 'vi' ? 'Hạn đăng ký đối tác' : 'Partner application deadline'}</span>
                <strong style={{ color: '#172421' }}>{event.partnerApplicationDeadlineAt ? new Date(event.partnerApplicationDeadlineAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#637771', fontSize: '0.76rem', display: 'block' }}>{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
                <OrganizerEventStatusChip language={language} status={event.apiStatus} className="org-event-detail-status" />
              </div>
              <div>
                <span style={{ color: '#637771', fontSize: '0.76rem', display: 'block' }}>{language === 'vi' ? 'Gian hàng đã cấu hình' : 'Configured booths'}</span>
                <strong style={{ color: '#172421' }}>{booths.length} gian</strong>
              </div>
              <div>
                <span style={{ color: '#637771', fontSize: '0.76rem', display: 'block' }}>{language === 'vi' ? 'Thời hạn giữ chỗ' : 'Hold window'}</span>
                <strong style={{ color: '#172421' }}>{event.boothPaymentWindowMinutes} phút</strong>
              </div>
              <div>
                <span style={{ color: '#637771', fontSize: '0.76rem', display: 'block' }}>{language === 'vi' ? 'Giới hạn gian hàng mỗi đối tác' : 'Booth limit per partner'}</span>
                <strong style={{ color: '#172421' }}>{event.maxBoothsPerPartner}</strong>
              </div>
            </div>
          </div>

          {/* Right: Thống kê nhanh & Thao tác nhanh */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 4 Box Thống kê nhanh matching Sketch Screen 3 */}
            <div className="organizer-card">
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: '#172421', margin: '0 0 1rem 0' }}>
                {language === 'vi' ? 'Thống kê nhanh' : 'Quick Stats'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div style={{ background: '#F8FAF9', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2EAE5' }}>
                  <Users size={16} color="#17382E" />
                  <strong style={{ display: 'block', fontSize: '1.3rem', color: '#172421', margin: '0.35rem 0 0.1rem' }}>
                    {partnerApplications.length.toLocaleString('vi-VN')}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#556B65' }}>Hồ sơ đối tác</span>
                </div>

                <div style={{ background: '#F8FAF9', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2EAE5' }}>
                  <Store size={16} color="#B48A3C" />
                  <strong style={{ display: 'block', fontSize: '1.3rem', color: '#172421', margin: '0.35rem 0 0.1rem' }}>
                    {booths.length}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#556B65' }}>Gian hàng đã cấu hình</span>
                </div>

                <div style={{ background: '#F8FAF9', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2EAE5' }}>
                  <Layers size={16} color="#059669" />
                  <strong style={{ display: 'block', fontSize: '1.3rem', color: '#172421', margin: '0.35rem 0 0.1rem' }}>
                    {boothRequests.filter(item => item.status === 'PENDING').length}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#556B65' }}>Yêu cầu chờ chọn</span>
                </div>

                <div style={{ background: '#F8FAF9', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2EAE5' }}>
                  <Star size={16} color="#E9BC63" />
                  <strong style={{ display: 'block', fontSize: '1.3rem', color: '#172421', margin: '0.35rem 0 0.1rem' }}>
                    {boothRequests.filter(item => item.hold?.status === 'ACTIVE').length}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#556B65' }}>Giữ chỗ đang hoạt động</span>
                </div>
              </div>
            </div>

            {/* Thao tác nhanh matching Sketch Screen 3 */}
            <div className="organizer-card">
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: '#172421', margin: '0 0 1rem 0' }}>
                {language === 'vi' ? 'Thao tác nhanh' : 'Quick Actions'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="btn-org-secondary"
                  style={{ justifyContent: 'flex-start', gap: '0.75rem' }}
                  onClick={onNavigateToBoothsMap}
                >
                  <Map size={15} color="#17382E" />
                  <span>{language === 'vi' ? 'Quản lý sơ đồ vật lý' : 'Manage physical map'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: HỒ SƠ ĐỐI TÁC (PARTNER APPLICATION REVIEW) */}
      {activeTab === 'partners' && (
        <div className="organizer-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: '#172421', margin: 0 }}>
                {language === 'vi' ? 'Hồ sơ đơn vị đăng ký tham gia sự kiện' : 'Partner Event Applications'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#556B65', margin: '0.25rem 0 0 0' }}>
                {language === 'vi' ? 'Đơn vị đối tác cần được Ban Quản Lý phê duyệt trước khi chọn gian hàng hoặc đề xuất hoạt động' : 'Partners must be approved before requesting booths or submitting activity proposals'}
              </p>
            </div>
          </div>

          <PaginatedList items={partnerApplications}>{pageItems => (<div className="org-table-container">
            <table className="org-table">
              <thead>
                <tr>
                  <th>{language === 'vi' ? 'Tên tổ chức' : 'Organization'}</th>
                  <th>{language === 'vi' ? 'Loại hình' : 'Category'}</th>
                  <th>{language === 'vi' ? 'Ngày nộp' : 'Submitted Date'}</th>
                  <th>{language === 'vi' ? 'Nội dung đăng ký' : 'Application Summary'}</th>
                  <th>{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                  <th style={{ textAlign: 'right' }}>{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((pa) => (
                  <tr key={pa.id}>
                    <td>
                      <strong style={{ color: '#172421' }}>{pa.orgName}</strong>
                    </td>
                    <td>
                      <span className="org-chip">{pa.categoryCode}</span>
                    </td>
                    <td>{pa.date}</td>
                    <td style={{ maxWidth: '320px', fontSize: '0.82rem', color: '#556B65' }}>
                      <div>{pa.applicationNote || 'Không có ghi chú đăng ký.'}</div>
                      {pa.reviewNote && (
                        <div style={{ marginTop: '0.35rem', color: '#7C5E1B' }}>
                          Phản hồi: {pa.reviewNote}
                        </div>
                      )}
                    </td>
                    <td>
                      {pa.status === 'approved' && <span className="org-chip approved">● Đã duyệt</span>}
                      {pa.status === 'pending' && <span className="org-chip pending">● Chờ duyệt</span>}
                      {pa.status === 'rejected' && <span className="org-chip rejected">● Đã từ chối</span>}
                      {pa.status === 'withdrawn' && <span className="org-chip">● Đã rút</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {pa.status === 'pending' ? (
                        <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                          <button
                            type="button"
                            className="btn-org-primary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                            onClick={() => handleApprovePartner(pa.id)}
                          >
                            <Check size={13} />
                            <span>Duyệt</span>
                          </button>
                          <button
                            type="button"
                            className="btn-org-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#C84C32' }}
                            onClick={() => handleRejectPartner(pa.id)}
                          >
                            <span>Từ chối</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#8E9F97' }}>Đã hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))}
                {partnerApplications.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#637771' }}>Chưa có hồ sơ đối tác cho sự kiện này.</td></tr>
                )}
              </tbody>
            </table>
          </div>)}</PaginatedList>
        </div>
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
            {event.apiStatus === 'DRAFT' && <button type="button" className="btn-org-primary" onClick={() => onEditEvent(event)}><Edit3 size={15} />Chỉnh sửa</button>}
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

