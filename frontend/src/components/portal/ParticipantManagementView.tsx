import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  QrCode,
  Edit2
} from 'lucide-react';
import { Language } from '../../types';
import { OrganizerParticipantItem, OrganizerEvent } from '../../types/organizer';

interface ParticipantManagementViewProps {
  language: Language;
  events: OrganizerEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
  participants: OrganizerParticipantItem[];
  onOpenAttendanceModal?: () => void;
  onManualOverrideStatus?: (participantId: string, newStatus: OrganizerParticipantItem['status'], reason: string) => void;
}

export const ParticipantManagementView: React.FC<ParticipantManagementViewProps> = ({
  language,
  events,
  selectedEventId,
  onSelectEventId,
  participants,
  onManualOverrideStatus
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Manual Override Dialog State
  const [overrideModalParticipant, setOverrideModalParticipant] = useState<OrganizerParticipantItem | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'attended' | 'not_attended' | 'cancelled'>('attended');
  const [overrideReason, setOverrideReason] = useState('');

  const filteredParticipants = participants.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.ticketCode.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage) || 1;
  const paginatedParticipants = filteredParticipants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const attendedCount = participants.filter(item => item.status === 'attended').length;
  const pendingCount = participants.filter(item => item.status === 'not_attended').length;
  const cancelledCount = participants.filter(item => item.status === 'cancelled').length;

  const exportParticipants = () => {
    const rows = [['Họ tên', 'Email', 'Điện thoại', 'Mã vé', 'Trạng thái'], ...filteredParticipants.map(item => [item.fullName, item.email, item.phone, item.ticketCode, item.statusLabelVi])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `nguoi-tham-gia-${selectedEventId}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const handleConfirmOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert(language === 'vi' ? 'Vui lòng nhập lý do ghi đè điểm danh.' : 'Please enter an override reason.');
      return;
    }
    if (overrideModalParticipant && onManualOverrideStatus) {
      onManualOverrideStatus(overrideModalParticipant.id, overrideStatus, overrideReason);
    }
    setOverrideModalParticipant(null);
    setOverrideReason('');
  };

  const getStatusChip = (status: OrganizerParticipantItem['status']) => {
    switch (status) {
      case 'attended':
        return <span className="org-chip attended">● {language === 'vi' ? 'Đã tham gia' : 'Attended'}</span>;
      case 'not_attended':
        return <span className="org-chip not_attended">● {language === 'vi' ? 'Chưa tham gia' : 'Not Attended'}</span>;
      case 'cancelled':
        return <span className="org-chip cancelled">● {language === 'vi' ? 'Hủy đăng ký' : 'Cancelled'}</span>;
    }
  };

  return (
    <div className="organizer-content">
      {/* 1. Header with Event Selector matching Sketch Screen 7 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 className="organizer-view-title">
            {language === 'vi' ? 'Danh sách người tham gia' : 'Participant Management'}
          </h1>
          <p className="organizer-view-sub">
            {language === 'vi' ? 'Theo dõi danh sách đăng ký, tình trạng tham gia và xử lý điểm danh' : 'Monitor registration, attendance states, and supervisor check-ins'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <select
            value={selectedEventId}
            onChange={(e) => onSelectEventId(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #17382E',
              background: '#FFFFFF',
              color: '#17382E',
              fontSize: '0.86rem',
              fontWeight: 700
            }}
          >
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>{evt.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. 4 Overview Metric Boxes matching Sketch Screen 7 */}
      <div className="org-metric-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="org-metric-card">
          <p>{language === 'vi' ? 'Tổng người tham gia' : 'Total Registered'}</p>
          <strong>{participants.length}</strong>
          <span>Độc giả đăng ký trên cổng trực tuyến</span>
        </div>

        <div className="org-metric-card" style={{ borderTopColor: '#166534' }}>
          <p>{language === 'vi' ? 'Đã tham gia' : 'Attended'}</p>
          <strong style={{ color: '#166534' }}>{attendedCount}</strong>
          <span style={{ color: '#166534' }}>{participants.length ? Math.round(attendedCount / participants.length * 100) : 0}% tổng số lượt đăng ký</span>
        </div>

        <div className="org-metric-card gold">
          <p>{language === 'vi' ? 'Chưa tham gia' : 'Not Attended / Pending'}</p>
          <strong style={{ color: '#B45309' }}>{pendingCount}</strong>
          <span>Chưa thực hiện check-in mã vé</span>
        </div>

        <div className="org-metric-card red">
          <p>{language === 'vi' ? 'Hủy đăng ký' : 'Cancelled'}</p>
          <strong style={{ color: '#DC2626' }}>{cancelledCount}</strong>
          <span>Hủy trước thời hạn quy định</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar matching Sketch Screen 7 */}
      <div className="org-toolbar">
        <div className="organizer-search-box" style={{ maxWidth: '320px' }}>
          <Search size={15} />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm theo tên, email, mã vé...' : 'Search name, email, ticket code...'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="org-toolbar-left" style={{ marginLeft: 'auto' }}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #D6E0DB',
              background: '#FFFFFF',
              color: '#172421',
              fontSize: '0.84rem'
            }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
            <option value="attended">{language === 'vi' ? 'Đã tham gia' : 'Attended'}</option>
            <option value="not_attended">{language === 'vi' ? 'Chưa tham gia' : 'Not Attended'}</option>
            <option value="cancelled">{language === 'vi' ? 'Hủy đăng ký' : 'Cancelled'}</option>
          </select>

          <button
            type="button"
            className="btn-org-secondary"
            onClick={exportParticipants}
          >
            <Download size={14} />
            <span>{language === 'vi' ? 'Xuất danh sách' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* 4. Participant Data Table matching Sketch Screen 7 */}
      <div className="org-table-container">
        <table className="org-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Mã vé</th>
              <th style={{ textAlign: 'center' }}>Số hoạt động</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedParticipants.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#637771' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#334943' }}>
                    {language === 'vi' ? 'Chưa có người tham gia đăng ký sự kiện này' : 'No participants registered for this event yet'}
                  </p>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: '#7A8E87' }}>
                    {language === 'vi' ? 'Dữ liệu đăng ký và điểm danh thực tế sẽ hiển thị tại đây khi độc giả đăng ký qua cổng.' : 'Real registration and attendance records will appear here as participants register.'}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedParticipants.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong style={{ color: '#172421' }}>{p.fullName}</strong>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#637771' }}>{p.phone}</span>
                  </td>
                  <td>
                    <span style={{ color: '#4B5563' }}>{p.email}</span>
                  </td>
                  <td>
                    <code style={{ background: '#F1F5F3', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.78rem', color: '#17382E', fontWeight: 700 }}>
                      {p.ticketCode}
                    </code>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#172421' }}>
                    {p.registeredActivitiesCount}
                  </td>
                  <td>
                    {getStatusChip(p.status)}
                    {p.checkInTime && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>
                        Check-in: {p.checkInTime}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-org-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.76rem' }}
                      onClick={() => {
                        setOverrideModalParticipant(p);
                        setOverrideStatus(p.status);
                      }}
                      title="Ghi đè hoặc sửa trạng thái điểm danh"
                    >
                      <Edit2 size={12} />
                      <span>Sửa</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 5. Pagination matching Sketch Screen 7 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: '#FFFFFF',
          borderTop: '1px solid #EEF2F0',
          fontSize: '0.8rem',
          color: '#637771'
        }}>
          <div>
            {filteredParticipants.length === 0
              ? (language === 'vi' ? 'Hiển thị 0 của 0 độc giả' : 'Showing 0 of 0 participants')
              : (language === 'vi'
                ? `Hiển thị ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredParticipants.length)} của ${filteredParticipants.length} độc giả`
                : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredParticipants.length)} of ${filteredParticipants.length} participants`)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              className="organizer-icon-button"
              style={{ width: '30px', height: '30px' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                onClick={() => setCurrentPage(pg)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  border: currentPage === pg ? '1px solid #17382E' : '1px solid #D6E0DB',
                  background: currentPage === pg ? '#17382E' : '#FFFFFF',
                  color: currentPage === pg ? '#FFFFFF' : '#172421',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              className="organizer-icon-button"
              style={{ width: '30px', height: '30px' }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Override Confirmation Dialog */}
      {overrideModalParticipant && (
        <div className="org-modal-backdrop" onClick={() => setOverrideModalParticipant(null)}>
          <form className="org-modal-box" onSubmit={handleConfirmOverride} onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <h3>Ghi đè trạng thái điểm danh (Manual Override)</h3>
            </div>

            <div className="org-modal-body">
              <p style={{ fontSize: '0.86rem', color: '#4B5563', marginBottom: '1.25rem' }}>
                Thay đổi trạng thái điểm danh cho độc giả <strong>{overrideModalParticipant.fullName}</strong> (Mã vé: <code>{overrideModalParticipant.ticketCode}</code>).
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Trạng thái mới *
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #D1DDD8' }}
                >
                  <option value="attended">Đã tham gia (Attended)</option>
                  <option value="not_attended">Chưa tham gia (Not Attended)</option>
                  <option value="cancelled">Hủy đăng ký (Cancelled)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Lý do ghi đè (Bắt buộc lưu nhật ký kiểm toán BQL) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ví dụ: Độc giả quên vé cứng nhưng xuất trình căn cước hợp lệ; hoặc camera quét vé bị chói sáng..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #D1DDD8', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div className="org-modal-footer">
              <button
                type="button"
                className="btn-org-secondary"
                onClick={() => setOverrideModalParticipant(null)}
              >
                Hủy
              </button>
              <button type="submit" className="btn-org-primary">
                Xác nhận ghi đè
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

