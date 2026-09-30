import React, { useEffect, useState } from 'react';
import { Download, Star } from 'lucide-react';
import { Language } from '../../types';
import { OrganizerEvent } from '../../types/organizer';
import { organizerApi } from '../../services/organizerApi';

interface OrganizerReportsViewProps {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
}

interface OrganizerReport {
  eventId: string;
  eventName: string;
  totalParticipants: number;
  attended: number;
  pending: number;
  cancelled: number;
  totalBooths: number;
  totalActivities: number;
  attendanceRate: number;
  averageRating: number;
  ratingCount: number;
  activityStats: Array<{ name: string; count: number }>;
  ratingDistribution: Array<{ stars: number; count: number }>;
}

export const OrganizerReportsView: React.FC<OrganizerReportsViewProps> = ({ language, events, selectedEventId, onSelectEventId }) => {
  const [report, setReport] = useState<OrganizerReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    organizerApi.getReport(selectedEventId).then(setReport).catch(error => {
      setReport(null);
      setError(error instanceof Error ? error.message : 'Không tải được báo cáo');
    });
  }, [selectedEventId]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Sự kiện', report.eventName],
      ['Tổng lượt đăng ký', report.totalParticipants],
      ['Đã tham gia', report.attended],
      ['Chưa tham gia', report.pending],
      ['Đã hủy', report.cancelled],
      ['Gian hàng', report.totalBooths],
      ['Hoạt động', report.totalActivities],
      ['Tỷ lệ tham dự', report.attendanceRate + '%'],
      ['Đánh giá trung bình', report.averageRating],
      [],
      ['Hoạt động', 'Lượt đăng ký'],
      ...report.activityStats.map(item => [item.name, item.count]),
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bao-cao-${report.eventId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="organizer-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="organizer-view-title">{language === 'vi' ? 'Báo cáo sự kiện' : 'Event Reports'}</h1>
          <p className="organizer-view-sub">{language === 'vi' ? 'Số liệu được tổng hợp trực tiếp từ đăng ký, điểm danh và đánh giá.' : 'Live registration, attendance and rating data.'}</p>
        </div>
        <div style={{ display: 'flex', gap: '.65rem' }}>
          <select value={selectedEventId} onChange={event => onSelectEventId(event.target.value)}>
            {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
          <button type="button" className="btn-org-secondary" onClick={exportCsv} disabled={!report}><Download size={15} />Xuất CSV</button>
        </div>
      </div>
      {error && <p role="alert" className="app-loading-state">{error}</p>}
      {!report && !error && <p className="app-loading-state">Đang tổng hợp báo cáo…</p>}
      {report && <>
        <div className="org-metric-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="org-metric-card"><p>Tổng lượt đăng ký</p><strong>{report.totalParticipants}</strong><span>{report.attended} đã tham gia</span></div>
          <div className="org-metric-card"><p>Gian hàng</p><strong>{report.totalBooths}</strong><span>Phân bổ đang hoạt động</span></div>
          <div className="org-metric-card"><p>Hoạt động</p><strong>{report.totalActivities}</strong><span>{report.attendanceRate}% tỷ lệ tham dự</span></div>
          <div className="org-metric-card"><p>Đánh giá trung bình</p><strong>{report.averageRating || '—'}</strong><span><Star size={13} /> {report.ratingCount} đánh giá</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1rem' }}>
          <section className="organizer-card">
            <h2 style={{ fontSize: '1rem' }}>Trạng thái tham gia</h2>
            <p>Đã tham gia: <strong>{report.attended}</strong></p>
            <p>Chưa tham gia: <strong>{report.pending}</strong></p>
            <p>Đã hủy: <strong>{report.cancelled}</strong></p>
          </section>
          <section className="organizer-card">
            <h2 style={{ fontSize: '1rem' }}>Lượt đăng ký theo hoạt động</h2>
            {report.activityStats.map(item => <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid #EEF2F0' }}><span>{item.name}</span><strong>{item.count}</strong></div>)}
            {report.activityStats.length === 0 && <p>Chưa có hoạt động.</p>}
          </section>
          <section className="organizer-card">
            <h2 style={{ fontSize: '1rem' }}>Phân bố đánh giá</h2>
            {report.ratingDistribution.map(item => <div key={item.stars} style={{ display: 'flex', justifyContent: 'space-between', padding: '.4rem 0' }}><span>{item.stars} sao</span><strong>{item.count}</strong></div>)}
          </section>
        </div>
      </>}
    </div>
  );
};
