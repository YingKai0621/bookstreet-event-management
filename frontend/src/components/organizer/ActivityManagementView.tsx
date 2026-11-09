import { PaginatedList } from '../ui/PaginatedList';
import { ImageUrlField } from '../ui/ImageUrlField';
import { contentImageApi } from '../../services/contentImageApi';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import {
  AlertTriangle,
  Check,
  Eye,
  FileText,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { Language } from '../../types';
import { OrganizerActivityItem } from '../../types/organizer';

interface ActivityManagementViewProps {
  language: Language;
  activities: OrganizerActivityItem[];
  onOpenCreateActivity: () => void;
  onApproveActivity?: (id: string) => void;
  onRejectActivity?: (id: string) => void;
  onPublishActivity?: (id: string) => void;
  onUpdateActivity?: (updatedActivity: OrganizerActivityItem) => void;
  onDeleteActivity?: (activityId: string) => void;
  onOpenAttendanceForActivity?: (activityId: string) => void;
}

export const ActivityManagementView: React.FC<ActivityManagementViewProps> = ({
  language,
  activities,
  onOpenCreateActivity,
  onApproveActivity,
  onRejectActivity,
  onPublishActivity,
  onUpdateActivity,
  onDeleteActivity
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState<OrganizerActivityItem | null>(null);
  const [formData, setFormData] = useState<OrganizerActivityItem | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  useModalDismiss(Boolean(selectedActivity), () => { setSelectedActivity(null); setFormData(null); setShowDeleteConfirm(false); });

  const handleOpenDetail = (act: OrganizerActivityItem) => {
    setSelectedActivity(act);
    setFormData({ ...act });
    setShowDeleteConfirm(false);
  };

  const handleCloseModal = () => {
    setSelectedActivity(null);
    setFormData(null);
    setShowDeleteConfirm(false);
  };
  const detailBackdropHandlers = useBackdropClick(handleCloseModal);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || imageUploading) return;
    if (!formData.title.trim()) {
      alert(language === 'vi' ? 'Vui lòng nhập tên hoạt động!' : 'Please enter activity title!');
      return;
    }
    if (onUpdateActivity) {
      onUpdateActivity(formData);
    }
    handleCloseModal();
  };

  const handleDelete = () => {
    if (!formData) return;
    if (onDeleteActivity) {
      onDeleteActivity(formData.id);
    }
    handleCloseModal();
  };

  const handleStatusChange = (newStatus: OrganizerActivityItem['status']) => {
    if (!formData) return;
    const labels: Record<OrganizerActivityItem['status'], string> = {
      approved: 'Đã duyệt',
      pending: 'Chờ duyệt',
      need_revision: 'Cần chỉnh sửa',
      rejected: 'Từ chối',
      cancelled: 'Đã hủy'
    };
    setFormData({
      ...formData,
      status: newStatus,
      statusLabelVi: labels[newStatus] || newStatus
    });
  };

  const pendingCount = activities.filter(act => act.status === 'pending' || act.status === 'need_revision').length;
  const approvedCount = activities.filter(act => act.status === 'approved').length;
  const cancelledCount = activities.filter(act => act.status === 'cancelled' || act.status === 'rejected').length;

  const filteredActivities = activities.filter(act => {
    if (activeTab === 'pending' && act.status !== 'pending' && act.status !== 'need_revision') return false;
    if (activeTab === 'approved' && act.status !== 'approved') return false;
    if (activeTab === 'cancelled' && act.status !== 'cancelled' && act.status !== 'rejected') return false;
    if (typeFilter !== 'all' && act.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return act.title.toLowerCase().includes(q) || act.speaker.toLowerCase().includes(q) || act.location.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="organizer-content">
      {/* 1. Header with title and Create button matching Sketch Screen 6 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 className="organizer-view-title workspace-page-title">
            {language === 'vi' ? 'Danh sách hoạt động' : 'Activity Management'}
          </h1>
          <p className="organizer-view-sub workspace-page-subtitle">
            {language === 'vi' ? 'Xét duyệt đề xuất từ đối tác, điều phối địa điểm và phê duyệt xuất bản lịch trình' : 'Review proposals, manage locations and publish official activities'}
          </p>
        </div>

        <button
          type="button"
          className="btn-org-primary"
          onClick={onOpenCreateActivity}
        >
          <Plus size={16} />
          <span>{language === 'vi' ? 'Thêm hoạt động' : 'Add Activity'}</span>
        </button>
      </div>

      {/* 2. Filter Toolbar matching Sketch Screen 6 */}
      <div className="org-toolbar">
        <div className="org-tabs-bar" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            {language === 'vi' ? `Tất cả (${activities.length})` : `All (${activities.length})`}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'pending' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            {language === 'vi' ? `Chờ duyệt (${pendingCount})` : `Pending (${pendingCount})`}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'approved' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            {language === 'vi' ? `Đã duyệt (${approvedCount})` : `Approved (${approvedCount})`}
          </button>
          <button
            type="button"
            className={`org-tab-btn ${activeTab === 'cancelled' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
          >
            {language === 'vi' ? `Đã hủy (${cancelledCount})` : `Cancelled (${cancelledCount})`}
          </button>
        </div>

        <div className="org-toolbar-left" style={{ marginLeft: 'auto' }}>
          <div className="organizer-search-box" style={{ maxWidth: '240px' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm kiếm hoạt động...' : 'Search activity...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid #D6E0DB',
              background: '#FFFFFF',
              color: '#172421',
              fontSize: '0.84rem'
            }}
          >
            <option value="all">{language === 'vi' ? 'Tất cả loại' : 'All Types'}</option>
            <option value="Talkshow">Talkshow</option>
            <option value="Workshop">Workshop</option>
            <option value="Mini Game">Mini Game</option>
            <option value="Nghệ thuật">Nghệ thuật</option>
          </select>
        </div>
      </div>

      {/* 3. Conflict Alert Banner if any conflict detected */}
      {activities.some(a => a.hasConflict) && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderLeft: '4px solid #D97706',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          fontSize: '0.84rem',
          color: '#92400E'
        }}>
          <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
          <span>
            {language === 'vi'
              ? 'Phát hiện 1 đề xuất có xung đột địa điểm / khung giờ với lịch kỹ thuật.'
              : '1 proposal has detected schedule/location conflict.'}
          </span>
        </div>
      )}

      {/* 4. Activity Cards matching Sketch Screen 6 or Empty Waiting State */}
      {filteredActivities.length === 0 ? (
        <div className="organizer-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', background: '#FAF8F5', border: '1px solid #EAE5DC' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(212, 163, 89, 0.14)',
            border: '2px dashed #D4A359',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 1.25rem',
            color: '#B3862A'
          }}>
            <FileText size={32} />
          </div>
          <h3 style={{ margin: '0 0 0.45rem', color: '#172421', fontSize: '1.25rem', fontFamily: 'var(--font-serif)' }}>
            {activeTab === 'all'
              ? (language === 'vi' ? 'Chưa có hoạt động nào được tạo' : 'No Activities Found')
              : activeTab === 'pending'
              ? (language === 'vi' ? 'Không có hoạt động chờ duyệt' : 'No Pending Activities')
              : activeTab === 'approved'
              ? (language === 'vi' ? 'Chưa có hoạt động nào được phê duyệt' : 'No Approved Activities')
              : (language === 'vi' ? 'Không có hoạt động bị hủy' : 'No Cancelled Activities')}
          </h3>
          <p style={{ margin: '0 auto 1.75rem', color: '#637771', fontSize: '0.9rem', maxWidth: '540px', lineHeight: 1.55 }}>
            {language === 'vi'
              ? 'Khi đối tác đăng ký gian hàng gửi đề xuất hoạt động (tọa đàm, workshop, ra mắt sách) hoặc Ban Quản Lý khởi tạo chương trình mới, danh sách sẽ hiển thị tại đây để xét duyệt và điều phối khung giờ.'
              : 'When partners submit activity proposals or when you create a new event session, activities will appear here for review and location scheduling.'}
          </p>
          <button
            type="button"
            className="btn-org-primary"
            onClick={onOpenCreateActivity}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}
          >
            <Plus size={16} />
            <span>{language === 'vi' ? 'Thêm hoạt động mới' : 'Add Activity'}</span>
          </button>
        </div>
      ) : (
        <PaginatedList items={filteredActivities}>{pageItems => (<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {pageItems.map((act) => (
          <div
            key={act.id}
            className="organizer-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
              padding: '1.25rem',
              borderLeft: act.hasConflict ? '4px solid #D97706' : undefined
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '320px' }}>
              <img
                src={act.thumbnail}
                alt={act.title}
                style={{
                  width: '90px',
                  height: '70px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1px solid #DCE5E0'
                }}
              />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                    {act.title}
                  </h3>
                  <span style={{ background: '#F0F4F1', color: '#17382E', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {act.type}
                  </span>
                  <span className={`org-chip ${act.status}`}>
                    ● {act.statusLabelVi}
                  </span>
                  {act.isPublished ? (
                    <span style={{ fontSize: '0.72rem', color: '#059669', background: '#DCFCE7', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                      ✓ Đã công khai
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: '#637771', background: '#F3F4F6', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      Chưa công khai
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.78rem', color: '#556B65' }}>
                  <span>📅 {act.dateStr} • {act.timeStr}</span>
                  <span>📍 {act.location}</span>
                  <span>👤 {act.speaker}</span>
                  <span>🏢 {act.partnerName}</span>
                </div>

                {act.hasConflict && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.76rem', color: '#C2410C', fontWeight: 600 }}>
                    ⚠️ {act.conflictNotes}
                  </div>
                )}
              </div>
            </div>

            {/* Capacity Counter & Actions matching Sketch Screen 6 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, color: '#172421' }}>
                  {act.registeredCount} / {act.capacity}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#637771' }}>Đăng ký</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-org-secondary"
                  onClick={() => handleOpenDetail(act)}
                  title={language === 'vi' ? 'Xem thông tin hoạt động' : 'View activity'}
                >
                  <Eye size={14} />
                  <span>{language === 'vi' ? 'Xem' : 'View'}</span>
                </button>

                {act.status === 'pending' || act.status === 'need_revision' ? (
                  <>
                    <button
                      type="button"
                      className="btn-org-primary"
                      onClick={() => onApproveActivity && onApproveActivity(act.id)}
                      title="Duyệt hoạt động"
                    >
                      <Check size={14} />
                      <span>Duyệt</span>
                    </button>
                    <button
                      type="button"
                      className="btn-org-secondary"
                      style={{ color: '#C84C32' }}
                      onClick={() => onRejectActivity && onRejectActivity(act.id)}
                      title="Từ chối"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {!act.isPublished && (
                      <button
                        type="button"
                        className="btn-org-gold"
                        onClick={() => onPublishActivity && onPublishActivity(act.id)}
                        title="Xuất bản lên website công khai"
                      >
                        <Send size={13} />
                        <span>Xuất bản</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-org-secondary"
                      onClick={() => handleOpenDetail(act)}
                      title={language === 'vi' ? 'Chỉnh sửa thông tin chi tiết và xóa sự kiện' : 'Edit details & delete event'}
                    >
                      <FileText size={14} />
                      <span>{language === 'vi' ? 'Chi tiết' : 'Details'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>)}</PaginatedList>
      )}

      {/* Detail & Edit Modal if viewing or editing an activity */}
      {selectedActivity && formData && (
        <div className="org-modal-backdrop" {...detailBackdropHandlers}>
          <div 
            className="org-modal-box" 
            style={{ 
              maxWidth: '720px', 
              width: '100%', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="org-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
                  {language === 'vi' ? 'Chi tiết & Chỉnh sửa hoạt động' : 'Activity Details & Edit'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#556B65' }}>
                  {language === 'vi' 
                    ? 'Chỉnh sửa thông tin chi tiết, điều phối hoặc xóa sự kiện' 
                    : 'Edit schedule, details, coordinate or delete this event'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771', padding: '4px' }}
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div className="org-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>
                {/* Delete Confirmation Box */}
                {showDeleteConfirm && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1.5px solid #FCA5A5',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                      <AlertTriangle size={24} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <h4 style={{ margin: 0, color: '#991B1B', fontSize: '0.98rem', fontWeight: 700 }}>
                          {language === 'vi' ? 'Xác nhận xóa sự kiện này?' : 'Confirm delete this event?'}
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#B91C1C', lineHeight: 1.5 }}>
                          {language === 'vi'
                            ? `Bạn đang chuẩn bị xóa hoạt động "${formData.title}". Sự kiện sẽ bị xóa vĩnh viễn khỏi hệ thống quản lý và không thể khôi phục.`
                            : `Activity "${formData.title}" will be permanently deleted from the system.`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn-org-secondary"
                        onClick={() => setShowDeleteConfirm(false)}
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                      >
                        {language === 'vi' ? 'Hủy thao tác' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        className="btn-org-danger"
                        onClick={handleDelete}
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                      >
                        <Trash2 size={14} />
                        <span>{language === 'vi' ? 'Xác nhận xóa vĩnh viễn' : 'Delete Permanently'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Conflict warning if present */}
                {formData.hasConflict && (
                  <div style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: '#92400E'
                  }}>
                    <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
                    <span>⚠️ {formData.conflictNotes}</span>
                  </div>
                )}

                <ImageUrlField language={language} value={formData.thumbnail || ''} onChange={thumbnail => setFormData(current => current ? { ...current, thumbnail } : current)} uploadFile={file => contentImageApi.uploadOrganizerActivity(formData.eventId || '', file)} disabled={!formData.eventId} onBusyChange={setImageUploading} />

                {/* Form Fields Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                      {language === 'vi' ? 'Tên hoạt động / Sự kiện *' : 'Activity Title *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        fontSize: '0.88rem',
                        border: '1px solid #CFDAD5',
                        borderRadius: '8px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>

                  {/* 2-column: Type & Partner */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Thể loại hoạt động' : 'Type'}
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      >
                        <option value="Talkshow">Talkshow</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Mini Game">Mini Game</option>
                        <option value="Nghệ thuật">Nghệ thuật</option>
                        <option value="Ký tặng sách">Ký tặng sách</option>
                        <option value="Tọa đàm">Tọa đàm</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Đơn vị tổ chức / Đối tác' : 'Partner / Organizer'}
                      </label>
                      <input
                        type="text"
                        value={formData.partnerName}
                        onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>
                  </div>

                  {/* 2-column: Speaker & Capacity */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Diễn giả / Khách mời' : 'Speaker / Guest'}
                      </label>
                      <input
                        type="text"
                        value={formData.speaker}
                        onChange={(e) => setFormData({ ...formData, speaker: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Sức chứa tối đa (chỗ)' : 'Capacity'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) || 0 })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>
                  </div>

                  {/* 2-column: Date & Time */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Ngày diễn ra' : 'Date'}
                      </label>
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={formData.dateStr}
                        onChange={(e) => setFormData({ ...formData, dateStr: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Khung giờ' : 'Time'}
                      </label>
                      <input
                        type="text"
                        placeholder="HH:MM - HH:MM"
                        value={formData.timeStr}
                        onChange={(e) => setFormData({ ...formData, timeStr: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>
                  </div>

                  {/* 2-column: Location & Approval Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Địa điểm tổ chức' : 'Location'}
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                        {language === 'vi' ? 'Trạng thái xét duyệt' : 'Approval Status'}
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleStatusChange(e.target.value as OrganizerActivityItem['status'])}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.84rem',
                          border: '1px solid #CFDAD5',
                          borderRadius: '8px',
                          background: '#FFFFFF'
                        }}
                      >
                        <option value="approved">Đã duyệt (Approved)</option>
                        <option value="pending">Chờ duyệt (Pending)</option>
                        <option value="need_revision">Cần chỉnh sửa (Revision)</option>
                        <option value="rejected">Từ chối (Rejected)</option>
                        <option value="cancelled">Đã hủy (Cancelled)</option>
                      </select>
                    </div>
                  </div>

                  {/* Registered count & Public status checkbox */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', background: '#F8FAF9', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2EAE5' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.76rem', color: '#637771', marginBottom: '2px' }}>
                        {language === 'vi' ? 'Đã đăng ký tham gia' : 'Registered count'}
                      </span>
                      <strong style={{ color: '#17382E', fontSize: '0.95rem' }}>
                        {formData.registeredCount} / {formData.capacity} độc giả
                      </strong>
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 650, color: '#1F3830' }}>
                        <input
                          type="checkbox"
                          checked={formData.isPublished}
                          onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                          style={{ width: '17px', height: '17px', accentColor: '#17382E', cursor: 'pointer' }}
                        />
                        <span>{language === 'vi' ? 'Công khai trên Website chính thức' : 'Publish to Official Website'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#2C423B', marginBottom: '0.35rem' }}>
                      {language === 'vi' ? 'Mô tả chi tiết nội dung' : 'Detailed Description'}
                    </label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        fontSize: '0.84rem',
                        border: '1px solid #CFDAD5',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        resize: 'vertical',
                        lineHeight: 1.5
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer with Actions */}
              <div className="org-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  {!showDeleteConfirm && (
                    <button
                      type="button"
                      className="btn-org-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                      title={language === 'vi' ? 'Xóa sự kiện / hoạt động này' : 'Delete event'}
                    >
                      <Trash2 size={14} />
                      <span>{language === 'vi' ? 'Xóa sự kiện' : 'Delete Event'}</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-org-secondary"
                    onClick={handleCloseModal}
                  >
                    <span>{language === 'vi' ? 'Đóng' : 'Close'}</span>
                  </button>

                  {formData.status === 'approved' && !formData.isPublished && (
                    <button
                      type="button"
                      className="btn-org-gold"
                      onClick={() => {
                        const updated = { ...formData, isPublished: true };
                        setFormData(updated);
                        if (onPublishActivity) onPublishActivity(formData.id);
                        if (onUpdateActivity) onUpdateActivity(updated);
                      }}
                    >
                      <Send size={14} />
                      <span>{language === 'vi' ? 'Xuất bản' : 'Publish'}</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    className="btn-org-primary"
                    disabled={imageUploading}
                  >
                    <Save size={14} />
                    <span>{language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

