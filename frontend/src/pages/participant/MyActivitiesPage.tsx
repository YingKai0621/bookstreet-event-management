import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ArrowRight, Calendar, CheckCircle2, Clock, MapPin, QrCode, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState<'upcoming' | 'attended' | 'cancelled'>('upcoming');

  const upcomingActivities = activities.filter(a => a.status === 'registered');
  const attendedActivities = activities.filter(a => a.status === 'attended');
  const cancelledActivities = activities.filter(a => a.status === 'cancelled');

  const displayedList = 
    activeTab === 'upcoming' 
      ? upcomingActivities 
      : activeTab === 'attended' 
        ? attendedActivities 
        : cancelledActivities;

  return (
    <div className="my-activities-page">
      {/* 1. Header */}
      <PageHeader className="reader-tab-header" title={language === 'vi' ? 'Sự kiện của tôi' : 'My events'} subtitle={language === 'vi' ? 'Lịch tham gia, mã vé và các hoạt động của bạn.' : 'Your schedule, tickets and activities.'} />

      {/* 2. Tabs Bar matching Sketch Screen 5: Sắp diễn ra (2) | Đã tham gia (1) | Đã hủy (0) */}
      <div className="participant-tabs-bar">
        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'upcoming' ? 'is-active' : ''}`}
          aria-pressed={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
        >
          {language === 'vi' ? `Sắp diễn ra (${upcomingActivities.length})` : `Upcoming (${upcomingActivities.length})`}
        </button>

        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'attended' ? 'is-active' : ''}`}
          aria-pressed={activeTab === 'attended'}
          onClick={() => setActiveTab('attended')}
        >
          {language === 'vi' ? `Đã tham gia (${attendedActivities.length})` : `Attended (${attendedActivities.length})`}
        </button>

        <button
          type="button"
          className={`participant-tab-btn ${activeTab === 'cancelled' ? 'is-active' : ''}`}
          aria-pressed={activeTab === 'cancelled'}
          onClick={() => setActiveTab('cancelled')}
        >
          {language === 'vi' ? `Đã hủy (${cancelledActivities.length})` : `Cancelled (${cancelledActivities.length})`}
        </button>
      </div>

      {/* 3. Activity Cards List */}
      {displayedList.length === 0 ? (
        <div className="reader-certificate-empty">
          <EmptyState icon={<Calendar size={28} />} title={language === 'vi' ? 'Chưa có hoạt động trong mục này' : 'No activities in this section'} description={language === 'vi' ? 'Các hoạt động bạn đăng ký sẽ được hiển thị tại đây.' : 'Your registered activities will appear here.'} />
          <div className="reader-empty-actions"><Link to="/participant" className="btn-part-primary">{language === 'vi' ? 'Xem lịch sự kiện' : 'View event calendar'}<ArrowRight size={15} /></Link></div>
        </div>
      ) : (
        <div className="activities-list-stack">
          {displayedList.map((act) => (
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
        </div>
      )}
    </div>
  );
};

