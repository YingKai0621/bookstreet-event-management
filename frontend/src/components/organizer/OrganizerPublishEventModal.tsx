import { AlertTriangle, CheckCircle2, Send, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import type { ApiFieldError } from '../../services/apiError';
import type { Language } from '../../types';
import type { OrganizerEvent } from '../../types/organizer';

export interface EventPublishFailure {
  message: string;
  fieldErrors: ApiFieldError[];
}

interface PublishIssue {
  field: string;
  message: string;
}

interface OrganizerPublishEventModalProps {
  language: Language;
  event: OrganizerEvent | null;
  isPublishing: boolean;
  failure: EventPublishFailure | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onEdit: (event: OrganizerEvent) => void;
}

const FIELD_LABELS: Record<string, { vi: string; en: string }> = {
  name: { vi: 'Tên sự kiện', en: 'Event name' },
  startAt: { vi: 'Thời gian bắt đầu', en: 'Start time' },
  endAt: { vi: 'Thời gian kết thúc', en: 'End time' },
  partnerApplicationDeadlineAt: { vi: 'Hạn đối tác đăng ký', en: 'Partner application deadline' },
  boothRequestDeadlineAt: { vi: 'Hạn yêu cầu gian hàng', en: 'Booth request deadline' },
  activityProposalDeadlineAt: { vi: 'Hạn đề xuất hoạt động', en: 'Activity proposal deadline' },
  participantRegistrationDeadlineAt: { vi: 'Hạn người tham gia đăng ký', en: 'Participant registration deadline' },
  boothPaymentWindowMinutes: { vi: 'Thời hạn giữ chỗ gian hàng', en: 'Booth payment window' },
  maxBoothsPerPartner: { vi: 'Số gian hàng tối đa / đối tác', en: 'Maximum booths per partner' },
  maxActivitiesPerPartner: { vi: 'Số hoạt động tối đa / đối tác', en: 'Maximum activities per partner' },
};

type DeadlineField = keyof Pick<
  OrganizerEvent,
  | 'partnerApplicationDeadlineAt'
  | 'boothRequestDeadlineAt'
  | 'activityProposalDeadlineAt'
  | 'participantRegistrationDeadlineAt'
>;

const DAY_MS = 24 * 60 * 60 * 1000;

function fieldLabel(field: string, language: Language): string {
  const label = FIELD_LABELS[field];
  return label ? label[language === 'vi' ? 'vi' : 'en'] : field;
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Fast client-side preflight for obvious publication problems. The backend
 * remains authoritative because its clock and validation rules decide whether
 * the event can actually be published.
 */
function getEventPublishIssues(
  event: OrganizerEvent,
  language: Language,
  now = Date.now(),
): PublishIssue[] {
  const vi = language === 'vi';
  const issues = new Map<string, string>();
  const add = (field: string, message: string) => {
    if (!issues.has(field)) issues.set(field, message);
  };

  if (event.apiStatus !== 'DRAFT') {
    add('status', vi ? 'Sự kiện không còn ở trạng thái Bản nháp.' : 'The event is no longer a draft.');
  }
  if (!event.title.trim()) add('name', vi ? 'Chưa có tên sự kiện.' : 'Event name is missing.');
  else if (Array.from(event.title.trim()).length > 150) add('name', vi ? 'Tên sự kiện vượt quá 150 ký tự.' : 'Event name exceeds 150 characters.');

  const start = timestamp(event.startDate);
  const end = timestamp(event.endDate);
  if (start === null) add('startAt', vi ? 'Thời gian bắt đầu chưa hợp lệ.' : 'Start time is invalid.');
  else if (start <= now) add('startAt', vi ? 'Thời gian bắt đầu phải ở tương lai.' : 'Start time must be in the future.');
  if (end === null) add('endAt', vi ? 'Thời gian kết thúc chưa hợp lệ.' : 'End time is invalid.');
  else if (start !== null && end <= start) add('endAt', vi ? 'Thời gian kết thúc phải sau thời gian bắt đầu.' : 'End time must be after start time.');

  const boothsEnabled = Number.isInteger(event.maxBoothsPerPartner)
    && event.maxBoothsPerPartner > 0;
  const activitiesEnabled = Number.isInteger(event.maxActivitiesPerPartner)
    && event.maxActivitiesPerPartner > 0;
  const deadlineFields: DeadlineField[] = [
    'partnerApplicationDeadlineAt',
    'participantRegistrationDeadlineAt',
  ];
  if (boothsEnabled) deadlineFields.push('boothRequestDeadlineAt');
  if (activitiesEnabled) deadlineFields.push('activityProposalDeadlineAt');

  const deadlineTimes = new Map<DeadlineField, number>();
  deadlineFields.forEach(field => {
    const value = event[field];
    const parsed = timestamp(value);
    if (!value) {
      add(field, vi ? `${fieldLabel(field, language)} chưa được thiết lập.` : `${fieldLabel(field, language)} is missing.`);
    } else if (parsed === null) {
      add(field, vi ? `${fieldLabel(field, language)} chưa hợp lệ.` : `${fieldLabel(field, language)} is invalid.`);
    } else {
      deadlineTimes.set(field, parsed);
      if (parsed <= now) add(field, vi ? `${fieldLabel(field, language)} phải ở tương lai.` : `${fieldLabel(field, language)} must be in the future.`);
      else if (start !== null && parsed > start) add(field, vi ? `${fieldLabel(field, language)} không được sau thời gian bắt đầu.` : `${fieldLabel(field, language)} must not be after the start time.`);
    }
  });

  const partnerDeadline = deadlineTimes.get('partnerApplicationDeadlineAt');
  const boothDeadline = deadlineTimes.get('boothRequestDeadlineAt');
  const activityDeadline = deadlineTimes.get('activityProposalDeadlineAt');
  const participantDeadline = deadlineTimes.get('participantRegistrationDeadlineAt');
  if (partnerDeadline !== undefined && boothDeadline !== undefined
      && boothDeadline < partnerDeadline + DAY_MS) {
    add('boothRequestDeadlineAt', vi
      ? 'Hạn yêu cầu gian hàng phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức duyệt hồ sơ.'
      : 'The Booth request deadline must be at least 24 hours after the partner application deadline.');
  }
  if (partnerDeadline !== undefined && activityDeadline !== undefined
      && activityDeadline < partnerDeadline + DAY_MS) {
    add('activityProposalDeadlineAt', vi
      ? 'Hạn đề xuất hoạt động phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức duyệt hồ sơ.'
      : 'The Activity proposal deadline must be at least 24 hours after the partner application deadline.');
  }
  if (participantDeadline !== undefined && start !== null && participantDeadline >= start) {
    add('participantRegistrationDeadlineAt', vi ? 'Hạn người tham gia đăng ký phải trước thời gian bắt đầu sự kiện.' : 'Participant registration deadline must be before the event start time.');
  }

  if (boothsEnabled && (!Number.isFinite(event.boothPaymentWindowMinutes)
      || event.boothPaymentWindowMinutes < 60 || event.boothPaymentWindowMinutes > 10080)) {
    add('boothPaymentWindowMinutes', vi ? 'Thời hạn giữ chỗ phải từ 1 giờ đến 7 ngày.' : 'Booth payment window must be between 1 hour and 7 days.');
  } else if (boothsEnabled && boothDeadline !== undefined && start !== null
      && boothDeadline + event.boothPaymentWindowMinutes * 60_000 + DAY_MS > start) {
    add('boothPaymentWindowMinutes', vi
      ? 'Hạn yêu cầu gian hàng cộng thời gian thanh toán phải kết thúc trước sự kiện ít nhất 24 giờ để chuẩn bị gian hàng.'
      : 'The Booth request deadline plus payment window must end at least 24 hours before the Event for setup.');
  }
  if (!Number.isFinite(event.maxBoothsPerPartner) || event.maxBoothsPerPartner < 0) {
    add('maxBoothsPerPartner', vi ? 'Giới hạn gian hàng không được là số âm.' : 'Booth limit cannot be negative.');
  }
  if (!Number.isFinite(event.maxActivitiesPerPartner) || event.maxActivitiesPerPartner < 0) {
    add('maxActivitiesPerPartner', vi ? 'Giới hạn hoạt động không được là số âm.' : 'Activity limit cannot be negative.');
  }

  return [...issues].map(([field, message]) => ({ field, message }));
}

export const OrganizerPublishEventModal: React.FC<OrganizerPublishEventModalProps> = ({
  language,
  event,
  isPublishing,
  failure,
  onClose,
  onConfirm,
  onEdit,
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const issues = useMemo(
    () => event ? getEventPublishIssues(event, language) : [],
    [event, language],
  );
  const cannotPublish = issues.length > 0;
  const vi = language === 'vi';
  useModalDismiss(Boolean(event), () => { if (!isPublishing) onClose(); });
  const backdropHandlers = useBackdropClick(() => { if (!isPublishing) onClose(); });

  useEffect(() => {
    if (event) titleRef.current?.focus({ preventScroll: true });
  }, [event, failure]);

  if (!event) return null;

  const backendIssues = failure?.fieldErrors.map(item => ({
    field: item.field,
    message: `${fieldLabel(item.field, language)}: ${item.message}`,
  })) ?? [];
  const displayedIssues = failure ? backendIssues : issues;
  const hasBlockingState = cannotPublish || Boolean(failure);
  const title = hasBlockingState
    ? (vi ? 'Chưa thể công bố' : 'Unable to publish')
    : (vi ? 'Công bố sự kiện' : 'Publish event');

  return createPortal(
    <div className="org-modal-backdrop" {...backdropHandlers}>
      <section
        className="org-modal-box org-publish-event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-publish-event-title"
        aria-describedby="organizer-publish-event-description"
        onClick={clickEvent => clickEvent.stopPropagation()}
      >
        <header className="org-modal-header org-publish-event-header">
          <div className={`org-publish-event-heading-icon ${hasBlockingState ? 'is-warning' : ''}`} aria-hidden="true">
            {hasBlockingState ? <AlertTriangle size={21} /> : <Send size={20} />}
          </div>
          <div className="org-publish-event-heading-copy">
            <h3 id="organizer-publish-event-title" ref={titleRef} tabIndex={-1}>{title}</h3>
            <p id="organizer-publish-event-description">{event.title}</p>
          </div>
          <button type="button" className="organizer-icon-button" onClick={onClose} disabled={isPublishing} aria-label={vi ? 'Đóng' : 'Close'}><X size={20} /></button>
        </header>

        <div className="org-modal-body org-publish-event-body">
          {hasBlockingState ? (
            <>
              <p className="org-publish-event-lead" role={failure ? 'alert' : undefined}>
                {failure?.message || (vi
                  ? `Còn ${displayedIssues.length} thông tin cần sửa trước khi công bố.`
                  : `${displayedIssues.length} items must be fixed before publishing.`)}
              </p>
              {displayedIssues.length > 0 && (
                <ul className="org-publish-event-issues">
                  {displayedIssues.map(issue => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
                </ul>
              )}
            </>
          ) : (
            <div className="org-publish-event-confirmation">
              <CheckCircle2 size={22} aria-hidden="true" />
              <div>
                <strong>{vi ? 'Thông tin bắt buộc đã đầy đủ.' : 'Required information is complete.'}</strong>
                <p>{vi
                  ? 'Sau khi công bố, sự kiện sẽ chuyển sang trạng thái Đã công bố và bắt đầu áp dụng các mốc thời hạn đã cấu hình.'
                  : 'Publishing changes the event status to Published and activates its configured deadlines.'}</p>
              </div>
            </div>
          )}
        </div>

        <footer className="org-modal-footer org-publish-event-footer">
          <button type="button" className="btn-org-secondary" onClick={onClose} disabled={isPublishing}>{vi ? 'Hủy' : 'Cancel'}</button>
          {hasBlockingState ? (
            <button type="button" className="btn-org-primary" onClick={() => onEdit(event)}>
              {vi ? 'Chỉnh sửa bản nháp' : 'Edit draft'}
            </button>
          ) : (
            <button type="button" className="btn-org-gold" onClick={() => void onConfirm()} disabled={isPublishing} aria-busy={isPublishing}>
              <Send size={16} />{isPublishing ? (vi ? 'Đang công bố...' : 'Publishing...') : (vi ? 'Công bố' : 'Publish')}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
};
