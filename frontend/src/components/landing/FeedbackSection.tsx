import { AlertCircle, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { publicApi } from '../../services/publicApi';
import { EventItem, Language } from '../../types';
import './FeedbackSection.css';

interface FeedbackSectionProps {
  language: Language;
  events: EventItem[];
}

interface FeedbackFieldErrors {
  contactEmail?: string;
  message?: string;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({ language, events }) => {
  const [target, setTarget] = useState('BOOK_STREET');
  const [guestName, setGuestName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submissionState, setSubmissionState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FeedbackFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);

  const isVi = language === 'vi';
  const selectedEvent = events.find(event => event.id === target);

  const emailValidationMessage = isVi
    ? 'Email liên hệ không đúng định dạng.'
    : 'Please enter a valid contact email.';
  const messageValidationMessage = isVi
    ? 'Nội dung góp ý phải có từ 10 đến 2.000 ký tự.'
    : 'Feedback content must contain between 10 and 2,000 characters.';

  const validateContactEmail = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return true;
    const length = Array.from(normalized).length;
    return length >= 3 && length <= 255 && /^[^\s@]+@[^\s@]+$/u.test(normalized);
  };

  const validateMessage = (value: string) => {
    const length = Array.from(value.trim()).length;
    return length >= 10 && length <= 2000;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionInFlight.current) return;

    const nextErrors: FeedbackFieldErrors = {};
    if (!validateContactEmail(contactEmail)) nextErrors.contactEmail = emailValidationMessage;
    if (!validateMessage(message)) nextErrors.message = messageValidationMessage;
    if (nextErrors.contactEmail || nextErrors.message) {
      setFieldErrors(nextErrors);
      return;
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    setErrorMessage('');
    setFieldErrors({});
    try {
      await publicApi.submitFeedback({
        targetType: target === 'BOOK_STREET' ? 'BOOK_STREET' : 'EVENT',
        eventId: target === 'BOOK_STREET' ? undefined : Number(target),
        guestName: guestName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        message,
      });
      setSubmissionState('success');
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (apiError?.code === 'VALIDATION_FAILED') {
        const nextErrors: FeedbackFieldErrors = {};
        for (const fieldError of apiError.fieldErrors) {
          if (fieldError.field === 'contactEmail') nextErrors.contactEmail = emailValidationMessage;
          if (fieldError.field === 'message') nextErrors.message = messageValidationMessage;
        }
        if (nextErrors.contactEmail || nextErrors.message) {
          setFieldErrors(nextErrors);
          setSubmissionState('idle');
          return;
        }
        setErrorMessage(apiError.fieldErrors.map(item => item.message).join(' '));
      } else if (apiError?.code === 'EVENT_NOT_FOUND') {
        setErrorMessage(isVi
          ? 'Sự kiện này không còn khả dụng. Vui lòng chọn lại phạm vi góp ý.'
          : 'This event is no longer available. Please choose another feedback scope.');
      } else if (apiError?.code === 'FEEDBACK_RATE_LIMITED') {
        setErrorMessage(isVi
          ? 'Bạn đã gửi quá nhiều góp ý. Vui lòng thử lại sau.'
          : 'You have submitted too many feedback attempts. Please try again later.');
      } else if (apiError?.code === 'FEEDBACK_THROTTLE_UNAVAILABLE') {
        setErrorMessage(isVi
          ? 'Hệ thống tiếp nhận góp ý đang tạm bận. Vui lòng thử lại sau.'
          : 'The feedback service is temporarily unavailable. Please try again later.');
      } else if (apiError?.code === 'CSRF_INVALID') {
        setErrorMessage(isVi
          ? 'Phiên gửi biểu mẫu đã hết hạn. Vui lòng tải lại trang và thử lại.'
          : 'The form session has expired. Please reload the page and try again.');
      } else if (apiError?.code === 'NETWORK_ERROR' || apiError?.status === 0) {
        setErrorMessage(isVi
          ? 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
          : 'The server could not be reached. Please check your network connection and retry.');
      } else if (apiError?.code === 'INTERNAL_ERROR' || (apiError && apiError.status >= 500)) {
        setErrorMessage(isVi
          ? 'Máy chủ đang gặp sự cố khi tiếp nhận góp ý. Vui lòng thử lại sau.'
          : 'The server encountered a problem while receiving feedback. Please try again later.');
      } else {
        setErrorMessage(isVi
          ? 'Không thể xử lý phản hồi từ máy chủ. Vui lòng thử lại.'
          : 'The server response could not be processed. Please try again.');
      }
      setSubmissionState('error');
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmissionState('idle');
    setErrorMessage('');
    setFieldErrors({});
    setMessage('');
  };

  const feedbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#gop-y`
    : 'https://duongsach.tphcm.gov.vn/#gop-y';

  return (
    <section className="sk05-feedback-section" id="gop-y">
      <div className="sk05-feedback-screen-wrapper">
        <div className="sk05-feedback-board">
          <div className="sk05-top-header">
            <div className="sk05-header-title-wrap">
              <span className="sk05-tag-code">GÓP Ý</span>
              <h2 className="sk05-main-title">{isVi ? 'GÓP Ý TRẢI NGHIỆM' : 'VISITOR FEEDBACK'}</h2>
            </div>
            <span className="sk05-header-badge">
              {isVi ? 'ĐƯỜNG SÁCH TP.HCM (NGUYỄN VĂN BÌNH)' : 'HCMC BOOK STREET (NGUYEN VAN BINH)'}
            </span>
          </div>

          <div className="sk05-board-body">
            <aside className="sk05-left-col">
              <div className="sk05-qr-box">
                <div className="sk05-qr-tag">[QR FEEDBACK]</div>
                <h3 className="sk05-qr-heading">{isVi ? 'Dùng chung toàn Đường Sách' : 'One QR for Book Street'}</h3>
                <div className="sk05-qr-visual">
                  <div className="sk05-qr-code-frame">
                    <QRCodeSVG value={feedbackUrl} size={140} level="H" includeMargin={false} fgColor="#152B24" bgColor="#FFFFFF" />
                  </div>
                  <span className="sk05-qr-hint">
                    <QrCode size={13} />
                    <span>{isVi ? 'Quét mã QR để mở form trên di động' : 'Scan to open this form on mobile'}</span>
                  </span>
                </div>
              </div>

              <div className="sk05-qr-info-box">
                <div className="sk05-qr-count-badge">01 QR chung</div>
                <p className="sk05-qr-note">
                  {isVi
                    ? 'Bạn có thể góp ý chung cho toàn Đường Sách hoặc chọn một sự kiện đang công khai.'
                    : 'Send general Book Street feedback or choose a currently public event.'}
                </p>
              </div>
            </aside>

            <main className="sk05-right-col">
              <div className="sk05-form-header-row">
                <h3 className="sk05-form-heading">{isVi ? 'GÓP Ý TRẢI NGHIỆM' : 'EXPERIENCE FEEDBACK'}</h3>
                <span className="sk05-form-subtext">
                  {isVi ? 'Lắng nghe ý kiến xây dựng không gian văn hóa' : 'Listening to your community voice'}
                </span>
              </div>

              {submissionState === 'idle' && (
                <form onSubmit={handleSubmit} className="sk05-feedback-form" noValidate>
                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-target-select">{isVi ? 'Phạm vi góp ý:' : 'Feedback scope:'}</label>
                    <div className="sk05-select-wrapper">
                      <select id="feedback-target-select" value={target} onChange={event => setTarget(event.target.value)} className="sk05-select-input">
                        <option value="BOOK_STREET">{isVi ? 'Toàn Đường Sách TP.HCM' : 'Entire HCMC Book Street'}</option>
                        {events.length > 0 && (
                          <optgroup label={isVi ? 'Sự kiện công khai' : 'Public events'}>
                            {events.map(event => (
                              <option key={event.id} value={event.id}>{isVi ? event.title : event.titleEn || event.title}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-guest-name">{isVi ? 'Tên của bạn (Không bắt buộc):' : 'Your name (Optional):'}</label>
                    <input id="feedback-guest-name" type="text" maxLength={100} value={guestName} onChange={event => setGuestName(event.target.value)} placeholder={isVi ? 'Tên người gửi góp ý' : 'Feedback sender name'} className="sk05-text-input" />
                  </div>

                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-contact-email">{isVi ? 'Email liên hệ (Không bắt buộc):' : 'Contact email (Optional):'}</label>
                    <input
                      id="feedback-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={event => {
                        setContactEmail(event.target.value);
                        if (fieldErrors.contactEmail) {
                          setFieldErrors(previous => ({ ...previous, contactEmail: undefined }));
                        }
                      }}
                      onBlur={event => {
                        const isValid = validateContactEmail(event.currentTarget.value);
                        setFieldErrors(previous => ({
                          ...previous,
                          contactEmail: isValid ? undefined : emailValidationMessage,
                        }));
                      }}
                      placeholder={isVi ? 'vidu@email.com' : 'example@email.com'}
                      className={`sk05-text-input ${fieldErrors.contactEmail ? 'sk05-input-error' : ''}`}
                      aria-invalid={Boolean(fieldErrors.contactEmail)}
                      aria-describedby={fieldErrors.contactEmail ? 'feedback-contact-email-error' : undefined}
                    />
                    {fieldErrors.contactEmail && (
                      <p className="sk05-field-error" id="feedback-contact-email-error" role="alert">
                        <AlertCircle size={15} aria-hidden="true" />
                        {fieldErrors.contactEmail}
                      </p>
                    )}
                  </div>

                  <div className="sk05-field-row">
                    <label className="sk05-field-label" htmlFor="feedback-message">{isVi ? 'Nội dung góp ý (*):' : 'Feedback content (*):'}</label>
                    <textarea
                      id="feedback-message"
                      rows={5}
                      required
                      minLength={10}
                      maxLength={2000}
                      value={message}
                      onChange={event => {
                        setMessage(event.target.value);
                        if (fieldErrors.message) {
                          setFieldErrors(previous => ({ ...previous, message: undefined }));
                        }
                      }}
                      onBlur={event => {
                        const isValid = validateMessage(event.currentTarget.value);
                        setFieldErrors(previous => ({
                          ...previous,
                          message: isValid ? undefined : messageValidationMessage,
                        }));
                      }}
                      placeholder={isVi ? 'Chia sẻ góp ý của bạn về trải nghiệm tại Đường Sách...' : 'Share your feedback about your Book Street experience...'}
                      className={`sk05-textarea-input ${fieldErrors.message ? 'sk05-input-error' : ''}`}
                      aria-invalid={Boolean(fieldErrors.message)}
                      aria-describedby={fieldErrors.message ? 'feedback-message-error' : undefined}
                    />
                    {fieldErrors.message && (
                      <p className="sk05-field-error" id="feedback-message-error" role="alert">
                        <AlertCircle size={15} aria-hidden="true" />
                        {fieldErrors.message}
                      </p>
                    )}
                  </div>

                  <div className="sk05-action-row">
                    <button type="submit" disabled={isSubmitting} className="sk05-submit-btn">
                      <span>{isSubmitting ? (isVi ? 'Đang gửi...' : 'Sending...') : (isVi ? 'Gửi góp ý' : 'Submit feedback')}</span>
                    </button>
                  </div>
                </form>
              )}

              {submissionState === 'success' && (
                <div className="sk05-result-state sk05-result-success">
                  <div className="sk05-result-icon"><CheckCircle2 size={44} color="#1E7B48" /></div>
                  <div className="sk05-result-content">
                    <h4 className="sk05-result-title">{isVi ? 'Gửi góp ý thành công!' : 'Feedback submitted successfully!'}</h4>
                    <p className="sk05-result-desc">{isVi ? 'Cảm ơn bạn. Ban Quản lý Đường Sách TP.HCM đã ghi nhận góp ý này.' : 'Thank you. The HCMC Book Street Management Board has received your feedback.'}</p>
                    <div className="sk05-result-summary">
                      <span><strong>{isVi ? 'Phạm vi:' : 'Scope:'}</strong>{' '}{selectedEvent ? (isVi ? selectedEvent.title : selectedEvent.titleEn || selectedEvent.title) : (isVi ? 'Toàn Đường Sách' : 'Book Street')}</span>
                    </div>
                    <button type="button" className="sk05-btn-reset" onClick={resetForm}>
                      <RefreshCw size={14} /><span>{isVi ? 'Gửi thêm góp ý khác' : 'Submit another feedback'}</span>
                    </button>
                  </div>
                </div>
              )}

              {submissionState === 'error' && (
                <div className="sk05-result-state sk05-result-error" role="alert">
                  <div className="sk05-result-icon"><AlertCircle size={44} color="#C84C32" /></div>
                  <div className="sk05-result-content">
                    <h4 className="sk05-result-title error-title">{isVi ? 'Chưa gửi được góp ý' : 'Feedback was not submitted'}</h4>
                    <p className="sk05-result-desc">{errorMessage}</p>
                    <div className="sk05-error-actions">
                      <button type="button" className="sk05-submit-btn sk05-btn-retry" onClick={() => setSubmissionState('idle')}>
                        <RefreshCw size={14} /><span>{isVi ? 'Quay lại và thử lại' : 'Return and retry'}</span>
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
