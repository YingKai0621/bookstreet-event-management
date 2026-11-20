import { displayDateText } from '../../utils/dateDisplay';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Star,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PaginatedList } from '../../components/ui/PaginatedList';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import type {
  Language,
  ParticipantActivity,
  ParticipantActivityRating,
} from '../../types';
import './ParticipantPages.css';

interface ActivityRatingsPageProps {
  language: Language;
  activities: ParticipantActivity[];
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onLoadRating: (activityId: string) => Promise<ParticipantActivityRating>;
  onRateActivity: (
    activityId: string,
    data: { score: number; comment: string },
  ) => Promise<ParticipantActivityRating>;
}

type RatingFilter = 'all' | 'pending' | 'rated';

function canRate(activity: ParticipantActivity): boolean {
  return activity.activityStatus === 'COMPLETED'
    && activity.attendanceStatus === 'VALID'
    && activity.rating?.status !== 'INVALIDATED';
}

function isRatingHistory(activity: ParticipantActivity): boolean {
  return activity.attendanceStatus === 'VALID' || Boolean(activity.rating);
}

function formatUpdatedAt(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export const ActivityRatingsPage = ({
  language,
  activities,
  isLoading,
  loadError,
  onRetry,
  onLoadRating,
  onRateActivity,
}: ActivityRatingsPageProps) => {
  const vi = language === 'vi';
  const [activeFilter, setActiveFilter] = useState<RatingFilter>('all');
  const [selectedActivity, setSelectedActivity] = useState<ParticipantActivity | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [isLoadingRating, setIsLoadingRating] = useState(false);
  const [ratingLoadFailed, setRatingLoadFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const closeModal = () => {
    if (isSubmitting) return;
    setSelectedActivity(null);
    setFormError('');
    setRatingLoadFailed(false);
  };
  useModalDismiss(Boolean(selectedActivity), closeModal);

  const ratingHistory = useMemo(
    () => activities.filter(isRatingHistory),
    [activities],
  );
  const pendingCount = ratingHistory.filter(activity => canRate(activity) && !activity.rating).length;
  const ratedCount = ratingHistory.filter(activity => activity.rating?.status === 'ACTIVE').length;
  const filteredActivities = ratingHistory.filter(activity => {
    if (activeFilter === 'pending') return canRate(activity) && !activity.rating;
    if (activeFilter === 'rated') return activity.rating?.status === 'ACTIVE';
    return true;
  });

  const openRating = async (activity: ParticipantActivity) => {
    const currentRating = activity.rating?.status === 'ACTIVE' ? activity.rating : null;
    setSelectedActivity(activity);
    setScore(currentRating?.score || 5);
    setComment(currentRating?.comment || '');
    setFormError('');
    setRatingLoadFailed(false);

    if (!currentRating) return;
    setIsLoadingRating(true);
    try {
      const latest = await onLoadRating(activity.id);
      setScore(latest.score);
      setComment(latest.comment);
      setSelectedActivity(current => current?.id === activity.id
        ? { ...current, rating: latest }
        : current);
    } catch (error) {
      setRatingLoadFailed(true);
      setFormError(error instanceof Error
        ? error.message
        : (vi ? 'Không thể tải đánh giá hiện tại.' : 'Unable to load the current rating.'));
    } finally {
      setIsLoadingRating(false);
    }
  };

  const submitRating = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedActivity || comment.length > 1000) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await onRateActivity(selectedActivity.id, { score, comment: comment.trim() });
      const activityTitle = selectedActivity.title;
      setSelectedActivity(null);
      setNotice(vi
        ? `Đã lưu đánh giá cho “${activityTitle}”.`
        : `Your rating for “${activityTitle}” was saved.`);
      window.setTimeout(() => setNotice(''), 4000);
    } catch (error) {
      setFormError(error instanceof Error
        ? error.message
        : (vi ? 'Không thể lưu đánh giá. Vui lòng thử lại.' : 'Unable to save the rating. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="activity-ratings-page">
      <div className="participant-page-header">
        <div>
          <h1 className="participant-page-title workspace-page-title">
            {vi ? 'Đánh giá hoạt động' : 'Activity Ratings'}
          </h1>
          <p className="participant-page-sub workspace-page-subtitle">
            {vi
              ? 'Chia sẻ trải nghiệm sau những hoạt động bạn đã điểm danh.'
              : 'Share your experience after activities you attended.'}
          </p>
        </div>
      </div>

      {notice && (
        <div className="participant-rating-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      <div className="participant-tabs-bar participant-tabs-bar--wrap" aria-label={vi ? 'Lọc đánh giá' : 'Filter ratings'}>
        <button type="button" className={`participant-tab-btn ${activeFilter === 'all' ? 'is-active' : ''}`} onClick={() => setActiveFilter('all')}>
          {vi ? `Tất cả (${ratingHistory.length})` : `All (${ratingHistory.length})`}
        </button>
        <button type="button" className={`participant-tab-btn ${activeFilter === 'pending' ? 'is-active' : ''}`} onClick={() => setActiveFilter('pending')}>
          {vi ? `Chưa đánh giá (${pendingCount})` : `Pending (${pendingCount})`}
        </button>
        <button type="button" className={`participant-tab-btn ${activeFilter === 'rated' ? 'is-active' : ''}`} onClick={() => setActiveFilter('rated')}>
          {vi ? `Đã đánh giá (${ratedCount})` : `Rated (${ratedCount})`}
        </button>
      </div>

      {isLoading ? (
        <div className="participant-data-state" role="status">
          <span className="participant-state-spinner" aria-hidden="true" />
          <strong>{vi ? 'Đang tải hoạt động đã tham dự' : 'Loading attended activities'}</strong>
          <p>{vi ? 'Hệ thống đang kiểm tra điểm danh và đánh giá của bạn.' : 'Checking your attendance and ratings.'}</p>
        </div>
      ) : loadError ? (
        <div className="participant-data-state is-error" role="alert">
          <strong>{vi ? 'Chưa tải được danh sách đánh giá' : 'Unable to load ratings'}</strong>
          <p>{loadError}</p>
          <button type="button" className="btn-part-secondary" onClick={onRetry}>
            <RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}
          </button>
        </div>
      ) : ratingHistory.length === 0 ? (
        <div className="participant-data-state">
          <MessageSquare size={30} aria-hidden="true" />
          <strong>{vi ? 'Chưa có hoạt động để đánh giá' : 'No activities to rate yet'}</strong>
          <p>{vi
            ? 'Hoạt động đã hoàn thành và có điểm danh hợp lệ sẽ xuất hiện tại đây.'
            : 'Completed activities with valid attendance will appear here.'}</p>
          <Link to="/participant/activities" className="btn-part-primary">
            {vi ? 'Xem hoạt động của tôi' : 'View my activities'}
          </Link>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="participant-data-state compact">
          <strong>{vi ? 'Không có hoạt động trong mục này' : 'No activities in this section'}</strong>
          <p>{vi ? 'Hãy chọn bộ lọc khác để xem lịch sử đánh giá.' : 'Choose another filter to view your rating history.'}</p>
        </div>
      ) : (
        <PaginatedList items={filteredActivities}>{pageItems => (
          <div className="participant-rating-list">
            {pageItems.map(activity => {
              const rating = activity.rating;
              const eligible = canRate(activity);
              const invalidated = rating?.status === 'INVALIDATED';
              return (
                <article key={activity.registrationId || activity.id} className="participant-rating-card">
                  <div className="participant-rating-card-main">
                    <div className="participant-rating-card-heading">
                      <div>
                        <Link className="participant-rating-event" to={`/participant/events/${encodeURIComponent(activity.eventId)}?section=activities`}>
                          {activity.eventName}
                        </Link>
                        <h2><Link to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`}>{activity.title}</Link></h2>
                      </div>
                      {(!rating || invalidated) && (
                        <span className={`participant-rating-status ${invalidated ? 'is-invalidated' : eligible ? 'is-pending' : 'is-unavailable'}`}>
                          {invalidated
                            ? (vi ? 'Đã vô hiệu hóa' : 'Invalidated')
                            : eligible
                              ? (vi ? 'Có thể đánh giá' : 'Ready to rate')
                              : (vi ? 'Chưa thể đánh giá' : 'Not ready')}
                        </span>
                      )}
                    </div>
                    <div className="participant-rating-meta">
                      <span><Calendar size={15} />{displayDateText(activity.date)}</span>
                      <span><Clock size={15} />{activity.time}</span>
                      <span><MapPin size={15} />{activity.venue}</span>
                    </div>
                    {rating && (
                      <div className={`participant-rating-summary ${invalidated ? 'is-invalidated' : ''}`}>
                        <div className="participant-rating-stars" aria-label={`${rating.score}/5`}>
                          {[1, 2, 3, 4, 5].map(value => (
                            <Star key={value} size={18} fill={value <= rating.score ? 'currentColor' : 'none'} />
                          ))}
                          <strong>{rating.score}/5</strong>
                        </div>
                        <p>{rating.comment || (vi ? 'Không có bình luận.' : 'No written comment.')}</p>
                        <small>{vi ? 'Cập nhật' : 'Updated'}: {formatUpdatedAt(rating.updatedAt, language)}</small>
                      </div>
                    )}
                  </div>
                  <div className="participant-rating-card-actions">
                    <Link to={`/participant/activities/detail/${encodeURIComponent(activity.id)}`} className="btn-part-secondary">
                      {vi ? 'Chi tiết' : 'Details'}
                    </Link>
                    {eligible && (
                      <button type="button" className="btn-part-primary" onClick={() => void openRating(activity)}>
                        {rating ? <Pencil size={16} /> : <Star size={16} />}
                        {rating ? (vi ? 'Chỉnh sửa' : 'Edit rating') : (vi ? 'Đánh giá' : 'Rate activity')}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}</PaginatedList>
      )}

      {selectedActivity && (
        <div className="participant-modal-overlay" role="presentation">
          <section className="participant-rating-modal" role="dialog" aria-modal="true" aria-labelledby="activity-rating-title">
            <header>
              <div>
                <span>{selectedActivity.rating ? (vi ? 'CHỈNH SỬA ĐÁNH GIÁ' : 'EDIT RATING') : (vi ? 'ĐÁNH GIÁ HOẠT ĐỘNG' : 'RATE ACTIVITY')}</span>
                <h2 id="activity-rating-title">{selectedActivity.title}</h2>
                <p>{selectedActivity.eventName}</p>
              </div>
              <button type="button" className="participant-modal-close" aria-label={vi ? 'Đóng' : 'Close'} onClick={closeModal} disabled={isSubmitting}>
                <X size={22} />
              </button>
            </header>

            <form onSubmit={submitRating}>
              {isLoadingRating ? (
                <div className="participant-rating-form-loading" role="status">
                  <span className="participant-state-spinner" aria-hidden="true" />
                  {vi ? 'Đang tải đánh giá hiện tại...' : 'Loading current rating...'}
                </div>
              ) : (
                <>
                  {formError && <div className="participant-rating-form-error" role="alert"><AlertTriangle size={17} />{formError}</div>}
                  <fieldset className="participant-rating-fieldset" disabled={isSubmitting || ratingLoadFailed}>
                    <legend>{vi ? 'Mức độ hài lòng' : 'Your rating'} <span>*</span></legend>
                    <div className="participant-rating-picker" role="radiogroup">
                      {[1, 2, 3, 4, 5].map(value => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={score === value}
                          aria-label={`${value} ${vi ? 'sao' : 'stars'}`}
                          className={value <= score ? 'is-selected' : ''}
                          onClick={() => setScore(value)}
                        >
                          <Star size={30} fill={value <= score ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                      <strong>{score}/5</strong>
                    </div>

                    <label htmlFor="activity-rating-comment">
                      {vi ? 'Bình luận' : 'Comment'} <small>{vi ? '(không bắt buộc)' : '(optional)'}</small>
                    </label>
                    <textarea
                      id="activity-rating-comment"
                      value={comment}
                      maxLength={1000}
                      rows={5}
                      placeholder={vi ? 'Chia sẻ điều bạn thích hoặc góp ý cho hoạt động...' : 'Share what worked well or what could improve...'}
                      onChange={event => setComment(event.target.value)}
                    />
                    <span className="participant-rating-character-count">{comment.length}/1000</span>
                  </fieldset>
                </>
              )}

              <footer>
                <button type="button" className="btn-part-secondary" onClick={closeModal} disabled={isSubmitting}>
                  {vi ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn-part-primary" disabled={isLoadingRating || isSubmitting || ratingLoadFailed}>
                  <Send size={16} />
                  {isSubmitting ? (vi ? 'Đang lưu...' : 'Saving...') : (vi ? 'Lưu đánh giá' : 'Save rating')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
