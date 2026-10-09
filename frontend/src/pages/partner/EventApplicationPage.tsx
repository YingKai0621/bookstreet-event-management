import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  Send,
  Undo2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../services/apiClient';
import { PartnerAvailableEvent, partnerApi } from '../../services/partnerApi';
import { Language, PartnerEventApplication, PartnerOrganization } from '../../types';
import './PartnerPages.css';

interface EventApplicationPageProps {
  language: Language;
  organization: PartnerOrganization | null;
}

const STATUS_LABELS: Record<PartnerEventApplication['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  withdrawn: 'Đã rút',
};

function formatDateTime(value: string | null): string {
  if (!value) return 'Chưa cấu hình';
  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function applicationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Không thể xử lý hồ sơ đăng ký.';
  }

  switch (error.code) {
    case 'PARTNER_ORGANIZATION_REQUIRED':
      return 'Bạn cần hoàn thiện một hồ sơ tổ chức đang hoạt động trước khi đăng ký.';
    case 'EVENT_NOT_ACCEPTING_APPLICATIONS':
      return 'Sự kiện này hiện không nhận hồ sơ đối tác.';
    case 'APPLICATION_DEADLINE_PASSED':
      return 'Đã hết hạn đăng ký đối tác cho sự kiện này.';
    case 'APPLICATION_ALREADY_EXISTS':
      return 'Tổ chức đã có hồ sơ cho sự kiện này và không thể đăng ký lần hai.';
    case 'APPLICATION_NOT_PENDING':
      return 'Chỉ hồ sơ đang chờ duyệt mới có thể rút.';
    default:
      return error.message;
  }
}

export const EventApplicationPage: React.FC<EventApplicationPageProps> = ({
  language,
  organization,
}) => {
  const [events, setEvents] = useState<PartnerAvailableEvent[]>([]);
  const [applications, setApplications] = useState<PartnerEventApplication[]>([]);
  const [applicationNotes, setApplicationNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [publishedEvents, ownApplications] = await Promise.all([
        partnerApi.getPublishedEvents(),
        partnerApi.getApplications(),
      ]);
      setEvents(publishedEvents);
      setApplications(ownApplications);
    } catch (error) {
      setErrorMessage(applicationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const submitApplication = async (event: PartnerAvailableEvent) => {
    setProcessingId(event.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await partnerApi.submitApplication(event.id, applicationNotes[event.id]?.trim() || '');
      setSuccessMessage(`Đã gửi hồ sơ tham gia “${event.name}”.`);
      setApplications(await partnerApi.getApplications());
    } catch (error) {
      setErrorMessage(applicationErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const withdrawApplication = async (application: PartnerEventApplication) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn rút hồ sơ tham gia “${application.eventTitle}”?`,
    );
    if (!confirmed) return;

    setProcessingId(application.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await partnerApi.withdrawApplication(application.id);
      setSuccessMessage(`Đã rút hồ sơ tham gia “${application.eventTitle}”.`);
      setApplications(await partnerApi.getApplications());
    } catch (error) {
      setErrorMessage(applicationErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const applicationByEventId = new Map(
    applications.map(application => [application.eventId, application]),
  );

  return (
    <div className="partner-page">
      <div className="partner-page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="partner-page-title">
            {language === 'vi' ? 'Đăng ký tham gia sự kiện' : 'Event Applications'}
          </h1>
          <p className="partner-page-sub">
            {language === 'vi'
              ? 'Chọn sự kiện đang nhận đăng ký và theo dõi kết quả xét duyệt của Ban Quản Lý.'
              : 'Apply to published events and follow the Organizer review result.'}
          </p>
        </div>
        <button type="button" className="btn-part-secondary" onClick={() => void loadData()} disabled={isLoading}>
          <RefreshCw size={15} />
          <span>Làm mới</span>
        </button>
      </div>

      {errorMessage && (
        <div role="alert" className="partner-form-alert error">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div role="status" className="partner-form-alert success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {!organization && (
        <div className="partner-form-alert error" style={{ marginBottom: '1.5rem' }}>
          <Building2 size={20} />
          <div>
            <strong>Chưa có hồ sơ tổ chức</strong>
            <p style={{ margin: '0.25rem 0 0' }}>
              Hãy <Link to="/partner/profile">tạo hồ sơ tổ chức</Link> trước khi gửi đăng ký tham gia sự kiện.
            </p>
          </div>
        </div>
      )}

      <section style={{ marginBottom: '2rem' }} aria-labelledby="available-events-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <CalendarDays size={20} color="#17382E" />
          <h2 id="available-events-title" style={{ margin: 0, fontSize: '1.2rem' }}>Sự kiện đang công bố</h2>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {[1, 2].map(idx => (
              <div key={idx} className="partner-card skeleton-card" style={{ padding: '1.25rem', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <div className="skeleton-box" style={{ width: 140, height: 100, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div className="skeleton-box" style={{ width: '40%', height: '1.2rem', borderRadius: 4 }} />
                    <div className="skeleton-box" style={{ width: '80%', height: '0.9rem', borderRadius: 4 }} />
                    <div className="skeleton-box" style={{ width: '35%', height: '0.85rem', borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !errorMessage && events.length === 0 ? (
          <div className="partner-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#FAF8F5', border: '1px solid #EAE5DC' }}>
            <CalendarDays size={36} color="#B3862A" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <h3 style={{ margin: '0 0 0.35rem', color: '#172421', fontSize: '1.1rem' }}>
              {language === 'vi' ? 'Hiện chưa có sự kiện mở đăng ký' : 'No Events Open for Registration'}
            </h3>
            <p style={{ margin: 0, color: '#637771', fontSize: '0.88rem', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              {language === 'vi'
                ? 'Ban Quản Lý Đường Sách sẽ sớm công bố lịch các sự kiện văn hóa và tuần lễ sách tiếp theo. Hãy đảm bảo hồ sơ tổ chức đã hoàn thiện để sẵn sàng gửi đăng ký.'
                : 'Upcoming Book Street events will be published here soon. Please make sure your organization profile is completed to be ready.'}
            </p>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: '1rem' }}>
          {events.map(event => {
            const existingApplication = applicationByEventId.get(event.id);
            const canSubmit = Boolean(organization)
              && organization?.status === 'ACTIVE'
              && event.acceptingApplications
              && !existingApplication;

            return (
              <article key={event.id} className="partner-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: event.bannerUrl ? '150px minmax(0, 1fr)' : '1fr', gap: '1.25rem' }}>
                  {event.bannerUrl && (
                    <img src={event.bannerUrl} alt={event.name} style={{ width: '150px', height: '110px', borderRadius: '10px', objectFit: 'cover' }} />
                  )}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#172421' }}>{event.name}</h3>
                        <p style={{ margin: '0.5rem 0', color: '#556B65', lineHeight: 1.55 }}>{event.description || 'Không có mô tả.'}</p>
                      </div>
                      {existingApplication && (
                        <span className={`status-badge ${existingApplication.status}`}>
                          {STATUS_LABELS[existingApplication.status]}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', color: '#556B65', fontSize: '0.84rem', marginBottom: '0.85rem' }}>
                      <span><CalendarDays size={14} /> {formatDateTime(event.startAt)} – {formatDateTime(event.endAt)}</span>
                      <span><Clock3 size={14} /> Hạn đăng ký: {formatDateTime(event.partnerApplicationDeadlineAt)}</span>
                    </div>

                    {!existingApplication && (
                      <div style={{ display: 'grid', gap: '0.65rem' }}>
                        <label htmlFor={`application-note-${event.id}`} style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                          Ghi chú đăng ký (không bắt buộc)
                        </label>
                        <textarea
                          id={`application-note-${event.id}`}
                          rows={3}
                          value={applicationNotes[event.id] || ''}
                          onChange={changeEvent => setApplicationNotes(current => ({
                            ...current,
                            [event.id]: changeEvent.target.value,
                          }))}
                          placeholder="Giới thiệu ngắn nhu cầu tham gia sự kiện..."
                          disabled={!canSubmit || processingId === event.id}
                        />
                        <div>
                          <button
                            type="button"
                            className="btn-part-primary"
                            onClick={() => void submitApplication(event)}
                            disabled={!canSubmit || processingId === event.id}
                          >
                            <Send size={15} />
                            <span>{processingId === event.id ? 'Đang gửi...' : 'Gửi hồ sơ đăng ký'}</span>
                          </button>
                          {!event.acceptingApplications && (
                            <span style={{ marginLeft: '0.75rem', color: '#B45309', fontSize: '0.82rem' }}>Đã đóng đăng ký</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="own-applications-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <FileText size={20} color="#17382E" />
          <h2 id="own-applications-title" style={{ margin: 0, fontSize: '1.2rem' }}>Hồ sơ đã gửi</h2>
        </div>

        {!isLoading && applications.length === 0 && (
          <div className="partner-card" style={{ padding: '2rem 1.5rem', textAlign: 'center', background: '#FAF8F5', border: '1px solid #EAE5DC' }}>
            <FileText size={32} color="#7A8E87" style={{ margin: '0 auto 0.65rem', display: 'block' }} />
            <h3 style={{ margin: '0 0 0.25rem', color: '#172421', fontSize: '1.05rem' }}>
              {language === 'vi' ? 'Bạn chưa gửi hồ sơ tham gia sự kiện nào' : 'No Submitted Applications Yet'}
            </h3>
            <p style={{ margin: 0, color: '#637771', fontSize: '0.86rem' }}>
              {language === 'vi'
                ? 'Khi có sự kiện mở đăng ký ở danh mục phía trên, hãy chọn sự kiện và gửi hồ sơ để bắt đầu.'
                : 'Apply for open events in the section above to track review status and approvals.'}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {applications.map(application => (
            <article key={application.id} className="partner-card" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{application.eventTitle}</h3>
                  <p style={{ margin: '0.4rem 0', color: '#637771', fontSize: '0.82rem' }}>
                    Nộp lúc: {application.submittedAt}
                  </p>
                  <p style={{ margin: '0.4rem 0', color: '#334943' }}>
                    {application.applicationNote || 'Không có ghi chú đăng ký.'}
                  </p>
                  {application.reviewNote && (
                    <p style={{ margin: '0.45rem 0 0', color: '#7C5E1B' }}>
                      Phản hồi từ Ban Quản Lý: {application.reviewNote}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`status-badge ${application.status}`}>
                    {STATUS_LABELS[application.status]}
                  </span>
                  {application.status === 'pending' && (
                    <button
                      type="button"
                      className="btn-part-secondary"
                      onClick={() => void withdrawApplication(application)}
                      disabled={processingId === application.id}
                    >
                      <Undo2 size={15} />
                      <span>{processingId === application.id ? 'Đang rút...' : 'Rút hồ sơ'}</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
