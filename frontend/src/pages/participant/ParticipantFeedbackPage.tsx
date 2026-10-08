import {
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Star
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { NotificationCallout } from '../../components/ui/NotificationCallout';
import { participantApi } from '../../services/participantApi';
import { FeedbackRecord, Language } from '../../types';
import './ParticipantPages.css';

export interface ParticipantFeedbackPageProps {
  language: Language;
  userEmail?: string;
  userName?: string;
  feedbacks?: FeedbackRecord[];
  onSubmitFeedback?: (newFeedback: Omit<FeedbackRecord, 'id' | 'createdAt' | 'status'>) => void;
}

export const ParticipantFeedbackPage: React.FC<ParticipantFeedbackPageProps> = ({
  language,
  userEmail = '',
  userName: _userName = '',
  feedbacks,
  onSubmitFeedback
}) => {
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>(feedbacks || []);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tải danh sách góp ý thật từ Database nếu có
  useEffect(() => {
    participantApi.getMyFeedbacks().then(apiList => {
      if (Array.isArray(apiList)) {
        const mapped: FeedbackRecord[] = apiList.map(item => ({
          id: item.id,
          targetScope: item.targetScope,
          targetName: item.targetName || item.heritage?.name || item.booth?.name || 'Đường Sách TP.HCM',
          rating: item.rating,
          comments: item.comments || '',
          contactEmail: item.contactEmail || userEmail,
          createdAt: new Date(item.createdAt).toLocaleString('vi-VN'),
          source: item.source || 'web_landing',
          status: item.status === 'resolved' ? 'responded' : item.status === 'in_progress' ? 'in_progress' : 'new',
          assignedTo: item.assignee?.fullName || 'Ban Quản Lý',
          internalNote: item.internalNote || undefined,
        }));
        setFeedbackList(mapped);
      }
    }).catch(err => console.warn('Could not load feedbacks from API', err));
  }, [userEmail]);

  // Form state
  const [targetScope, setTargetScope] = useState<'entire' | 'heritage' | 'booth' | 'facility'>('entire');
  const [targetName, setTargetName] = useState('Toàn Đường Sách TP.HCM');
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredList = feedbackList.filter(item => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim()) return;

    setIsSubmitting(true);
    try {
      // Gửi vào backend API (tạo Feedback và Notification cho BQL)
      const res = await participantApi.submitFeedback({
        rating,
        comments: comments.trim(),
        targetScope,
        targetName,
      });

      const newFb: FeedbackRecord = {
        id: res.id,
        targetScope,
        targetName,
        rating,
        comments: comments.trim(),
        contactEmail: userEmail,
        createdAt: 'Vừa xong',
        source: 'web_landing',
        status: 'new',
        assignedTo: 'Ban Quản Lý tiếp nhận'
      };

      if (onSubmitFeedback) {
        onSubmitFeedback(newFb);
      }
      setFeedbackList(prev => [newFb, ...prev]);
      setIsModalOpen(false);
      setComments('');
      setRating(5);
      setToastMessage(language === 'vi' ? 'Đã gửi góp ý thành công! Thông báo đã được chuyển đến Ban Quản Lý để duyệt và phản hồi.' : 'Feedback submitted successfully to Management Board!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage(err instanceof Error ? err.message : (language === 'vi' ? 'Không gửi được góp ý. Vui lòng thử lại.' : 'Could not submit feedback. Please retry.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: FeedbackRecord['status']) => {
    switch (status) {
      case 'new':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE'
          }}>
            <Clock size={12} />
            {language === 'vi' ? 'Đã tiếp nhận' : 'Received'}
          </span>
        );
      case 'in_progress':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#FEF3C7',
            color: '#B45309',
            border: '1px solid #FDE68A'
          }}>
            <Clock size={12} />
            {language === 'vi' ? 'Đang xử lý' : 'In Progress'}
          </span>
        );
      case 'responded':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#E8F5EF',
            color: '#185E48',
            border: '1px solid #A7D7C5'
          }}>
            <CheckCircle2 size={12} />
            {language === 'vi' ? 'Đã phản hồi' : 'Responded'}
          </span>
        );
      case 'closed':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: '#F3F4F6',
            color: '#4B5563',
            border: '1px solid #E5E7EB'
          }}>
            <ShieldCheck size={12} />
            {language === 'vi' ? 'Hoàn tất' : 'Closed'}
          </span>
        );
      default:
        return null;
    }
  };

  const getScopeIcon = (scope: FeedbackRecord['targetScope']) => {
    switch (scope) {
      case 'heritage':
        return <Building2 size={16} color="#B3862A" />;
      case 'booth':
        return <Building2 size={16} color="#185E48" />;
      case 'facility':
        return <MapPin size={16} color="#2563EB" />;
      default:
        return <MessageSquare size={16} color="#14241F" />;
    }
  };

  return (
    <div className="participant-feedback-page">
      {/* 1. Page Header */}
      <div className="participant-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="participant-page-title" style={{ margin: '0 0 0.35rem 0' }}>
            {language === 'vi' ? 'Đánh giá & Góp ý của tôi' : 'My Feedback & Inquiries'}
          </h1>
          <p className="participant-page-sub">
            {language === 'vi' 
              ? 'Theo dõi danh sách các ý kiến, góp ý trải nghiệm bạn đã gửi tới Ban Quản Lý Đường Sách TP.HCM.' 
              : 'Track and manage your submitted reviews, feedback, and management responses.'}
          </p>
        </div>

        <button 
          type="button" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.35rem',
            borderRadius: '9999px',
            background: '#14241F',
            color: '#FFFFFF',
            border: '1px solid #E9BC63',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(20, 36, 31, 0.18)',
            flex: '0 0 auto',
            width: 'auto',
            whiteSpace: 'nowrap',
            transition: 'all 180ms ease'
          }}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={16} color="#E9BC63" />
          <span>{language === 'vi' ? 'Gửi góp ý mới' : 'Submit New Feedback'}</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <NotificationCallout
          variant={toastMessage.toLowerCase().includes('khÃ´ng') || toastMessage.toLowerCase().includes('could not') ? 'error' : 'success'}
          title={language === 'vi' ? 'ThÃ´ng bÃ¡o gÃ³p Ã½' : 'Feedback notice'}
          className="participant-inline-notice"
        >
          {toastMessage}
        </NotificationCallout>
      )}

      {/* 2. Stats & Filter Bar */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2EAE5',
        borderRadius: '14px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 2px 8px rgba(24, 41, 36, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#637771', fontWeight: 600, display: 'block' }}>
              {language === 'vi' ? 'Tổng số góp ý đã gửi' : 'Total Submissions'}
            </span>
            <strong style={{ fontSize: '1.35rem', color: '#172421', fontFamily: 'var(--font-serif)' }}>
              {feedbackList.length}
            </strong>
          </div>
          <div style={{ width: '1px', height: '32px', background: '#E2EAE5' }} />
          <div>
            <span style={{ fontSize: '0.78rem', color: '#637771', fontWeight: 600, display: 'block' }}>
              {language === 'vi' ? 'Đã được phản hồi' : 'Responded'}
            </span>
            <strong style={{ fontSize: '1.35rem', color: '#185E48', fontFamily: 'var(--font-serif)' }}>
              {feedbackList.filter(f => f.status === 'responded' || f.status === 'closed').length}
            </strong>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
          <span style={{ fontSize: '0.82rem', color: '#637771', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={14} />
            {language === 'vi' ? 'Lọc theo trạng thái:' : 'Filter:'}
          </span>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.45rem', 
            flexWrap: 'nowrap', 
            overflowX: 'auto',
            paddingBottom: '0.2rem',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}>
            {[
              { id: 'all', label: language === 'vi' ? 'Tất cả' : 'All' },
              { id: 'new', label: language === 'vi' ? 'Đã tiếp nhận' : 'Received' },
              { id: 'in_progress', label: language === 'vi' ? 'Đang xử lý' : 'In Progress' },
              { id: 'responded', label: language === 'vi' ? 'Đã phản hồi' : 'Responded' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterStatus(f.id)}
                style={{
                  border: filterStatus === f.id ? '1px solid #14241F' : '1px solid #E2EAE5',
                  background: filterStatus === f.id ? '#14241F' : '#FFFFFF',
                  color: filterStatus === f.id ? '#FFFFFF' : '#4B5563',
                  borderRadius: '20px',
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 160ms ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Feedback Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredList.length === 0 ? (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2EAE5',
            borderRadius: '16px',
            padding: '3rem 2rem',
            textAlign: 'center',
            color: '#637771'
          }}>
            <MessageSquare size={36} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1.05rem', color: '#172421', marginBottom: '0.35rem' }}>
              {language === 'vi' ? 'Chưa có góp ý nào trong mục này' : 'No feedback found'}
            </h3>
            <p style={{ fontSize: '0.84rem', margin: '0 0 1.25rem 0', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
              {language === 'vi' 
                ? 'Hãy chia sẻ trải nghiệm và đóng góp ý kiến của bạn để cùng xây dựng Đường Sách ngày càng phát triển.' 
                : 'Share your experience and thoughts to help improve Book Street events.'}
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.45rem',
                borderRadius: '9999px',
                background: '#14241F',
                color: '#FFFFFF',
                border: '1px solid #E9BC63',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(20, 36, 31, 0.15)',
                transition: 'all 180ms ease'
              }}
            >
              <Plus size={16} color="#E9BC63" />
              <span>{language === 'vi' ? 'Gửi góp ý ngay' : 'Submit Feedback Now'}</span>
            </button>
          </div>
        ) : (
          filteredList.map((fb) => (
            <div 
              key={fb.id}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2EAE5',
                borderRadius: '14px',
                padding: '1.35rem 1.5rem',
                boxShadow: '0 2px 6px rgba(24, 41, 36, 0.03)',
                transition: 'all 180ms ease'
              }}
            >
              {/* Card Top */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#F0F5F2',
                    border: '1px solid #D6E4DF',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    {getScopeIcon(fb.targetScope)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#172421' }}>
                      {fb.targetName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.15rem' }}>
                      <span style={{ fontSize: '0.74rem', color: '#7B8F89' }}>
                        {fb.createdAt}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#CBD5E1' }}>•</span>
                      <span style={{ fontSize: '0.74rem', color: '#7B8F89' }}>
                        {fb.contactEmail}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Star Rating */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={15} 
                        fill={star <= fb.rating ? '#E9BC63' : 'none'} 
                        color={star <= fb.rating ? '#E9BC63' : '#D1D5DB'} 
                      />
                    ))}
                  </div>
                  {getStatusBadge(fb.status)}
                </div>
              </div>

              {/* Feedback Content */}
              <div style={{
                background: '#F8FAF9',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                fontSize: '0.86rem',
                color: '#2D3E39',
                lineHeight: 1.55,
                marginBottom: fb.internalNote ? '0.85rem' : 0
              }}>
                "{fb.comments}"
              </div>

              {/* Response from Management */}
              {fb.internalNote && (
                <div style={{
                  background: '#EAF5F0',
                  borderLeft: '3px solid #185E48',
                  borderRadius: '0 8px 8px 0',
                  padding: '0.85rem 1rem',
                  marginTop: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={14} color="#185E48" />
                    <strong style={{ fontSize: '0.78rem', color: '#185E48' }}>
                      {fb.assignedTo || (language === 'vi' ? 'Phản hồi từ Ban Quản Lý' : 'Management Response')}
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#1E3E34', lineHeight: 1.5 }}>
                    {fb.internalNote}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 4. Modal: Gửi Góp Ý Mới */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14, 28, 23, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            border: '1px solid #E2EAE5',
            overflow: 'hidden',
            animation: 'notifDropdownFadeIn 200ms ease'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              background: '#14241F',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#FFFFFF', fontFamily: 'var(--font-serif)' }}>
                  {language === 'vi' ? 'Gửi Đánh Giá & Ý Kiến Đóng Góp' : 'Submit Feedback'}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#E9BC63' }}>
                  {language === 'vi' ? 'Đường Sách TP.HCM trân trọng mọi ý kiến của bạn' : 'We value your thoughts'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} style={{ padding: '1.5rem' }}>
              {/* Phạm vi góp ý */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                  {language === 'vi' ? 'Nội dung góp ý cho:' : 'Feedback target:'}
                </label>
                <select
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #D1DED8',
                    padding: '0 0.75rem',
                    fontSize: '0.85rem',
                    color: '#172421',
                    background: '#FFFFFF'
                  }}
                  value={targetScope}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setTargetScope(val);
                    if (val === 'entire') setTargetName('Toàn Đường Sách TP.HCM');
                    if (val === 'heritage') setTargetName('DS-01 Quần thể Di tích Cố đô Huế');
                    if (val === 'booth') setTargetName('Gian hàng Nhà Xuất Bản Trẻ (A01)');
                    if (val === 'facility') setTargetName('Khu vực Cà phê & Nhà vệ sinh');
                  }}
                >
                  <option value="entire">{language === 'vi' ? 'Toàn bộ Đường Sách & Tiện ích chung' : 'Entire Book Street'}</option>
                  <option value="heritage">{language === 'vi' ? 'Điểm Di tích Lịch sử & Không gian Di sản' : 'Heritage & History Spots'}</option>
                  <option value="booth">{language === 'vi' ? 'Gian hàng & Quầy sách' : 'Specific Bookstall'}</option>
                  <option value="facility">{language === 'vi' ? 'Dịch vụ Cà phê / Vệ sinh / Ghế ngồi' : 'Facilities & Restrooms'}</option>
                </select>
              </div>

              {/* Tên đối tượng chi tiết */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                  {language === 'vi' ? 'Địa điểm / Gian hàng cụ thể:' : 'Specific location:'}
                </label>
                <input
                  type="text"
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #D1DED8',
                    padding: '0 0.75rem',
                    fontSize: '0.85rem',
                    color: '#172421',
                    boxSizing: 'border-box'
                  }}
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                />
              </div>

              {/* Đánh giá sao */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                  {language === 'vi' ? 'Mức độ hài lòng:' : 'Rating:'}
                </label>
                <div className="emoji-experience-rating" role="radiogroup" aria-label={language === 'vi' ? 'Mức độ hài lòng' : 'Experience rating'}>
                  <div className="emoji-experience-row">
                    {[
                      { value: 1, icon: '😔', labelVi: 'Cần cải thiện', labelEn: 'Poor' },
                      { value: 2, icon: '😟', labelVi: 'Chưa hài lòng', labelEn: 'Unsatisfied' },
                      { value: 3, icon: '😐', labelVi: 'Bình thường', labelEn: 'Neutral' },
                      { value: 4, icon: '🙂', labelVi: 'Hài lòng', labelEn: 'Satisfied' },
                      { value: 5, icon: '😍', labelVi: 'Rất hài lòng', labelEn: 'Amazing' }
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`emoji-experience-btn ${rating === item.value ? 'active' : ''} ${item.value <= rating ? 'is-lit' : ''}`}
                        onClick={() => setRating(item.value)}
                        role="radio"
                        aria-checked={rating === item.value}
                        aria-label={language === 'vi' ? item.labelVi : item.labelEn}
                      >
                        <span aria-hidden="true">{item.icon}</span>
                      </button>
                    ))}
                  </div>
                  <span className="emoji-experience-caption">
                    {rating === 5 && (language === 'vi' ? 'Rất hài lòng' : 'Amazing')}
                    {rating === 4 && (language === 'vi' ? 'Hài lòng' : 'Satisfied')}
                    {rating === 3 && (language === 'vi' ? 'Bình thường' : 'Neutral')}
                    {rating === 2 && (language === 'vi' ? 'Chưa hài lòng' : 'Unsatisfied')}
                    {rating === 1 && (language === 'vi' ? 'Cần cải thiện' : 'Poor')}
                  </span>
                </div>
                <div className="participant-rating-control">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`participant-rating-btn ${rating === star ? 'active' : ''}`}
                      onClick={() => setRating(star)}
                      aria-label={`${language === 'vi' ? 'Chọn mức đánh giá' : 'Choose rating'} ${star}`}
                    >
                      <span>{star}</span>
                      <Star
                        size={13}
                        fill="none"
                      />
                    </button>
                  ))}
                  <span className="participant-rating-caption">
                    {rating === 5 && (language === 'vi' ? 'Rất hài lòng ★★★★★' : 'Very satisfied ★★★★★')}
                    {rating === 4 && (language === 'vi' ? 'Hài lòng ★★★★' : 'Satisfied ★★★★')}
                    {rating === 3 && (language === 'vi' ? 'Bình thường ★★★' : 'Neutral ★★★')}
                    {rating === 2 && (language === 'vi' ? 'Chưa hài lòng ★★' : 'Unsatisfied ★★')}
                    {rating === 1 && (language === 'vi' ? 'Cần cải thiện ★' : 'Needs improvement ★')}
                  </span>
                  <span className="participant-rating-caption participant-rating-caption-legacy">
                    {rating === 5 ? (language === 'vi' ? 'Rất tuyệt vời (5/5)' : 'Excellent') : `${rating}/5 sao`}
                  </span>
                </div>
              </div>

              {/* Ý kiến đóng góp */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#172421', marginBottom: '0.35rem' }}>
                  {language === 'vi' ? 'Ý kiến chi tiết & Đề xuất:' : 'Detailed comments:'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={language === 'vi' ? 'Nhập nhận xét, trải nghiệm hoặc đề xuất cải tiến của bạn...' : 'Type your comments...'}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #D1DED8',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.85rem',
                    color: '#172421',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    border: '1px solid #D1DED8',
                    background: '#FFFFFF',
                    color: '#4B5563',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1.35rem',
                    borderRadius: '8px',
                    border: '1px solid #E9BC63',
                    background: '#14241F',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Send size={15} color="#E9BC63" />
                  <span>{isSubmitting ? (language === 'vi' ? 'Đang gửi...' : 'Sending...') : (language === 'vi' ? 'Gửi góp ý' : 'Submit')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
