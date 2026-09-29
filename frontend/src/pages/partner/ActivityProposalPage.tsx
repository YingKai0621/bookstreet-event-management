import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Eye, 
  Edit3, 
  Copy, 
  AlertCircle, 
  CheckCircle2, 
  X,
  QrCode
} from 'lucide-react';
import { Language, PartnerActivityProposal } from '../../types';
import './PartnerPages.css';

interface ActivityProposalPageProps {
  language: Language;
  activities: PartnerActivityProposal[];
  locations: Array<{ id: string; name: string; capacity: number }>;
  assets: Array<{ id: string; name: string; totalQuantity: number }>;
  onAddActivity: (newAct: Omit<PartnerActivityProposal, 'id'>) => void | Promise<void>;
  onOpenAttendanceModal?: (activityId: string) => void;
}

export const ActivityProposalPage: React.FC<ActivityProposalPageProps> = ({
  language,
  activities,
  locations,
  assets,
  onAddActivity,
  onOpenAttendanceModal,
}) => {
  const vietnamDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'need_changes' | 'cancelled'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Comprehensive Form State matching EventApplicationPage
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Workshop' | 'Talkshow' | 'Minigame' | 'Signings' | 'Exhibition'>('Workshop');
  const [targetDate, setTargetDate] = useState(vietnamDateKey);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');
  const [location, setLocation] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('30 – 60 người');
  const [targetAudience, setTargetAudience] = useState('Trẻ em và bạn đọc yêu sách');
  const [speakerInfo, setSpeakerInfo] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [boothNotes, setBoothNotes] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);

  const pendingCount = activities.filter(a => a.status === 'pending').length;
  const approvedCount = activities.filter(a => a.status === 'approved').length;
  const needChangesCount = activities.filter(a => a.status === 'need_changes').length;
  const cancelledCount = activities.filter(a => a.status === 'cancelled').length;

  const filteredActivities = activities.filter(a => {
    if (activeTab === 'all') return true;
    return a.status === activeTab;
  });

  const toggleEquipment = (eq: string) => {
    setSelectedEquipment(prev => 
      prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]
    );
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert(language === 'vi' ? 'Vui lòng nhập tên hoạt động.' : 'Please enter activity title.');
      return;
    }
    if (!agreedTerms) {
      alert(language === 'vi' ? 'Vui lòng xác nhận cam kết quy chế tổ chức hoạt động.' : 'Please agree to terms.');
      return;
    }

    const dateParts = targetDate.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const timeStr = `${startTime} – ${endTime}`;

    try {
      await onAddActivity({
        title, category, date: formattedDate, time: timeStr, duration: '1.5 giờ', location,
        capacity: expectedAttendees.includes('250') ? 250 : expectedAttendees.includes('100') ? 100 : expectedAttendees.includes('60') ? 60 : 30,
        registeredCount: 0, targetAudience,
        description: boothNotes ? `${description}\n[Ghi chú thêm: ${boothNotes}]` : description,
        requiredEquipments: selectedEquipment, imageUrl: '', status: 'pending', eventId: '', eventName: '',
      });
      setIsModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể gửi đề xuất hoạt động.' : 'Could not submit activity proposal.'));
      return;
    }
    // Reset form
    setTitle('');
    setDescription('');
    setSpeakerInfo('');
    setBoothNotes('');
  };

  return (
    <div className="activity-proposal-page">
      {/* 1. Header matching Sketch Screen 5 */}
      <div className="partner-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="partner-page-title" style={{ margin: 0 }}>
            {language === 'vi' ? 'Danh sách hoạt động' : 'Activity Management'}
          </h1>
          <p className="partner-page-sub">
            {language === 'vi' 
              ? 'Khởi tạo và theo dõi các hoạt động văn hóa, workshop và tọa đàm do đối tác tổ chức.' 
              : 'Create and manage cultural workshops, talkshows and book signings.'}
          </p>
        </div>

        <button
          type="button"
          className="btn-part-primary"
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            borderRadius: '9px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 14px rgba(23, 56, 46, 0.2)'
          }}
        >
          <Plus size={16} />
          <span>{language === 'vi' ? 'Đề xuất hoạt động' : 'Propose Activity'}</span>
        </button>
      </div>

      {/* 2. Filter Tabs matching Sketch Screen 5 */}
      <div className="partner-tabs-bar">
        <button
          type="button"
          className={`partner-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          {language === 'vi' ? `Tất cả (${activities.length})` : `All (${activities.length})`}
        </button>
        <button
          type="button"
          className={`partner-tab-btn ${activeTab === 'pending' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          {language === 'vi' ? `Chờ duyệt (${pendingCount})` : `Pending (${pendingCount})`}
        </button>
        <button
          type="button"
          className={`partner-tab-btn ${activeTab === 'approved' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          {language === 'vi' ? `Đã duyệt (${approvedCount})` : `Approved (${approvedCount})`}
        </button>
        <button
          type="button"
          className={`partner-tab-btn ${activeTab === 'need_changes' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('need_changes')}
        >
          {language === 'vi' ? `Cần chỉnh sửa (${needChangesCount})` : `Needs Revision (${needChangesCount})`}
        </button>
        <button
          type="button"
          className={`partner-tab-btn ${activeTab === 'cancelled' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          {language === 'vi' ? `Đã hủy (${cancelledCount})` : `Cancelled (${cancelledCount})`}
        </button>
      </div>

      {/* 3. Activity List Items matching Sketch Screen 5 */}
      {filteredActivities.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2EAE5',
          borderRadius: '12px',
          padding: '3rem 2rem',
          textAlign: 'center',
          color: '#637771'
        }}>
          <p>{language === 'vi' ? 'Không có hoạt động nào trong danh mục này.' : 'No activities found.'}</p>
        </div>
      ) : (
        <div className="partner-activities-list">
          {filteredActivities.map((act) => {
            const isApproved = act.status === 'approved';
            const isPending = act.status === 'pending';
            const isNeedChanges = act.status === 'need_changes';

            return (
              <div key={act.id} className="partner-activity-row-card">
                <div className="activity-row-left">
                  <img 
                    src={act.imageUrl} 
                    alt={act.title} 
                    className="activity-thumb-img"
                  />
                  <div className="activity-info-col">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#B3862A',
                        background: '#FAF8F3',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #EFE8D8'
                      }}>
                        {act.category}
                      </span>
                      <h3>{act.title}</h3>
                    </div>

                    <div className="activity-specs-line">
                      <span>📅 {act.date} • ⏰ {act.time}</span>
                      <span>📍 {act.location}</span>
                      <span>👥 {language === 'vi' ? `Số người: ${act.capacity}` : `Capacity: ${act.capacity}`}</span>
                    </div>

                    {act.feedbacks && isNeedChanges && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#B91C1C',
                        background: '#FEE2E2',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <AlertCircle size={14} />
                        <span>{act.feedbacks}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                  <div>
                    <span className={`status-badge ${act.status}`}>
                      {isApproved && '✓ Đã duyệt'}
                      {isPending && '⏳ Chờ duyệt'}
                      {isNeedChanges && '⚠️ Cần chỉnh sửa'}
                      {act.status === 'cancelled' && '✕ Đã hủy'}
                    </span>
                  </div>

                  <div className="activity-row-actions">
                    <Link 
                      to={`/partner/activities/${act.id}`} 
                      className="btn-part-secondary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      <Eye size={14} />
                      <span>{language === 'vi' ? 'Xem' : 'View'}</span>
                    </Link>

                    {isApproved && onOpenAttendanceModal && (
                      <button
                        type="button"
                        className="btn-part-primary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                        onClick={() => onOpenAttendanceModal(act.id)}
                        title="Điểm danh mã QR"
                      >
                        <QrCode size={14} />
                        <span>{language === 'vi' ? 'Điểm danh' : 'Check-in'}</span>
                      </button>
                    )}

                    {!isApproved && (
                      <Link 
                        to={`/partner/activities/${act.id}`}
                        className="btn-part-secondary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                      >
                        <Edit3 size={14} />
                        <span>{language === 'vi' ? 'Chỉnh sửa' : 'Edit'}</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL: Đăng ký Đề xuất Hoạt động mới (Sử dụng chuẩn Form từ Đăng ký Tổ chức Sự kiện) */}
      {isModalOpen && (
        <div className="attendance-modal-overlay" onClick={() => setIsModalOpen(false)} style={{ zIndex: 9999 }}>
          <div className="attendance-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px' }}>
            {/* Header without star icon */}
            <div className="attendance-modal-header" style={{
              background: '#FAFCFB',
              borderBottom: '1px solid #EEF2F0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div>
                <h3 style={{
                  margin: '0 0 0.2rem 0',
                  fontSize: '1.3rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 800,
                  color: '#172421'
                }}>
                  {language === 'vi' ? 'Đăng ký Đề xuất Hoạt động mới' : 'Propose New Activity'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#556B65' }}>
                  {language === 'vi' 
                    ? 'Điền đầy đủ thông tin chương trình để gửi Ban Quản Lý Đường Sách phê duyệt lịch và địa điểm.' 
                    : 'Submit activity proposal for Book Street management board approval.'}
                </p>
              </div>

              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#637771' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateActivity} style={{ padding: '1.5rem' }}>
              {/* PHẦN 1: CHI TIẾT HOẠT ĐỘNG ĐỀ XUẤT */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2EAE5',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1.25rem'
              }}>
                <h4 style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#172421',
                  margin: '0 0 1rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>📅</span>
                  <span>{language === 'vi' ? '1. Thông tin Hoạt động đề xuất tổ chức' : '1. Activity Details & Scheduling'}</span>
                </h4>

                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Tên hoạt động / Tiêu đề chương trình *' : 'Activity Title *'}</label>
                  <input 
                    type="text" 
                    required 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Workshop 'Đọc sách cùng trẻ' & Vẽ tranh minh họa"
                  />
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Hình thức / Loại hình hoạt động *' : 'Category *'}</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                    >
                      <option value="Workshop">Workshop & Trải nghiệm thực hành</option>
                      <option value="Talkshow">Tọa đàm & Diễn đàn thảo luận</option>
                      <option value="Signings">Giao lưu tác giả & Ký tặng sách</option>
                      <option value="Exhibition">Triển lãm chuyên đề & Trưng bày nghệ thuật</option>
                      <option value="Minigame">Hoạt động tương tác / Minigame cộng đồng</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Ngày đề xuất tổ chức *' : 'Proposed Date *'}</label>
                    <input 
                      type="date" 
                      required 
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Giờ bắt đầu *' : 'Start Time *'}</label>
                    <input 
                      type="time" 
                      required 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Giờ kết thúc *' : 'End Time *'}</label>
                    <input 
                      type="time" 
                      required 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Địa điểm / Không gian mong muốn *' : 'Venue / Location *'}</label>
                    <select 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                    >
                      <option value="" disabled>{language === 'vi' ? 'Chọn địa điểm đã được BQL cấu hình' : 'Select an event location'}</option>
                      {locations.map(item => (
                        <option key={item.id} value={item.name}>{item.name} ({item.capacity} {language === 'vi' ? 'chỗ' : 'seats'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Dự kiến số lượng người tham dự *' : 'Expected Attendees *'}</label>
                    <select 
                      value={expectedAttendees} 
                      onChange={(e) => setExpectedAttendees(e.target.value)}
                    >
                      <option value="Dưới 30 người">Dưới 30 người (Quy mô nhóm nhỏ)</option>
                      <option value="30 – 60 người">30 – 60 người (Workshop vừa)</option>
                      <option value="50 – 100 người">50 – 100 người (Tọa đàm tiêu chuẩn)</option>
                      <option value="100 – 250 người">100 – 250 người (Sân khấu lớn)</option>
                      <option value="Trên 250 người">Trên 250 người (Quy mô đại hội)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Đối tượng tham gia chính' : 'Target Audience'}</label>
                    <input 
                      type="text" 
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="Trẻ em, học sinh, độc giả yêu sách..."
                    />
                  </div>
                  <div className="form-field-group">
                    <label>{language === 'vi' ? 'Diễn giả / Khách mời / Hướng dẫn' : 'Guest Speaker / Host'}</label>
                    <input 
                      type="text" 
                      value={speakerInfo}
                      onChange={(e) => setSpeakerInfo(e.target.value)}
                      placeholder="Ví dụ: Họa sĩ minh họa Thu Hà, MC..."
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label>{language === 'vi' ? 'Tóm tắt nội dung & Mục tiêu chương trình *' : 'Activity Description *'}</label>
                  <textarea 
                    rows={3}
                    required 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả tóm tắt kịch bản chương trình, ý nghĩa hoạt động và đối tượng độc giả hướng tới..."
                  />
                </div>
              </div>

              {/* PHẦN 2: YÊU CẦU THIẾT BỊ & GHI CHÚ CỦA GIAN HÀNG */}
              <div style={{
                background: '#FAF8F3',
                border: '1px solid #EFE8D8',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1.25rem'
              }}>
                <h4 style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#172421',
                  margin: '0 0 0.85rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>⚡</span>
                  <span>{language === 'vi' ? '2. Yêu cầu Thiết bị & Kỹ thuật từ Ban Quản Lý' : '2. Technical & Equipment Support'}</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                  {assets.map((asset) => (
                    <label 
                      key={asset.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        background: '#FFFFFF',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #E2EAE5'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={selectedEquipment.includes(asset.name)}
                        onChange={() => toggleEquipment(asset.name)}
                      />
                      <span>{asset.name} ({asset.totalQuantity})</span>
                    </label>
                  ))}
                  {assets.length === 0 && <p>{language === 'vi' ? 'Chưa có thiết bị khả dụng trong hệ thống.' : 'No equipment is currently available.'}</p>}
                </div>

                {/* Ô Ghi chú thêm ý kiến */}
                <div className="form-field-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>📝</span>
                    <span>{language === 'vi' ? 'Ghi chú & Ý kiến yêu cầu thêm của gian hàng' : 'Additional Requests / Notes from Booth'}</span>
                  </label>
                  <textarea 
                    rows={2}
                    value={boothNotes}
                    onChange={(e) => setBoothNotes(e.target.value)}
                    placeholder={language === 'vi' 
                      ? 'Nhập các yêu cầu riêng về thời gian dàn dựng sân khấu, nguồn điện công suất lớn, tiếp đón khách VIP, gửi xe cho diễn giả...' 
                      : 'Special setup times, high power supply, VIP reception, speaker parking...'}
                    style={{ background: '#FFFFFF' }}
                  />
                </div>
              </div>

              {/* Agreement */}
              <div style={{
                background: '#FAFCFB',
                border: '1px solid #E2EAE5',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <input 
                  type="checkbox" 
                  id="agreeProposalTerms"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                />
                <label htmlFor="agreeProposalTerms" style={{ fontSize: '0.83rem', color: '#445752', cursor: 'pointer', lineHeight: 1.5 }}>
                  {language === 'vi'
                    ? 'Tôi cam kết nội dung chương trình tuân thủ đúng Luật Xuất bản, các quy định pháp luật hiện hành và quy chế tổ chức hoạt động tại Đường Sách TP.HCM.'
                    : 'I certify that the proposed activity complies with the Publication Law and HCMC Book Street regulations.'}
                </label>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn-part-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="btn-part-primary"
                  style={{ padding: '0.7rem 1.45rem', fontWeight: 750 }}
                >
                  <Plus size={16} />
                  <span>{language === 'vi' ? 'Gửi Đề xuất Hoạt động' : 'Submit Proposal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

