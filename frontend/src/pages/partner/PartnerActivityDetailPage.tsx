import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileText,
  QrCode,
  RefreshCw,
  XCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { partnerApi } from '../../services/partnerApi';
import { Language, PartnerActivityProposal } from '../../types';
import { PartnerDialog } from '../../components/partner/PartnerDialog';
import '../../components/partner/PartnerEvents.css';
import './PartnerPages.css';

interface PartnerActivityDetailPageProps {
  language: Language;
  activities: PartnerActivityProposal[];
  onOpenAttendanceModal?: (activityId: string) => void;
  onUpdateActivity?: (id: string, updated: Partial<PartnerActivityProposal>) => void;
}

export const PartnerActivityDetailPage: React.FC<PartnerActivityDetailPageProps> = ({
  language,
  activities,
  onOpenAttendanceModal,
  onUpdateActivity,
}) => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'registration' | 'documents'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [requestKind, setRequestKind] = useState<'change' | 'cancellation' | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  const activity = activities.find(a => a.id === activityId) || activities[0];

  // Edit state
  const [title, setTitle] = useState(activity?.title || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [capacity, setCapacity] = useState(activity?.capacity || 1);
  const [participants, setParticipants] = useState<Array<{ id: string; fullName: string; phone: string; ticketCode: string; status: string }>>([]);

  useEffect(() => {
    if (!activity) return;
    setTitle(activity.title);
    setDescription(activity.description);
    setCapacity(activity.capacity);
    partnerApi.getActivityParticipants(activity.id).then(setParticipants).catch(() => setParticipants([]));
  }, [activity]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateActivity) {
      onUpdateActivity(activity.id, {
        title,
        description,
        capacity
      });
    }
    setIsEditing(false);
  };

  const openRequestDialog = (kind: 'change' | 'cancellation') => {
    setRequestKind(kind);
    setRequestReason('');
    setRequestError('');
    setRequestSuccess('');
  };

  const submitRequest = async () => {
    if (!activity || !requestKind) return;
    const reason = requestReason.trim();
    if (reason.length < 10) {
      setRequestError('Nội dung cần có ít nhất 10 ký tự để Ban Quản Lý có đủ thông tin xử lý.');
      return;
    }
    setRequestBusy(true);
    setRequestError('');
    try {
      if (requestKind === 'change') await partnerApi.requestActivityChange(activity.id, reason);
      else await partnerApi.requestActivityCancellation(activity.id, reason);
      setRequestSuccess(requestKind === 'change'
        ? 'Đã gửi yêu cầu thay đổi đến Ban Quản Lý.'
        : 'Đã gửi yêu cầu hủy đến Ban Quản Lý.');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.');
    } finally {
      setRequestBusy(false);
    }
  };

  if (!activity) return <div className="partner-activity-detail-page"><p className="app-loading-state">Không tìm thấy hoạt động.</p></div>;

  return (
    <div className="partner-activity-detail-page">
      {/* 1. Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn-part-secondary"
          onClick={() => navigate('/partner/activities')}
          style={{ padding: '0.35rem 0.85rem', height: '34px', gap: '0.4rem' }}
        >
          <ArrowLeft size={14} />
          <span>{language === 'vi' ? 'Quay lại danh sách hoạt động' : 'Back to Activities'}</span>
        </button>
      </div>

      {/* 2. Detail Header matching Sketch Screen 6 */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '14px',
        padding: '1.75rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h1 className="partner-page-title" style={{ fontSize: '1.65rem', margin: 0 }}>
                {activity.title}
              </h1>
              <span className={`status-badge ${activity.status}`}>
                {activity.status === 'approved' && '✓ Đã duyệt'}
                {activity.status === 'pending' && '⏳ Chờ duyệt'}
                {activity.status === 'need_changes' && '⚠️ Cần chỉnh sửa'}
                {activity.status === 'cancelled' && '✕ Đã hủy'}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#556B65' }}>
              <span>{activity.eventName}</span> • <span>{activity.category}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-part-secondary"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 size={15} />
              <span>{isEditing ? (language === 'vi' ? 'Đóng chỉnh sửa' : 'Cancel') : (language === 'vi' ? 'Chỉnh sửa' : 'Edit')}</span>
            </button>

            {onOpenAttendanceModal && (
              <button
                type="button"
                className="btn-part-primary"
                onClick={() => onOpenAttendanceModal(activity.id)}
              >
                <QrCode size={15} />
                <span>{language === 'vi' ? 'Xử lý điểm danh (QR)' : 'Process Attendance (QR)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs matching Sketch Screen 6 */}
        <div className="partner-tabs-bar" style={{ marginTop: '1.5rem', marginBottom: 0 }}>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'info' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            {language === 'vi' ? 'Thông tin chung' : 'General Info'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'schedule' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            {language === 'vi' ? 'Lịch trình' : 'Schedule'}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'registration' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('registration')}
          >
            {language === 'vi' ? `Đăng ký (${activity.registeredCount}/${activity.capacity})` : `Registration (${activity.registeredCount}/${activity.capacity})`}
          </button>
          <button
            type="button"
            className={`partner-tab-btn ${activeTab === 'documents' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            {language === 'vi' ? 'Tài liệu' : 'Materials'}
          </button>
        </div>
      </div>

      {/* 3. Detail Content Body matching Sketch Screen 6 */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2EAE5', borderRadius: '14px', padding: '2rem' }}>
        {isEditing ? (
          <form onSubmit={handleSaveEdit} style={{ maxWidth: '700px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              {language === 'vi' ? 'Chỉnh sửa thông tin hoạt động' : 'Edit Activity Information'}
            </h3>
            <div className="form-field-group">
              <label>{language === 'vi' ? 'Tên hoạt động' : 'Title'}</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
              />
            </div>
            <div className="form-field-group">
              <label>{language === 'vi' ? 'Số lượng người tối đa' : 'Capacity'}</label>
              <input 
                type="number" 
                value={capacity} 
                onChange={(e) => setCapacity(Number(e.target.value))} 
              />
            </div>
            <div className="form-field-group">
              <label>{language === 'vi' ? 'Mô tả nội dung' : 'Description'}</label>
              <textarea 
                rows={4} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn-part-secondary" onClick={() => setIsEditing(false)}>
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button type="submit" className="btn-part-primary">
                {language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {activeTab === 'info' && (
              <div>
                <img 
                  src={activity.imageUrl} 
                  alt={activity.title} 
                  className="activity-detail-banner-img"
                />

                {/* Key Specs Grid matching Sketch Screen 6 */}
                <div className="specs-grid-pill">
                  <div className="spec-item">
                    <span className="label">📅 {language === 'vi' ? 'Ngày diễn ra' : 'Date'}</span>
                    <span className="value">{activity.date}</span>
                  </div>
                  <div className="spec-item">
                    <span className="label">⏰ {language === 'vi' ? 'Thời gian' : 'Time'}</span>
                    <span className="value">{activity.time}</span>
                  </div>
                  <div className="spec-item">
                    <span className="label">📍 {language === 'vi' ? 'Địa điểm' : 'Location'}</span>
                    <span className="value">{activity.location}</span>
                  </div>
                  <div className="spec-item">
                    <span className="label">👥 {language === 'vi' ? 'Số người tối đa' : 'Capacity'}</span>
                    <span className="value">{activity.capacity} {language === 'vi' ? 'người' : 'seats'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="label">🎯 {language === 'vi' ? 'Đối tượng tham gia' : 'Audience'}</span>
                    <span className="value">{activity.targetAudience}</span>
                  </div>
                  <div className="spec-item">
                    <span className="label">🎟️ {language === 'vi' ? 'Đã đăng ký' : 'Registered'}</span>
                    <span className="value">{activity.registeredCount} / {activity.capacity}</span>
                  </div>
                </div>

                {/* Description */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#172421', marginBottom: '0.5rem' }}>
                  {language === 'vi' ? 'Mô tả' : 'Description'}
                </h3>
                <p style={{ color: '#495D57', lineHeight: 1.65, fontSize: '0.92rem', marginBottom: '1.75rem', maxWidth: '850px' }}>
                  {activity.description}
                </p>

                {/* Equipment needs matching Sketch Screen 6 */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#172421', marginBottom: '0.65rem' }}>
                  {language === 'vi' ? 'Yêu cầu thiết bị (nếu có)' : 'Equipment & Support Needs'}
                </h3>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                  {activity.requiredEquipments.map((eq, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#F3F7F5',
                        border: '1px solid #D1DDD8',
                        color: '#17382E',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px'
                      }}
                    >
                      {eq}
                    </span>
                  ))}
                </div>

                {/* Bottom Actions Row matching Sketch Screen 6 */}
                <div style={{ display: 'flex', gap: '0.85rem', borderTop: '1px solid #EEF2F0', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-part-secondary"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 size={15} />
                    <span>{language === 'vi' ? 'Chỉnh sửa đề xuất' : 'Edit Proposal'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-part-secondary"
                    onClick={() => openRequestDialog('change')}
                  >
                    <RefreshCw size={15} />
                    <span>{language === 'vi' ? 'Yêu cầu thay đổi' : 'Request Change'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-part-danger"
                    onClick={() => openRequestDialog('cancellation')}
                  >
                    <XCircle size={15} />
                    <span>{language === 'vi' ? 'Yêu cầu hủy' : 'Request Cancellation'}</span>
                  </button>
                  {onOpenAttendanceModal && (
                    <button
                      type="button"
                      className="btn-part-primary"
                      onClick={() => onOpenAttendanceModal(activity.id)}
                      style={{ marginLeft: 'auto' }}
                    >
                      <QrCode size={15} />
                      <span>{language === 'vi' ? 'Điểm danh hoạt động này' : 'Process Attendance'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>
                  {language === 'vi' ? 'Lịch trình chi tiết chương trình' : 'Detailed Timeline'}
                </h3>
                <div style={{ padding: '0.85rem', background: '#F8FAF9', borderRadius: '8px', borderLeft: '3px solid #17382E' }}>
                  <strong>{activity.date} · {activity.time}</strong>
                  <div>{activity.title} · {activity.location}</div>
                </div>
              </div>
            )}

            {activeTab === 'registration' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem' }}>
                  {language === 'vi' ? 'Danh sách độc giả đăng ký tham gia' : 'Registered Participants'}
                </h3>
                <div style={{ background: '#FAF8F3', border: '1px solid #EAE2D1', borderRadius: '8px', padding: '1rem' }}>
                  {participants.map((participant, index) => (
                    <div key={participant.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #EFE8D8', fontSize: '0.86rem' }}>
                      <span>{index + 1}. <strong>{participant.fullName}</strong> ({participant.phone || '—'})</span>
                      <span style={{ color: participant.status === 'attended' ? '#059669' : '#D97706', fontWeight: 600 }}>{participant.ticketCode} · {participant.status === 'attended' ? 'Đã tham gia' : 'Chưa điểm danh'}</span>
                    </div>
                  ))}
                  {participants.length === 0 && <p style={{ margin: 0, color: '#637771' }}>Chưa có độc giả đăng ký.</p>}
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div>
                <p style={{ color: '#556B65', fontSize: '0.88rem', marginBottom: '1rem' }}>
                  {language === 'vi' ? 'Tài liệu hướng dẫn và giáo án hoạt động gửi cho Ban Quản Lý.' : 'Workshop guide and slides.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem', background: '#F8FAF9', borderRadius: '8px' }}>
                  <FileText size={18} color="#17382E" />
                  <span style={{ fontSize: '0.86rem', color: '#637771' }}>Chưa có tài liệu được lưu cho đề xuất này.</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {requestKind && (
        <PartnerDialog
          title={requestKind === 'change' ? 'Yêu cầu thay đổi hoạt động' : 'Yêu cầu hủy hoạt động'}
          onClose={() => !requestBusy && setRequestKind(null)}
        >
          <div className="partner-dialog-body activity-request-dialog">
            {requestSuccess ? (
              <div className="activity-request-success" role="status">
                <span><CheckCircle2 size={26} /></span>
                <h3>Yêu cầu đã được gửi</h3>
                <p>{requestSuccess}</p>
                <button type="button" className="btn-part-primary" onClick={() => setRequestKind(null)}>Đóng</button>
              </div>
            ) : (
              <>
                <div className={`activity-request-intro ${requestKind === 'cancellation' ? 'is-danger' : ''}`}>
                  {requestKind === 'cancellation' ? <AlertCircle size={22} /> : <RefreshCw size={22} />}
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{requestKind === 'change'
                      ? 'Mô tả rõ nội dung cần điều chỉnh để Ban Quản Lý xem xét.'
                      : 'Hãy nêu lý do cụ thể. Hoạt động chỉ bị hủy sau khi yêu cầu được xử lý.'}</p>
                  </div>
                </div>
                {requestError && <div className="partner-form-alert error" role="alert"><AlertCircle size={17} /><span>{requestError}</span></div>}
                <label htmlFor="activity-request-reason">{requestKind === 'change' ? 'Nội dung cần thay đổi' : 'Lý do yêu cầu hủy'}</label>
                <textarea id="activity-request-reason" rows={5} value={requestReason} onChange={event => setRequestReason(event.target.value)} placeholder="Nhập ít nhất 10 ký tự…" disabled={requestBusy} />
                <div className="partner-dialog-actions">
                  <button type="button" className="btn-part-secondary" onClick={() => setRequestKind(null)} disabled={requestBusy}>Để sau</button>
                  <button type="button" className={requestKind === 'cancellation' ? 'btn-part-danger' : 'btn-part-primary'} onClick={() => void submitRequest()} disabled={requestBusy}>
                    {requestBusy ? 'Đang gửi…' : requestKind === 'change' ? 'Gửi yêu cầu thay đổi' : 'Gửi yêu cầu hủy'}
                  </button>
                </div>
              </>
            )}
          </div>
        </PartnerDialog>
      )}
    </div>
  );
};
