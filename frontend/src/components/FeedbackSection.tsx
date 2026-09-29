import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Star, CheckCircle2, QrCode, RefreshCw, AlertCircle } from 'lucide-react';
import { ExtendedHeritageProfile, Language } from '../types';
import { publicApi } from '../services/publicApi';
import './FeedbackSection.css';

interface FeedbackSectionProps {
  language: Language;
  onScrollToTop: () => void;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  language,
}) => {
  const [targetType, setTargetType] = useState<string>('all');
  const [rating, setRating] = useState<number>(5);
  const [comments, setComments] = useState('');
  const [contact, setContact] = useState('');
  const [submissionState, setSubmissionState] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heritages, setHeritages] = useState<ExtendedHeritageProfile[]>([]);

  useEffect(() => {
    publicApi.getHeritages().then(items => setHeritages(items as ExtendedHeritageProfile[])).catch(() => setHeritages([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim()) return;
    setIsSubmitting(true);
    try {
      await publicApi.submitFeedback({
        rating,
        comments,
        contactEmail: contact || undefined,
        targetName: targetType === 'all' ? 'Toàn Đường Sách' : targetType,
        source: 'web_landing',
      });
      setSubmissionState('success');
    } catch (err) {
      console.warn('Feedback API submit error', err);
      setSubmissionState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/#gop-y` : 'https://duongsach.tphcm.gov.vn/#gop-y';

  return (
    <section className="sk05-feedback-section" id="gop-y">
      <div className="sk05-feedback-screen-wrapper">
        <div className="sk05-feedback-board">
          {/* Header Bar: SK05 FEEDBACK DÙNG CHUNG */}
          <div className="sk05-top-header">
            <div className="sk05-header-title-wrap">
              <span className="sk05-tag-code">GÓP Ý</span>
              <h2 className="sk05-main-title">
                {language === 'vi' ? 'FEEDBACK TRẢI NGHIỆM' : 'VISITOR FEEDBACK'}
              </h2>
            </div>
            <span className="sk05-header-badge">
              {language === 'vi' ? 'ĐƯỜNG SÁCH TP.HCM (NGUYỄN VĂN BÌNH)' : 'HCMC BOOK STREET (NGUYEN VAN BINH)'}
            </span>
          </div>

          {/* Body: 2-Column Table Grid matching wireframe */}
          <div className="sk05-board-body">
            {/* Left Column: QR Code & Common Description */}
            <aside className="sk05-left-col">
              <div className="sk05-qr-box">
                <div className="sk05-qr-tag">[QR FEEDBACK]</div>
                <h3 className="sk05-qr-heading">
                  {language === 'vi' ? 'Dùng chung toàn Đường Sách' : 'Universal for All Street'}
                </h3>
                <div className="sk05-qr-visual">
                  <div className="sk05-qr-code-frame">
                    <QRCodeSVG
                      value={feedbackUrl}
                      size={140}
                      level="H"
                      includeMargin={false}
                      fgColor="#152B24"
                      bgColor="#FFFFFF"
                    />
                  </div>
                  <span className="sk05-qr-hint">
                    <QrCode size={13} />
                    <span>Quét mã QR để mở form trên di động</span>
                  </span>
                </div>
              </div>

              <div className="sk05-qr-info-box">
                <div className="sk05-qr-count-badge">01 QR chung</div>
                <p className="sk05-qr-note">
                  {language === 'vi'
                    ? 'Không tự nhận biết di sản khách vừa tham quan. Khách có thể tùy chọn di sản hoặc đóng góp chung toàn tuyến phố.'
                    : 'Universal QR code for the entire street. Visitors can choose a specific heritage site or evaluate the general promenade.'}
                </p>
              </div>
            </aside>

            {/* Right Column: Form fields */}
            <main className="sk05-right-col">
              <div className="sk05-form-header-row">
                <h3 className="sk05-form-heading">
                  {language === 'vi' ? 'GÓP Ý TRẢI NGHIỆM' : 'EXPERIENCE FEEDBACK'}
                </h3>
                <span className="sk05-form-subtext">
                  {language === 'vi' ? 'Lắng nghe ý kiến xây dựng không gian văn hóa' : 'Listening to your community voice'}
                </span>
              </div>

              {submissionState === 'idle' && (
                <form onSubmit={handleSubmit} className="sk05-feedback-form">
                  {/* Row 1: Target Selector */}
                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-target-select">
                      {language === 'vi' ? 'Phạm vi đánh giá:' : 'Evaluation scope:'}
                    </label>
                    <div className="sk05-select-wrapper">
                      <select
                        id="feedback-target-select"
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value)}
                        className="sk05-select-input"
                      >
                        <option value="all">
                          {language === 'vi' ? 'Toàn Đường Sách TP.HCM (Chung)' : 'Entire HCMC Book Street (General)'}
                        </option>
                        <optgroup label={language === 'vi' ? 'Chọn Di sản cụ thể' : 'Select Heritage Site'}>
                          {heritages.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.code} — {language === 'vi' ? h.name : h.nameEn}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Hài lòng 1 2 3 4 5 */}
                  <div className="sk05-field-row">
                    <label className="sk05-field-label">
                      {language === 'vi' ? 'Hài lòng:' : 'Satisfaction:'}
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
                    <div className="sk05-rating-options">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          className={`sk05-rating-num-btn ${rating === val ? 'active' : ''} ${rating >= val ? 'highlight' : ''}`}
                          onClick={() => setRating(val)}
                          aria-label={`Rating ${val}`}
                        >
                          <span className="num-digit">{val}</span>
                          <Star size={13} className="num-star" />
                        </button>
                      ))}
                      <span className="sk05-rating-caption">
                        {rating === 5 && (language === 'vi' ? 'Rất hài lòng ★★★★★' : 'Very satisfied ★★★★★')}
                        {rating === 4 && (language === 'vi' ? 'Hài lòng ★★★★' : 'Satisfied ★★★★')}
                        {rating === 3 && (language === 'vi' ? 'Bình thường ★★★' : 'Neutral ★★★')}
                        {rating === 2 && (language === 'vi' ? 'Chưa hài lòng ★★' : 'Unsatisfied ★★')}
                        {rating === 1 && (language === 'vi' ? 'Cần cải thiện ★' : 'Needs improvement ★')}
                      </span>
                      <span className="sk05-rating-caption sk05-rating-caption-legacy">
                        {rating === 5 && (language === 'vi' ? 'Rất hài lòng ★★★★★' : 'Very Satisfied')}
                        {rating === 4 && (language === 'vi' ? 'Hài lòng ★★★★' : 'Satisfied')}
                        {rating === 3 && (language === 'vi' ? 'Bình thường ★★★' : 'Neutral')}
                        {rating === 2 && (language === 'vi' ? 'Chưa hài lòng ★★' : 'Unsatisfied')}
                        {rating === 1 && (language === 'vi' ? 'Cần cải thiện ★' : 'Poor')}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Nội dung góp ý... */}
                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-comment-textarea">
                      {language === 'vi' ? 'Nội dung góp ý (*):' : 'Feedback content (*):'}
                    </label>
                    <textarea
                      id="feedback-comment-textarea"
                      rows={4}
                      required
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder={
                        language === 'vi'
                          ? 'Nội dung góp ý về trải nghiệm, thái độ phục vụ, không gian, vệ sinh, sách...'
                          : 'Your constructive comments on experience, services, facilities, cleanliness...'
                      }
                      className="sk05-textarea-input"
                    ></textarea>
                  </div>

                  {/* Row 4: Liên hệ: không bắt buộc */}
                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-contact-input">
                      {language === 'vi' ? 'Liên hệ (Không bắt buộc):' : 'Contact (Optional):'}
                    </label>
                    <input
                      id="feedback-contact-input"
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder={
                        language === 'vi'
                          ? 'Số điện thoại hoặc Email để Ban Quản Lý phản hồi'
                          : 'Phone number or Email for follow-up'
                      }
                      className="sk05-text-input"
                    />
                  </div>

                  {/* Row 5: Action Submit Button */}
                  <div className="sk05-action-row">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="sk05-submit-btn"
                    >
                      <span>{isSubmitting ? (language === 'vi' ? 'Đang gửi...' : 'Sending...') : (language === 'vi' ? '[Gửi góp ý]' : '[Submit Feedback]')}</span>
                    </button>

                  </div>
                </form>
              )}

              {/* Success Result State */}
              {submissionState === 'success' && (
                <div className="sk05-result-state sk05-result-success">
                  <div className="sk05-result-icon">
                    <CheckCircle2 size={44} color="#1E7B48" />
                  </div>
                  <div className="sk05-result-content">
                    <h4 className="sk05-result-title">
                      {language === 'vi' ? 'Gửi góp ý thành công!' : 'Feedback Submitted Successfully!'}
                    </h4>
                    <p className="sk05-result-desc">
                      {language === 'vi'
                        ? 'Cảm ơn bạn đã gửi ý kiến đóng góp. Ban Quản Lý Đường Sách TP.HCM trân trọng ghi nhận để tiếp tục nâng cấp chất lượng.'
                        : 'Thank you for your valuable input. The Management Board of HCMC Book Street has received your response.'}
                    </p>
                    <div className="sk05-result-summary">
                      <span><strong>Phạm vi:</strong> {targetType === 'all' ? 'Toàn Đường Sách' : targetType}</span>
                      <span><strong>Đánh giá:</strong> {rating}/5 sao</span>
                    </div>
                    <button
                      type="button"
                      className="sk05-btn-reset"
                      onClick={() => {
                        setSubmissionState('idle');
                        setComments('');
                      }}
                    >
                      <RefreshCw size={14} />
                      <span>{language === 'vi' ? 'Gửi thêm góp ý khác' : 'Submit Another Feedback'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Result State */}
              {submissionState === 'error' && (
                <div className="sk05-result-state sk05-result-error">
                  <div className="sk05-result-icon">
                    <AlertCircle size={44} color="#C84C32" />
                  </div>
                  <div className="sk05-result-content">
                    <h4 className="sk05-result-title error-title">
                      {language === 'vi' ? 'Báo lỗi — Vui lòng thử lại' : 'Submission Failed — Please Retry'}
                    </h4>
                    <p className="sk05-result-desc">
                      {language === 'vi'
                        ? 'Kết nối mạng tạm thời gián đoạn hoặc máy chủ phản hồi chậm. Vui lòng kiểm tra lại đường truyền và gửi lại.'
                        : 'Network issue or temporary server delay. Please check your connection and try again.'}
                    </p>
                    <div className="sk05-error-actions">
                      <button
                        type="button"
                        className="sk05-submit-btn sk05-btn-retry"
                        onClick={() => {
                          setSubmissionState('idle');
                        }}
                      >
                        <RefreshCw size={14} />
                        <span>{language === 'vi' ? 'Thử lại ngay' : 'Retry Now'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </section>
  );
};

