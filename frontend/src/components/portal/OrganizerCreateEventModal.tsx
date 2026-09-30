import React, { useState } from 'react';
import { 
  X, 
  MapPin,
  AlertCircle,
  Check
} from 'lucide-react';
import { Language } from '../../types';
import { OrganizerEvent } from '../../types/organizer';

interface OrganizerCreateEventModalProps {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  onCreateEvent: (newEvent: Partial<OrganizerEvent> & { title: string; startDate: string; endDate: string; location: string }) => void;
}

export const OrganizerCreateEventModal: React.FC<OrganizerCreateEventModalProps> = ({
  language,
  isOpen,
  onClose,
  onCreateEvent
}) => {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('Đường Sách TP.HCM (Nguyễn Văn Bình, Quận 1)');
  const [description, setDescription] = useState('');
  const [totalBooths, setTotalBooths] = useState(25);
  const [maxCapacity, setMaxCapacity] = useState(3000);
  const [boothDeadline, setBoothDeadline] = useState('');
  const [activityDeadline, setActivityDeadline] = useState('');
  const [participantDeadline, setParticipantDeadline] = useState('');
  const [cancellationCutoff, setCancellationCutoff] = useState('');
  const [status, setStatus] = useState<'draft' | 'upcoming'>('draft');
  const [isPublished, setIsPublished] = useState(false);

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(language === 'vi' ? 'Vui lòng nhập tên sự kiện' : 'Please enter event title');
      return;
    }
    if (!startDate || !endDate) {
      setError(language === 'vi' ? 'Vui lòng chọn ngày bắt đầu và ngày kết thúc' : 'Please select start and end dates');
      return;
    }

    onCreateEvent({
      title,
      theme: theme || title,
      startDate,
      endDate,
      location,
      description: description || 'Sự kiện văn hóa đọc và giao lưu tác giả sách.',
      status,
      isPublished,
      totalBooths,
      maxCapacity,
      boothDeadline: boothDeadline || startDate,
      activityDeadline: activityDeadline || startDate,
      participantDeadline: participantDeadline || endDate,
      cancellationCutoff: cancellationCutoff || startDate,
    });

    onClose();
  };

  return (
    <div className="org-modal-backdrop" onClick={onClose}>
      <div 
        className="org-modal-box" 
        style={{ 
          maxWidth: '720px', 
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2EAE5',
          overflow: 'hidden'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="org-modal-header" style={{ padding: '1.25rem 1.75rem', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#17382E', fontFamily: 'var(--font-serif, serif)' }}>
              {language === 'vi' ? 'Khởi tạo sự kiện mới' : 'Create New Event'}
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#556B65', margin: '4px 0 0 0' }}>
              {language === 'vi' 
                ? 'Thiết lập thông tin chung, thời gian, quy mô gian hàng và các mốc thời hạn'
                : 'Set up basic information, schedule, booth capacity, and operation deadlines'}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              background: '#F3F4F6', 
              border: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              color: '#6B7280',
              transition: 'all 0.15s ease' 
            }}
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="org-modal-body" style={{ padding: '1.5rem 1.75rem', maxHeight: 'calc(80vh - 140px)', overflowY: 'auto' }}>
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 500
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Event Name */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                {language === 'vi' ? 'Tên sự kiện *' : 'Event Title *'}
              </label>
              <input 
                type="text"
                placeholder={language === 'vi' ? 'Ví dụ: Lễ hội Sách Mùa Đông 2026' : 'e.g. Winter Book Festival 2026'}
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  fontSize: '0.9rem',
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            {/* Theme & Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Chủ đề chính' : 'Main Theme'}
                </label>
                <input 
                  type="text"
                  placeholder={language === 'vi' ? 'Ví dụ: Khơi nguồn tri thức trẻ' : 'e.g. Igniting Young Minds'}
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '0.9rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Địa điểm tổ chức' : 'Location'}
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} color="#6B7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 0.85rem 0 2.35rem',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      background: '#FFFFFF',
                      fontSize: '0.9rem',
                      color: '#111827',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Ngày bắt đầu *' : 'Start Date *'}
                </label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '0.9rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Ngày kết thúc *' : 'End Date *'}
                </label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '0.9rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
            </div>

            {/* Scale: Booths and Capacity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Số lượng gian hàng phân bổ' : 'Allocated Booths'}
                </label>
                <input 
                  type="number"
                  min="1"
                  max="100"
                  value={totalBooths}
                  onChange={e => setTotalBooths(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '0.9rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                  {language === 'vi' ? 'Sức chứa tối đa (người)' : 'Max Participant Capacity'}
                </label>
                <input 
                  type="number"
                  min="50"
                  step="50"
                  value={maxCapacity}
                  onChange={e => setMaxCapacity(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '0.9rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Deadlines Section Card */}
            <div style={{ 
              background: '#F8FAF9', 
              borderRadius: '12px', 
              padding: '1.1rem 1.25rem', 
              border: '1px solid #E2EAE5',
              marginBottom: '1.25rem' 
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 750, color: '#17382E', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {language === 'vi' ? 'CẤU HÌNH MỐC THỜI HẠN (DEADLINES)' : 'CONFIGURABLE OPERATION DEADLINES'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#556B65', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {language === 'vi' ? 'Hạn đăng ký gian hàng' : 'Booth Application Deadline'}
                  </label>
                  <input 
                    type="date"
                    value={boothDeadline}
                    onChange={e => setBoothDeadline(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 0.65rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem', background: '#FFFFFF', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#556B65', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {language === 'vi' ? 'Hạn đăng ký hoạt động' : 'Activity Proposal Deadline'}
                  </label>
                  <input 
                    type="date"
                    value={activityDeadline}
                    onChange={e => setActivityDeadline(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 0.65rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem', background: '#FFFFFF', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#556B65', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {language === 'vi' ? 'Hạn đăng ký tham gia (Độc giả)' : 'Participant Registration Cutoff'}
                  </label>
                  <input 
                    type="date"
                    value={participantDeadline}
                    onChange={e => setParticipantDeadline(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 0.65rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem', background: '#FFFFFF', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#556B65', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {language === 'vi' ? 'Hạn hủy đăng ký / hoàn tiền' : 'Cancellation Cutoff'}
                  </label>
                  <input 
                    type="date"
                    value={cancellationCutoff}
                    onChange={e => setCancellationCutoff(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 0.65rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem', background: '#FFFFFF', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.4rem' }}>
                {language === 'vi' ? 'Mô tả tóm tắt sự kiện' : 'Event Description'}
              </label>
              <textarea 
                rows={3}
                placeholder={language === 'vi' ? 'Nội dung mục tiêu, điểm nhấn của sự kiện...' : 'Event objectives and highlights...'}
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  fontSize: '0.88rem',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Status Radio */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#1F2937', marginBottom: '0.5rem' }}>
                {language === 'vi' ? 'Trạng thái ban đầu' : 'Initial Status'}
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  fontSize: '0.86rem', 
                  cursor: 'pointer',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  border: status === 'draft' ? '1.5px solid #17382E' : '1px solid #E5E7EB',
                  background: status === 'draft' ? '#F0FDF4' : '#FFFFFF',
                  flex: 1,
                  transition: 'all 0.15s ease'
                }}>
                  <input 
                    type="radio" 
                    name="eventStatus" 
                    value="draft" 
                    checked={status === 'draft'} 
                    onChange={() => {
                      setStatus('draft');
                    }} 
                  />
                  <span style={{ fontWeight: status === 'draft' ? 650 : 500, color: status === 'draft' ? '#17382E' : '#4B5563' }}>
                    {language === 'vi' ? 'Bản nháp (Chuẩn bị nội bộ)' : 'Draft (Internal)'}
                  </span>
                </label>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  fontSize: '0.86rem', 
                  cursor: 'pointer',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  border: status === 'upcoming' ? '1.5px solid #17382E' : '1px solid #E5E7EB',
                  background: status === 'upcoming' ? '#F0FDF4' : '#FFFFFF',
                  flex: 1,
                  transition: 'all 0.15s ease'
                }}>
                  <input 
                    type="radio" 
                    name="eventStatus" 
                    value="upcoming" 
                    checked={status === 'upcoming'} 
                    onChange={() => {
                      setStatus('upcoming');
                      setIsPublished(true);
                    }} 
                  />
                  <span style={{ fontWeight: status === 'upcoming' ? 650 : 500, color: status === 'upcoming' ? '#17382E' : '#4B5563' }}>
                    {language === 'vi' ? 'Sắp diễn ra' : 'Upcoming'}
                  </span>
                </label>
              </div>
            </div>

            {/* Landing Page Visibility Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: isPublished ? '1.5px solid #16A34A' : '1px solid #D1D5DB',
              background: isPublished ? '#F0FDF4' : '#F9FAFB',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setIsPublished(!isPublished)}
            >
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 650, color: isPublished ? '#15803D' : '#374151' }}>
                  {isPublished
                    ? (language === 'vi' ? '✓ Công bố công khai trên Landing Page' : '✓ Publish publicly on Landing Page')
                    : (language === 'vi' ? '👁 Đang ẩn khỏi Landing Page (Nội bộ)' : '👁 Hidden from Landing Page (Internal)')
                  }
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '0.15rem' }}>
                  {isPublished
                    ? (language === 'vi' ? 'Độc giả và đối tác có thể xem sự kiện này tại trang chủ' : 'Public readers and partners can discover this event on home page')
                    : (language === 'vi' ? 'Sự kiện chỉ hiển thị trong ban tổ chức để chuẩn bị nội dung' : 'Event is only visible to organizers during preparation')
                  }
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={isPublished} 
                onChange={(e) => {
                  e.stopPropagation();
                  setIsPublished(e.target.checked);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16A34A' }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="org-modal-footer" style={{ 
            padding: '1rem 1.75rem', 
            borderTop: '1px solid #E5E7EB', 
            background: '#F9FAFB', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            gap: '0.75rem' 
          }}>
            <button 
              type="button"
              className="btn-org-secondary"
              onClick={onClose}
              style={{ padding: '0.5rem 1.25rem', height: '38px', borderRadius: '8px', fontSize: '0.88rem' }}
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button 
              type="submit"
              className="btn-org-primary"
              style={{ 
                padding: '0.5rem 1.4rem', 
                height: '38px', 
                borderRadius: '8px', 
                fontSize: '0.88rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(23, 56, 46, 0.2)'
              }}
            >
              <Check size={16} />
              <span>{language === 'vi' ? 'Tạo sự kiện' : 'Create Event'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
