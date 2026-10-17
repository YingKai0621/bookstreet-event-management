import { CheckCircle2, MessageSquare, Plus, Send, Star } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { PageHeader } from '../../components/ui/PageHeader';
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
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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
    }).catch(() => setLoadError(language === 'vi' ? 'Không tải được góp ý. Tải lại trang để thử lại.' : 'Could not load feedback. Reload the page to retry.'))
      .finally(() => setIsLoading(false));
  }, [userEmail, language]);

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
    setFormError('');
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
      setToastMessage(language === 'vi' ? 'Đã gửi góp ý. Bạn có thể theo dõi phản hồi tại đây.' : 'Feedback submitted successfully to Management Board!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setFormError(err instanceof Error ? err.message : (language === 'vi' ? 'Không gửi được góp ý. Vui lòng thử lại.' : 'Could not submit feedback. Please retry.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const vi = language === 'vi';
  const statusLabels: Record<string, string> = {
    new: vi ? 'Đã tiếp nhận' : 'Received',
    in_progress: vi ? 'Đang xử lý' : 'In progress',
    responded: vi ? 'Đã phản hồi' : 'Replied',
    closed: vi ? 'Hoàn tất' : 'Closed',
  };

  return (
    <div className="participant-feedback-page">
      <PageHeader className="reader-tab-header" title={vi ? 'Góp ý' : 'Feedback'}
        subtitle={vi ? 'Gửi góp ý và theo dõi phản hồi từ Ban Quản Lý.' : 'Share feedback and follow management responses.'}
        actions={<button type="button" className="btn-part-primary" onClick={() => setIsModalOpen(true)}><Plus size={16} />{vi ? 'Gửi góp ý' : 'New feedback'}</button>} />
      {toastMessage && <p className="reader-profile-notice" role="status">{toastMessage}</p>}
      <div className="reader-feedback-toolbar">
        <span className="reader-feedback-count">{feedbackList.length} {vi ? 'góp ý đã gửi' : 'submissions'}</span>
        <div className="reader-feedback-filters" role="group" aria-label={vi ? 'Trạng thái góp ý' : 'Feedback status'}>
          {['all', 'new', 'in_progress', 'responded'].map(status => <button key={status} type="button" aria-pressed={filterStatus === status} onClick={() => setFilterStatus(status)}>
            {status === 'all' ? (vi ? 'Tất cả' : 'All') : statusLabels[status]}
          </button>)}
        </div>
      </div>
      <div className="reader-feedback-list">
        {isLoading ? <p className="reader-profile-notice" role="status">{vi ? 'Đang tải góp ý…' : 'Loading feedback…'}</p> : loadError ? <EmptyState isError title={vi ? 'Không tải được góp ý' : 'Could not load feedback'} description={loadError} /> : filteredList.length === 0 ? <EmptyState icon={<MessageSquare size={28} />}
          title={vi ? (feedbackList.length ? 'Không có góp ý phù hợp' : 'Chưa có góp ý') : 'No feedback to show'}
          description={vi ? 'Ý kiến của bạn giúp Đường Sách phục vụ tốt hơn.' : 'Your feedback helps improve Book Street.'}
          actionLabel={vi ? (feedbackList.length ? 'Xem tất cả' : 'Gửi góp ý') : (feedbackList.length ? 'Show all' : 'Share feedback')}
          onAction={() => feedbackList.length ? setFilterStatus('all') : setIsModalOpen(true)} /> : filteredList.map(fb => (
          <article className="reader-feedback-card" key={fb.id}>
            <header><div><h2>{fb.targetName}</h2><time>{fb.createdAt}</time></div><span className="reader-feedback-status">{statusLabels[fb.status] || fb.status}</span></header>
            <div className="reader-feedback-rating" aria-label={`${fb.rating}/5`}>
              {[1,2,3,4,5].map(star => <Star key={star} size={15} aria-hidden="true" fill={star <= fb.rating ? 'currentColor' : 'none'} />)}
            </div>
            <p>{fb.comments}</p>
            {fb.internalNote && <div className="reader-feedback-response"><strong><CheckCircle2 size={14} aria-hidden="true" /> {fb.assignedTo || (vi ? 'Ban Quản Lý' : 'Management')}</strong><p>{fb.internalNote}</p></div>}
          </article>
        ))}
      </div>
      <ModalDialog isOpen={isModalOpen} onClose={() => { if (!isSubmitting) setIsModalOpen(false); }} title={vi ? 'Gửi góp ý' : 'Share feedback'} maxWidth={560}>
        <form className="reader-feedback-form" onSubmit={handleFormSubmit}>
          {formError && <p className="reader-profile-notice error" role="alert">{formError}</p>}
          <label htmlFor="reader-feedback-scope">{vi ? 'Phạm vi' : 'Scope'}
            <select id="reader-feedback-scope" value={targetScope} disabled={isSubmitting} onChange={e => {
              const scope = e.target.value as typeof targetScope;
              setTargetScope(scope);
              setTargetName(scope === 'entire' ? 'Toàn Đường Sách TP.HCM' : '');
            }}>
              <option value="entire">{vi ? 'Toàn Đường Sách' : 'Book Street'}</option>
              <option value="heritage">{vi ? 'Di sản' : 'Heritage'}</option>
              <option value="booth">{vi ? 'Gian hàng' : 'Bookstall'}</option>
              <option value="facility">{vi ? 'Tiện ích' : 'Facilities'}</option>
            </select>
          </label>
          <label htmlFor="reader-feedback-target">{vi ? 'Địa điểm / Gian hàng' : 'Location / Bookstall'}
            <input id="reader-feedback-target" value={targetName} onChange={e => setTargetName(e.target.value)} required disabled={isSubmitting} />
          </label>
          <fieldset disabled={isSubmitting}><legend>{vi ? 'Mức độ hài lòng' : 'Rating'}</legend>
            <div className="reader-rating-options">{[1,2,3,4,5].map(value => <label key={value}><input type="radio" name="feedback-rating" value={value} checked={rating === value} onChange={() => setRating(value)} />{value}<Star size={14} aria-hidden="true" /></label>)}</div>
          </fieldset>
          <label htmlFor="reader-feedback-comment">{vi ? 'Nội dung góp ý' : 'Comments'}
            <textarea id="reader-feedback-comment" required value={comments} onChange={e => setComments(e.target.value)} disabled={isSubmitting} />
          </label>
          <div className="reader-form-actions"><button type="button" className="btn-part-secondary" disabled={isSubmitting} onClick={() => setIsModalOpen(false)}>{vi ? 'Hủy' : 'Cancel'}</button>
            <button type="submit" className="btn-part-primary" disabled={isSubmitting || !comments.trim() || !targetName.trim()}><Send size={15} />{isSubmitting ? (vi ? 'Đang gửi…' : 'Sending…') : (vi ? 'Gửi góp ý' : 'Send feedback')}</button></div>
        </form>
      </ModalDialog>
    </div>
  );
};
