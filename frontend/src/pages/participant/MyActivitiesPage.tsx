import { PaginatedList } from '../../components/ui/PaginatedList';
import { ArrowRight, Calendar, CheckCircle2, Clock, MapPin, QrCode, XCircle } from 'lucide-react';
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Language, ParticipantActivity } from '../../types';
import './ParticipantPages.css';

interface MyActivitiesPageProps {
  language: Language;
  activities: ParticipantActivity[];
  onCancelActivity: (activityId: string) => void;
}

export const MyActivitiesPage: React.FC<MyActivitiesPageProps> = ({
  language,
  activities,
  onCancelActivity,
}) => {
  type RegistrationStatus = 'upcoming' | 'attended' | 'cancelled';
  const [searchParams, setSearchParams] = useSearchParams();
  const statusCandidate = searchParams.get('status');
  const activeTab: RegistrationStatus = ['upcoming', 'attended', 'cancelled'].includes(statusCandidate || '')
    ? statusCandidate as RegistrationStatus
    : 'upcoming';
  const searchQuery = (searchParams.get('search') || '').trim().toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US');
  React.useEffect(() => {
    if (!statusCandidate || ['upcoming', 'attended', 'cancelled'].includes(statusCandidate)) return;
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, statusCandidate]);
  const selectStatus = (status: RegistrationStatus) => {
    const next = new URLSearchParams(searchParams);
    if (status === 'upcoming') next.delete('status');
    else next.set('status', status);
    setSearchParams(next);
  };

  const upcomingActivities = activities.filter(a => a.status === 'registered');
  const attendedActivities = activities.filter(a => a.status === 'attended');
  const cancelledActivities = activities.filter(a => a.status === 'cancelled');

  const statusList =
    activeTab === 'upcoming' 
      ? upcomingActivities 
      : activeTab === 'attended' 
        ? attendedActivities 
        : cancelledActivities;
  const displayedList = statusList.filter(activity => !searchQuery
    || activity.title.toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US').includes(searchQuery)
    || activity.eventName.toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US').includes(searchQuery));

  return (
    <div className="my-activities-page">
      {/* 1. Header */}
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">
          {language === 'vi' ? 'Sự kiện của tôi' : 'My Events'}
        </h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {language === 'vi' 
            ? 'Theo dõi các hoạt động bạn đã đăng ký trong những sự kiện mình tham gia, nhận chứng nhận và xuất trình mã QR check-in.'
            : 'Track activities registered in your events, access check-in QR codes and view earned certificates.'}
        </p>
      </div>

      {/* 2. Tabs Bar matching Sketch Screen 5: Sắp diễn ra (2) | Đã tham gia (1) | Đã hủy (0) */}
      <div className="participant-tabs-bar">
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'upcoming' ? 'is-active' : ''}`}
          onClick={() => selectStatus('upcoming')}
        >
          {language === 'vi' ? `Sắp diễn ra (${upcomingActivities.length})` : `Upcoming (${upcomingActivities.length})`}
        </button>

        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'attended' ? 'is-active' : ''}`}
          onClick={() => selectStatus('attended')}
        >
          {language === 'vi' ? `Đã tham gia (${attendedActivities.length})` : `Attended (${attendedActivities.length})`}
        </button>

        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'cancelled' ? 'is-active' : ''}`}
          onClick={() => selectStatus('cancelled')}
        >
          {language === 'vi' ? `Đã hủy (${cancelledActivities.length})` : `Cancelled (${cancelledActivities.length})`}
        </button>
      </div>

      {/* 3. Activity Cards List */}
      {displayedList.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2EAE5',
          borderRadius: '14px',
          padding: '3rem 2rem',
          textAlign: 'center',
          color: '#637771'
        }}>
          <p style={{ fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            {language === 'vi' 
              ? 'Không có hoạt động nào trong danh mục này.' 
              : 'No activities found in this section.'}
          </p>
          <Link to="/#su-kien" className="btn-part-primary">
            <span>{language === 'vi' ? 'Khám phá sự kiện' : 'Explore events'}</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <PaginatedList items={displayedList}>{pageItems => (<div className="activities-list-stack">
          {pageItems.map((act) => (
            <div key={act.id} className="activity-row-card">
              {/* Thumbnail */}
              <img src={act.imageUrl || undefined} alt={act.title} className="activity-thumb" />

              {/* Main Information */}
              <div className="activity-row-info">
                <div className="activity-badge-group">
                  <span className="activity-tag">{act.eventName}</span>
                  <span className="activity-tag">{act.category}</span>
                  {act.registrationCode && (
                    <span 
                      className="activity-tag" 
                      style={{ background: '#FDF7EB', color: '#9C7226', border: '1px solid #F3DFC0', fontWeight: 800 }}
                    >
                      Mã: {act.registrationCode}
                    </span>
                  )}
                </div>

                <h3 className="activity-row-title">
                  <Link 
                    to={`/participant/activities/detail/${act.id}`} 
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {act.title}
                  </Link>
                </h3>

                <div className="activity-row-meta">
                  <span>
                    <Calendar size={14} color="#637771" />
                    {act.date}
                  </span>
                  <span>
                    <Clock size={14} color="#637771" />
                    {act.time}
                  </span>
                  <span>
                    <MapPin size={14} color="#637771" />
                    {act.venue}
                  </span>
                </div>
              </div>

              {/* Action Buttons matching Screen 5 */}
              <div className="activity-row-actions">
                <Link
                  to={`/participant/activities/detail/${act.id}`}
                  className="btn-part-secondary"
                  style={{ height: '36px', padding: '0 0.95rem', fontSize: '0.82rem' }}
                >
                  {language === 'vi' ? 'Chi tiết' : 'Details'}
                </Link>

                {activeTab === 'upcoming' && (
                  <>
                    <Link
                      to={`/participant/activities/qr/${act.id}`}
                      className="btn-part-primary"
                      style={{ height: '36px', padding: '0 1rem', fontSize: '0.82rem' }}
                    >
                      <QrCode size={15} />
                      <span>{language === 'vi' ? 'Xem QR' : 'View QR'}</span>
                    </Link>

                    <button
                      type="button"
                      className="btn-part-danger-outline"
                      style={{ height: '36px', padding: '0 0.85rem' }}
                      title={language === 'vi' ? 'Hủy đăng ký hoạt động này' : 'Cancel registration'}
                      onClick={() => {
                        if (window.confirm(language === 'vi' ? 'Bạn có muốn hủy đăng ký hoạt động này?' : 'Cancel registration?')) {
                          onCancelActivity(act.id);
                        }
                      }}
                    >
                      <XCircle size={15} />
                      <span>{language === 'vi' ? 'Hủy' : 'Cancel'}</span>
                    </button>
                  </>
                )}

                {activeTab === 'attended' && (
                  <Link
                    to="/participant/certificates"
                    className="btn-part-primary"
                    style={{ height: '36px', padding: '0 1rem', fontSize: '0.82rem' }}
                  >
                    <CheckCircle2 size={15} />
                    <span>{language === 'vi' ? 'Chứng nhận' : 'Certificate'}</span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>)}</PaginatedList>
      )}
    </div>
  );
};

