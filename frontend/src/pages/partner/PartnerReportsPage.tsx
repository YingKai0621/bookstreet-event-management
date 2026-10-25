import {
  BarChart3,
  Download,
  Star
} from 'lucide-react';
import React, { useState } from 'react';
import { Language, PartnerReportStats } from '../../types';
import './PartnerPages.css';

interface PartnerReportsPageProps {
  language: Language;
  reportStats: PartnerReportStats;
}

export const PartnerReportsPage: React.FC<PartnerReportsPageProps> = ({
  language,
  reportStats,
}) => {
  const [selectedEvent, setSelectedEvent] = useState(reportStats.eventId);
  const exportReport = () => {
    const rows = [['Sự kiện', reportStats.eventName], ['Tổng lượt tham gia', reportStats.totalParticipants], ['Hoạt động', reportStats.totalActivities], ['Tỷ lệ tham dự', `${reportStats.attendanceRate}%`], ['Đánh giá trung bình', reportStats.averageRating], [], ['Hoạt động', 'Lượt tham gia'], ...reportStats.activityStats.map(item => [item.name, item.count])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `bao-cao-doi-tac-${reportStats.eventId || 'su-kien'}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="partner-reports-page">
      {/* 1. Header matching Sketch Screen 7 */}
      <div className="partner-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="partner-page-title workspace-page-title">
            {language === 'vi' ? 'Thống kê sau sự kiện' : 'Reports & Statistics'}
          </h1>
          <p className="partner-page-sub workspace-page-subtitle">
            {language === 'vi' 
              ? 'Báo cáo hiệu quả tham gia gian hàng và các hoạt động tương tác độc giả.' 
              : 'Post-event performance, attendance metrics and reader feedback.'}
          </p>
        </div>

        {/* Event Filter Dropdown matching Sketch Screen 7 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: '1px solid #D5DFDC',
              fontSize: '0.86rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#172421',
              cursor: 'pointer'
            }}
          >
            <option value={reportStats.eventId}>{reportStats.eventName || (language === 'vi' ? 'Sự kiện hiện tại' : 'Current event')}</option>
          </select>

          <button
            type="button"
            className="btn-part-secondary"
            onClick={exportReport}
          >
            <Download size={15} />
            <span>{language === 'vi' ? 'Xuất báo cáo' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards matching Sketch Screen 7 */}
      <div className="partner-summary-grid">
        {/* Card 1: Total participants */}
        <div className="partner-stat-card">
          <div className="stat-num-box">
            {reportStats.totalParticipants}
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Tổng lượt tham gia' : 'Total Participants'}
          </div>
        </div>

        {/* Card 2: Total activities */}
        <div className="partner-stat-card">
          <div className="stat-num-box gold">
            {reportStats.totalActivities}
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Hoạt động tổ chức' : 'Total Activities'}
          </div>
        </div>

        {/* Card 3: Attendance rate */}
        <div className="partner-stat-card">
          <div className="stat-num-box green">
            {reportStats.attendanceRate}%
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Tỷ lệ tham dự' : 'Attendance Rate'}
          </div>
        </div>

        {/* Card 4: Average rating */}
        <div className="partner-stat-card">
          <div className="stat-num-box gold">
            <Star size={24} fill="#B3862A" color="#B3862A" />
            <span>{reportStats.averageRating}</span>
          </div>
          <div className="stat-label-muted">
            {language === 'vi' ? 'Đánh giá trung bình' : 'Average Rating'}
          </div>
        </div>
      </div>

      {/* 3. Charts Grid or Waiting State */}
      {reportStats.activityStats.length === 0 && reportStats.totalParticipants === 0 ? (
        <div className="partner-card" style={{ padding: '3rem 2rem', textAlign: 'center', background: '#FAF8F5', border: '1px solid #EAE5DC' }}>
          <BarChart3 size={40} color="#B3862A" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ margin: '0 0 0.4rem', color: '#172421', fontSize: '1.25rem', fontFamily: 'var(--font-serif)' }}>
            {language === 'vi' ? 'Chưa có dữ liệu thống kê sau sự kiện' : 'No Post-Event Data Yet'}
          </h3>
          <p style={{ margin: 0, color: '#637771', fontSize: '0.9rem', maxWidth: '540px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
            {language === 'vi'
              ? 'Số liệu lượt tham gia, tỷ lệ điểm danh và biểu đồ đánh giá từ bạn đọc sẽ được hệ thống tổng hợp tự động theo thời gian thực khi sự kiện diễn ra.'
              : 'Attendance rates, reader check-ins, and activity ratings will be aggregated automatically during and after the event.'}
          </p>
        </div>
      ) : (
        <div className="partner-charts-grid">
          {/* Chart 1: Participation by Activity (Horizontal bar chart) */}
          <div className="partner-chart-card">
            <h3 className="chart-card-title">
              {language === 'vi' ? 'Lượt tham gia theo hoạt động' : 'Participation by Activity'}
            </h3>

            <div style={{ marginTop: '1.25rem' }}>
              {reportStats.activityStats.map((item, idx) => {
                const maxVal = Math.max(1, ...reportStats.activityStats.map(stat => stat.count));
                const widthPct = Math.round((item.count / maxVal) * 100);

                return (
                  <div key={idx} className="horizontal-bar-item">
                    <div className="bar-meta">
                      <span>{item.name}</span>
                      <strong>{item.count} {language === 'vi' ? 'lượt' : 'attendants'}</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${widthPct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#8C9F9A', marginTop: '1.5rem', borderTop: '1px solid #EEF2F0', paddingTop: '0.65rem' }}>
              <span>0</span>
              <span>50</span>
              <span>100</span>
              <span>150</span>
              <span>200</span>
            </div>
          </div>

          {/* Chart 2: Activity Ratings Breakdown matching Sketch Screen 7 */}
          <div className="partner-chart-card">
            <h3 className="chart-card-title">
              {language === 'vi' ? 'Đánh giá hoạt động' : 'Activity Ratings'}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
              {/* Visual SVG Donut Indicator */}
              <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5ECE8" strokeWidth="3.8" />
                  <circle 
                    cx="18" 
                    cy="18" 
                    r="15.9" 
                    fill="none" 
                    stroke="#10B981" 
                    strokeWidth="3.8" 
                    strokeDasharray="68, 100" 
                    strokeDashoffset="0" 
                  />
                  <circle 
                    cx="18" 
                    cy="18" 
                    r="15.9" 
                    fill="none" 
                    stroke="#E9BC63" 
                    strokeWidth="3.8" 
                    strokeDasharray="22, 100" 
                    strokeDashoffset="-68" 
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#172421'
                }}>
                  {reportStats.averageRating || '0.0'}
                  <span style={{ fontSize: '0.65rem', color: '#637771', fontWeight: 600 }}>/ 5.0</span>
                </div>
              </div>

              {/* Breakdown List */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {reportStats.ratingDistribution.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#495D57', fontWeight: 600 }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: idx === 0 ? '#10B981' : idx === 1 ? '#E9BC63' : idx === 2 ? '#60A5FA' : '#F87171'
                      }}></span>
                      {item.stars}
                    </span>
                    <strong style={{ color: '#172421' }}>{item.percent}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

