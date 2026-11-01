import { AlertCircle, Check, ChevronDown, Crop, Image as ImageIcon, X } from 'lucide-react';
import { EventImageCropModal } from './EventImageCropModal';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { ApiError } from '../../services/apiClient';
import { organizerApi } from '../../services/organizerApi';
import { Language } from '../../types';
import { OrganizerEvent, OrganizerEventRequest } from '../../types/organizer';

interface OrganizerCreateEventModalProps {
  language: Language;
  isOpen: boolean;
  event?: OrganizerEvent | null;
  onClose: () => void;
  onSave: (request: OrganizerEventRequest, eventId?: string) => Promise<void>;
}

interface EventFormState {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  partnerApplicationDeadlineAt: string;
  boothRequestDeadlineAt: string;
  activityProposalDeadlineAt: string;
  participantRegistrationDeadlineAt: string;
  partnerWithdrawalCutoffAt: string;
  boothCancellationCutoffAt: string;
  activityCancellationCutoffAt: string;
  boothPaymentWindowValue: string;
  boothPaymentWindowUnit: 'HOURS' | 'DAYS';
  maxBoothsPerPartner: string;
  maxActivitiesPerPartner: string;
  bannerUrl: string;
}

type FormField = keyof EventFormState;

interface ValidationIssue {
  field: FormField;
  message: string;
}

const EMPTY_FORM: EventFormState = {
  name: '',
  description: '',
  startAt: '',
  endAt: '',
  partnerApplicationDeadlineAt: '',
  boothRequestDeadlineAt: '',
  activityProposalDeadlineAt: '',
  participantRegistrationDeadlineAt: '',
  partnerWithdrawalCutoffAt: '',
  boothCancellationCutoffAt: '',
  activityCancellationCutoffAt: '',
  boothPaymentWindowValue: '24',
  boothPaymentWindowUnit: 'HOURS',
  maxBoothsPerPartner: '1',
  maxActivitiesPerPartner: '1',
  bannerUrl: '',
};
const DATE_FIELDS: Array<{ key: FormField; vi: string; en: string }> = [
  { key: 'partnerApplicationDeadlineAt', vi: 'Hạn đối tác đăng ký', en: 'Partner application deadline' },
  { key: 'boothRequestDeadlineAt', vi: 'Hạn yêu cầu gian hàng', en: 'Booth request deadline' },
  { key: 'partnerWithdrawalCutoffAt', vi: 'Hạn đối tác rút hồ sơ', en: 'Partner withdrawal cutoff' },
  { key: 'boothCancellationCutoffAt', vi: 'Hạn hủy gian hàng', en: 'Booth cancellation cutoff' },
  { key: 'activityProposalDeadlineAt', vi: 'Hạn đề xuất hoạt động', en: 'Activity proposal deadline' },
  { key: 'activityCancellationCutoffAt', vi: 'Hạn hủy hoạt động', en: 'Activity cancellation cutoff' },
  { key: 'participantRegistrationDeadlineAt', vi: 'Hạn người tham gia đăng ký', en: 'Participant registration deadline' },
];

const DEADLINE_KEYS = new Set<FormField>(DATE_FIELDS.map(field => field.key));

const FIELD_IDS: Record<FormField, string> = {
  name: 'event-name',
  description: 'event-description',
  startAt: 'event-start-at',
  endAt: 'event-end-at',
  partnerApplicationDeadlineAt: 'event-partnerApplicationDeadlineAt',
  boothRequestDeadlineAt: 'event-boothRequestDeadlineAt',
  activityProposalDeadlineAt: 'event-activityProposalDeadlineAt',
  participantRegistrationDeadlineAt: 'event-participantRegistrationDeadlineAt',
  partnerWithdrawalCutoffAt: 'event-partnerWithdrawalCutoffAt',
  boothCancellationCutoffAt: 'event-boothCancellationCutoffAt',
  activityCancellationCutoffAt: 'event-activityCancellationCutoffAt',
  boothPaymentWindowValue: 'event-payment-window',
  boothPaymentWindowUnit: 'event-payment-window-unit',
  maxBoothsPerPartner: 'event-max-booths',
  maxActivitiesPerPartner: 'event-max-activities',
  bannerUrl: 'event-banner-url',
};

const FORM_FIELDS = new Set<FormField>(Object.keys(FIELD_IDS) as FormField[]);

function apiFieldToFormField(field: string): FormField | undefined {
  if (field === 'boothPaymentWindowMinutes') return 'boothPaymentWindowValue';
  if (field === 'file') return 'bannerUrl';
  return FORM_FIELDS.has(field as FormField) ? field as FormField : undefined;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextLocalMinute(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() + 1);
  return toDateTimeLocal(now.toISOString());
}

function laterLocalDateTime(first: string, second: string): string {
  return first > second ? first : second;
}

function formFromEvent(event?: OrganizerEvent | null): EventFormState {
  if (!event) return { ...EMPTY_FORM };
  const useDays = event.boothPaymentWindowMinutes > 1440 && event.boothPaymentWindowMinutes % 1440 === 0;
  return {
    name: event.title,
    description: event.description,
    startAt: toDateTimeLocal(event.startDate),
    endAt: toDateTimeLocal(event.endDate),
    partnerApplicationDeadlineAt: toDateTimeLocal(event.partnerApplicationDeadlineAt),
    boothRequestDeadlineAt: toDateTimeLocal(event.boothRequestDeadlineAt),
    activityProposalDeadlineAt: toDateTimeLocal(event.activityProposalDeadlineAt),
    participantRegistrationDeadlineAt: toDateTimeLocal(event.participantRegistrationDeadlineAt),
    partnerWithdrawalCutoffAt: toDateTimeLocal(event.partnerWithdrawalCutoffAt),
    boothCancellationCutoffAt: toDateTimeLocal(event.boothCancellationCutoffAt),
    activityCancellationCutoffAt: toDateTimeLocal(event.activityCancellationCutoffAt),
    boothPaymentWindowValue: String(event.boothPaymentWindowMinutes / (useDays ? 1440 : 60)),
    boothPaymentWindowUnit: useDays ? 'DAYS' : 'HOURS',
    maxBoothsPerPartner: String(event.maxBoothsPerPartner),
    maxActivitiesPerPartner: String(event.maxActivitiesPerPartner),
    bannerUrl: event.bannerUrl || '',
  };
}

function optionalInstant(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function isValidBannerUrl(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (/^\/api\/v1\/media\/event-banners\/[^/?#]+$/.test(normalized)) return true;

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const OrganizerCreateEventModal: React.FC<OrganizerCreateEventModalProps> = ({
  language,
  isOpen,
  event,
  onClose,
  onSave,
}) => {
  const [initialForm] = useState<EventFormState>(() => formFromEvent(event));
  const [form, setForm] = useState<EventFormState>(() => ({ ...initialForm }));
  const [minimumFutureAt] = useState(nextLocalMinute);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeadlinesOpen, setIsDeadlinesOpen] = useState(Boolean(event));
  const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerObjectUrl, setBannerObjectUrl] = useState('');
  const [rawBannerUrl, setRawBannerUrl] = useState('');
  const [rawBannerMeta, setRawBannerMeta] = useState<{ name: string; type: string }>({ name: 'event-banner.jpg', type: 'image/jpeg' });
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  useModalDismiss(isOpen && !isCropModalOpen, () => { if (!isSaving) onClose(); });

  useEffect(() => {
    if (!error) return;
    errorAlertRef.current?.focus({ preventScroll: true });
    errorAlertRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  useEffect(() => () => {
    if (bannerObjectUrl) URL.revokeObjectURL(bannerObjectUrl);
  }, [bannerObjectUrl]);

  if (!isOpen) return null;

  const updateField = (field: FormField, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError('');
    if (field === 'bannerUrl') {
      setBannerFile(null);
      setBannerObjectUrl('');
      setBannerPreviewFailed(false);
    }
  };

  const selectBannerFile = (file: File | undefined) => {
    if (!file) return;
    const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!supportedTypes.has(file.type)) {
      setFieldErrors(current => ({ ...current, bannerUrl: 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors(current => ({ ...current, bannerUrl: 'Ảnh banner không được vượt quá 5 MB.' }));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setBannerFile(file);
    setBannerObjectUrl(objectUrl);
    setRawBannerUrl(objectUrl);
    setRawBannerMeta({ name: file.name, type: file.type });
    setIsCropModalOpen(true);
    setBannerPreviewFailed(false);
    setFieldErrors(current => {
      if (!current.bannerUrl) return current;
      const next = { ...current };
      delete next.bannerUrl;
      return next;
    });
    setError('');
  };

  const updatePaymentWindowUnit = (unit: EventFormState['boothPaymentWindowUnit']) => {
    setForm(current => {
      const currentFactor = current.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60;
      const nextFactor = unit === 'DAYS' ? 1440 : 60;
      const minutes = Number(current.boothPaymentWindowValue) * currentFactor;
      return {
        ...current,
        boothPaymentWindowUnit: unit,
        boothPaymentWindowValue: Number.isFinite(minutes) ? String(minutes / nextFactor) : current.boothPaymentWindowValue,
      };
    });
    setFieldErrors(current => {
      if (!current.boothPaymentWindowValue) return current;
      const next = { ...current };
      delete next.boothPaymentWindowValue;
      return next;
    });
  };

  const dateFieldChanged = (field: FormField) => !event || form[field] !== initialForm[field];
  const dateFieldMinimum = (field: FormField, minimum: string) => {
    const originalValue = initialForm[field];
    const keepsExistingPastValue = Boolean(
      event
      && form[field] === originalValue
      && originalValue
      && originalValue < minimumFutureAt,
    );
    return keepsExistingPastValue ? undefined : minimum;
  };

  const validate = (): ValidationIssue | null => {
    if (!form.name.trim()) return { field: 'name', message: language === 'vi' ? 'Vui lòng nhập tên sự kiện.' : 'Event name is required.' };
    if (Array.from(form.name.trim()).length > 150) return { field: 'name', message: language === 'vi' ? 'Tên sự kiện không được vượt quá 150 ký tự.' : 'Event name must not exceed 150 characters.' };
    if (!form.startAt) return { field: 'startAt', message: language === 'vi' ? 'Vui lòng nhập thời gian bắt đầu.' : 'Start time is required.' };
    if (!form.endAt) return { field: 'endAt', message: language === 'vi' ? 'Vui lòng nhập thời gian kết thúc.' : 'End time is required.' };

    const startTime = new Date(form.startAt).getTime();
    const endTime = new Date(form.endAt).getTime();
    if (!Number.isFinite(startTime)) return { field: 'startAt', message: language === 'vi' ? 'Thời gian bắt đầu không hợp lệ.' : 'Start time is invalid.' };
    if (!Number.isFinite(endTime)) return { field: 'endAt', message: language === 'vi' ? 'Thời gian kết thúc không hợp lệ.' : 'End time is invalid.' };
    const now = Date.now();
    if (dateFieldChanged('startAt') && startTime <= now) return { field: 'startAt', message: language === 'vi' ? 'Thời gian bắt đầu phải ở tương lai.' : 'Start time must be in the future.' };
    if (dateFieldChanged('endAt') && endTime <= now) return { field: 'endAt', message: language === 'vi' ? 'Thời gian kết thúc phải ở tương lai.' : 'End time must be in the future.' };
    if (endTime <= startTime) return { field: 'endAt', message: language === 'vi' ? 'Thời gian kết thúc phải sau thời gian bắt đầu.' : 'End time must be after start time.' };

    for (const field of DATE_FIELDS) {
      const value = form[field.key];
      if (!value) continue;
      const deadlineTime = new Date(value).getTime();
      if (!Number.isFinite(deadlineTime)) {
        return { field: field.key, message: language === 'vi' ? `${field.vi} không hợp lệ.` : `${field.en} is invalid.` };
      }
      if (dateFieldChanged(field.key) && deadlineTime <= now) {
        return { field: field.key, message: language === 'vi' ? `${field.vi} phải ở tương lai.` : `${field.en} must be in the future.` };
      }
      if (deadlineTime > startTime) {
        return { field: field.key, message: language === 'vi' ? `${field.vi} không được sau thời gian bắt đầu sự kiện.` : `${field.en} must not be after the event start time.` };
      }
    }

    const partnerDeadline = form.partnerApplicationDeadlineAt;
    if (partnerDeadline && form.boothRequestDeadlineAt && new Date(form.boothRequestDeadlineAt) < new Date(partnerDeadline)) {
      return { field: 'boothRequestDeadlineAt', message: language === 'vi' ? 'Hạn yêu cầu gian hàng không được trước hạn đối tác đăng ký.' : 'Booth request deadline must not be before partner application deadline.' };
    }
    if (partnerDeadline && form.activityProposalDeadlineAt && new Date(form.activityProposalDeadlineAt) < new Date(partnerDeadline)) {
      return { field: 'activityProposalDeadlineAt', message: language === 'vi' ? 'Hạn đề xuất hoạt động không được trước hạn đối tác đăng ký.' : 'Activity proposal deadline must not be before partner application deadline.' };
    }

    const paymentWindowValue = Number(form.boothPaymentWindowValue);
    const paymentWindowMinutes = Math.round(paymentWindowValue * (form.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60));
    if (!Number.isFinite(paymentWindowValue) || paymentWindowValue <= 0 || !Number.isInteger(paymentWindowMinutes) || paymentWindowMinutes < 60 || paymentWindowMinutes > 10080) {
      return { field: 'boothPaymentWindowValue', message: language === 'vi' ? 'Thời hạn giữ chỗ phải từ 1 giờ đến 7 ngày.' : 'The Booth hold window must be between 1 hour and 7 days.' };
    }

    const maxBooths = Number(form.maxBoothsPerPartner);
    if (!Number.isInteger(maxBooths) || maxBooths < 0) {
      return { field: 'maxBoothsPerPartner', message: language === 'vi' ? 'Số gian hàng tối đa phải là số nguyên không âm.' : 'Maximum booths must be a non-negative integer.' };
    }
    const maxActivities = Number(form.maxActivitiesPerPartner);
    if (!Number.isInteger(maxActivities) || maxActivities < 0) {
      return { field: 'maxActivitiesPerPartner', message: language === 'vi' ? 'Số hoạt động tối đa phải là số nguyên không âm.' : 'Maximum activities must be a non-negative integer.' };
    }
    if (!bannerFile && !isValidBannerUrl(form.bannerUrl)) {
      return {
        field: 'bannerUrl',
        message: language === 'vi'
          ? 'Liên kết ảnh phải bắt đầu bằng http:// hoặc https://.'
          : 'The image link must start with http:// or https://.',
      };
    }
    return null;
  };

  const focusIssue = (issue: ValidationIssue) => {
    if (DEADLINE_KEYS.has(issue.field)) setIsDeadlinesOpen(true);
    window.requestAnimationFrame(() => document.getElementById(FIELD_IDS[issue.field])?.focus());
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const validationIssue = validate();
    if (validationIssue) {
      setError('');
      setFieldErrors({ [validationIssue.field]: validationIssue.message });
      focusIssue(validationIssue);
      return;
    }

    const request: OrganizerEventRequest = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      partnerApplicationDeadlineAt: optionalInstant(form.partnerApplicationDeadlineAt),
      boothRequestDeadlineAt: optionalInstant(form.boothRequestDeadlineAt),
      activityProposalDeadlineAt: optionalInstant(form.activityProposalDeadlineAt),
      participantRegistrationDeadlineAt: optionalInstant(form.participantRegistrationDeadlineAt),
      partnerWithdrawalCutoffAt: optionalInstant(form.partnerWithdrawalCutoffAt),
      boothCancellationCutoffAt: optionalInstant(form.boothCancellationCutoffAt),
      activityCancellationCutoffAt: optionalInstant(form.activityCancellationCutoffAt),
      boothPaymentWindowMinutes: Math.round(Number(form.boothPaymentWindowValue) * (form.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60)),
      maxBoothsPerPartner: Number(form.maxBoothsPerPartner),
      maxActivitiesPerPartner: Number(form.maxActivitiesPerPartner),
      bannerUrl: form.bannerUrl.trim() || null,
    };

    setIsSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const bannerUrl = bannerFile
        ? await organizerApi.uploadEventBanner(bannerFile)
        : request.bannerUrl;
      await onSave({ ...request, bannerUrl }, event?.id);
      onClose();
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        const mappedErrors: Partial<Record<FormField, string>> = {};
        const unmappedMessages: string[] = [];
        caughtError.fieldErrors.forEach(item => {
          const field = apiFieldToFormField(item.field);
          if (field && !mappedErrors[field]) mappedErrors[field] = item.message;
          else if (!field && item.message) unmappedMessages.push(item.message);
        });
        const firstField = (Object.keys(mappedErrors) as FormField[])[0];
        if (firstField) {
          setFieldErrors(mappedErrors);
          focusIssue({ field: firstField, message: mappedErrors[firstField] || caughtError.message });
        }
        setError(unmappedMessages.join(' ') || (firstField ? '' : caughtError.message));
      } else {
        setError(caughtError instanceof Error ? caughtError.message : 'Không thể lưu sự kiện.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderFieldError = (field: FormField) => fieldErrors[field]
    ? <span className="org-event-field-error" id={`${FIELD_IDS[field]}-error`} role="alert">{fieldErrors[field]}</span>
    : null;
  const describedBy = (field: FormField) => fieldErrors[field] ? `${FIELD_IDS[field]}-error` : undefined;

  return createPortal(
    <div className="org-modal-backdrop" onMouseDown={e => { (e.currentTarget as any)._down = e.target; }} onClick={e => { if (e.target === e.currentTarget && (e.currentTarget as any)._down === e.currentTarget && !isSaving) onClose(); }}>
      <div
        className="org-modal-box org-event-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-event-form-title"
        aria-describedby="organizer-event-form-description"
        onClick={clickEvent => clickEvent.stopPropagation()}
      >
        <div className="org-modal-header org-event-form-header">
          <div>
            <h3 id="organizer-event-form-title">{event ? 'Chỉnh sửa bản nháp' : 'Tạo sự kiện mới'}</h3>
            <p id="organizer-event-form-description">
              {event ? 'Cập nhật thông tin trước khi công bố sự kiện.' : 'Tạo bản nháp trước, bạn có thể hoàn thiện và công bố sau.'}
            </p>
          </div>
          <button type="button" className="organizer-icon-button" onClick={onClose} disabled={isSaving} aria-label="Đóng"><X size={20} /></button>
        </div>

        <form className="org-event-form" onSubmit={handleSubmit}>
          <div className="org-modal-body org-event-form-body">
            {error && <div ref={errorAlertRef} className="org-event-form-alert" role="alert" tabIndex={-1}><AlertCircle size={18} /> <span>{error}</span></div>}

            <section className="org-event-form-section" aria-labelledby="event-basic-heading">
              <div className="org-event-form-section-heading">
                <span className="org-event-form-section-number">1</span>
                <div><h4 id="event-basic-heading">Thông tin cơ bản</h4></div>
              </div>

              <div className="org-event-form-fields">
                <div className="org-event-form-field org-event-form-field-full">
                  <label htmlFor="event-name">Tên sự kiện <span aria-hidden="true">*</span></label>
                  <input id="event-name" value={form.name} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={describedBy('name')} onChange={changeEvent => updateField('name', changeEvent.target.value)} required />
                  <div className="org-event-field-meta">{renderFieldError('name')}<small>{Array.from(form.name).length}/150</small></div>
                </div>

                <div className="org-event-form-field org-event-form-field-full">
                  <label htmlFor="event-description">Mô tả <span className="org-event-optional-label">Không bắt buộc</span></label>
                  <textarea id="event-description" rows={3} value={form.description} onChange={changeEvent => updateField('description', changeEvent.target.value)} placeholder="Mô tả ngắn về nội dung và mục tiêu của sự kiện" />
                </div>

                <div className="org-event-form-field">
                  <label htmlFor="event-start-at">Bắt đầu <span aria-hidden="true">*</span></label>
                  <input id="event-start-at" type="datetime-local" value={form.startAt} min={dateFieldMinimum('startAt', minimumFutureAt)} aria-invalid={Boolean(fieldErrors.startAt)} aria-describedby={describedBy('startAt')} onChange={changeEvent => updateField('startAt', changeEvent.target.value)} required />
                  {renderFieldError('startAt')}
                </div>
                <div className="org-event-form-field">
                  <label htmlFor="event-end-at">Kết thúc <span aria-hidden="true">*</span></label>
                  <input id="event-end-at" type="datetime-local" value={form.endAt} min={dateFieldMinimum('endAt', laterLocalDateTime(minimumFutureAt, form.startAt || minimumFutureAt))} aria-invalid={Boolean(fieldErrors.endAt)} aria-describedby={describedBy('endAt')} onChange={changeEvent => updateField('endAt', changeEvent.target.value)} required />
                  {renderFieldError('endAt')}
                </div>

                <div className="org-event-form-field org-event-form-field-full">
                  <label htmlFor="event-banner-file">Ảnh banner <span className="org-event-optional-label">Không bắt buộc</span></label>
                  <div className="org-event-banner-field">
                    <div className="org-event-banner-controls">
                      <input
                        id="event-banner-file"
                        className="org-event-banner-file-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isSaving}
                        onClick={e => { (e.currentTarget as HTMLInputElement).value = ''; }}
                        onChange={changeEvent => selectBannerFile(changeEvent.target.files?.[0])}
                      />
                      <div className="org-event-banner-upload-row">
                        <label className="org-event-banner-upload-button" htmlFor="event-banner-file">
                          <ImageIcon size={17} aria-hidden="true" />
                          {bannerFile ? 'Chọn ảnh khác' : 'Chọn ảnh từ máy'}
                        </label>
                        {(bannerObjectUrl || form.bannerUrl) && !bannerPreviewFailed && (
                          <button
                            type="button"
                            className="org-event-banner-upload-button"
                            onClick={() => {
                              if (!rawBannerUrl) {
                                setRawBannerUrl(bannerObjectUrl || form.bannerUrl);
                              }
                              setIsCropModalOpen(true);
                            }}
                            disabled={isSaving}
                            title="Mở khung kéo chỉnh vị trí ảnh hiển thị trên các thẻ và modal"
                          >
                            <Crop size={15} aria-hidden="true" /> Căn chỉnh vị trí
                          </button>
                        )}
                        {bannerFile && (
                          <button
                            type="button"
                            className="org-event-banner-clear"
                            onClick={() => { setBannerFile(null); setBannerObjectUrl(''); setRawBannerUrl(''); }}
                            disabled={isSaving}
                          >
                            <X size={15} aria-hidden="true" /> Bỏ ảnh đã chọn
                          </button>
                        )}
                      </div>
                      <small>{bannerFile ? bannerFile.name : 'JPG, PNG hoặc WebP · tối đa 5 MB'}</small>
                      <span className="org-event-banner-separator">hoặc dùng liên kết ảnh</span>
                      <div className="org-event-banner-input">
                        <ImageIcon size={17} aria-hidden="true" />
                        <input
                          id="event-banner-url"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          value={form.bannerUrl}
                          aria-invalid={Boolean(fieldErrors.bannerUrl)}
                          aria-describedby={describedBy('bannerUrl')}
                          onChange={changeEvent => updateField('bannerUrl', changeEvent.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    {(bannerObjectUrl || form.bannerUrl) && !bannerPreviewFailed && (
                      <img
                        src={bannerObjectUrl || form.bannerUrl}
                        alt="Xem trước banner sự kiện"
                        style={{ cursor: 'pointer' }}
                        title="Nhấn để căn chỉnh vị trí ảnh"
                        onClick={() => {
                          if (!rawBannerUrl) {
                            setRawBannerUrl(bannerObjectUrl || form.bannerUrl);
                          }
                          setIsCropModalOpen(true);
                        }}
                        onError={() => setBannerPreviewFailed(true)}
                      />
                    )}
                    {(bannerObjectUrl || form.bannerUrl) && bannerPreviewFailed && <div className="org-event-banner-error"><ImageIcon size={18} />Không tải được ảnh</div>}
                  </div>
                  {renderFieldError('bannerUrl')}
                </div>
              </div>
            </section>

            <section className="org-event-form-section org-event-deadline-section" aria-labelledby="event-deadlines-heading">
              <button type="button" className="org-event-form-section-toggle" aria-expanded={isDeadlinesOpen} onClick={() => setIsDeadlinesOpen(open => !open)}>
                <span className="org-event-form-section-number">2</span>
                <span className="org-event-form-section-toggle-copy">
                  <strong id="event-deadlines-heading">Mốc thời hạn</strong>
                </span>
                <ChevronDown size={20} className={isDeadlinesOpen ? 'is-open' : ''} />
              </button>

              {isDeadlinesOpen && (
                <div className="org-event-deadline-content">
                  <fieldset>
                    <legend>Đối tác và gian hàng</legend>
                    <div className="org-event-form-fields">
                      {DATE_FIELDS.slice(0, 4).map(field => (
                        <div className="org-event-form-field" key={field.key}>
                          <label htmlFor={FIELD_IDS[field.key]}>{language === 'vi' ? field.vi : field.en}</label>
                          <input id={FIELD_IDS[field.key]} type="datetime-local" value={form[field.key]} min={dateFieldMinimum(field.key, minimumFutureAt)} max={form.startAt || undefined} aria-invalid={Boolean(fieldErrors[field.key])} aria-describedby={describedBy(field.key)} onChange={changeEvent => updateField(field.key, changeEvent.target.value)} />
                          {renderFieldError(field.key)}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Hoạt động và người tham gia</legend>
                    <div className="org-event-form-fields">
                      {DATE_FIELDS.slice(4).map(field => (
                        <div className="org-event-form-field" key={field.key}>
                          <label htmlFor={FIELD_IDS[field.key]}>{language === 'vi' ? field.vi : field.en}</label>
                          <input id={FIELD_IDS[field.key]} type="datetime-local" value={form[field.key]} min={dateFieldMinimum(field.key, minimumFutureAt)} max={form.startAt || undefined} aria-invalid={Boolean(fieldErrors[field.key])} aria-describedby={describedBy(field.key)} onChange={changeEvent => updateField(field.key, changeEvent.target.value)} />
                          {renderFieldError(field.key)}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
            </section>

            <section className="org-event-form-section" aria-labelledby="event-rules-heading">
              <div className="org-event-form-section-heading">
                <span className="org-event-form-section-number">3</span>
                <div><h4 id="event-rules-heading">Quy tắc vận hành</h4></div>
              </div>

              <div className="org-event-rule-grid">
                <div className="org-event-form-field">
                  <label htmlFor="event-payment-window">Thời hạn giữ chỗ gian hàng <span aria-hidden="true">*</span></label>
                  <div className="org-event-payment-window">
                    <input id="event-payment-window" type="number" min="1" max={form.boothPaymentWindowUnit === 'DAYS' ? 7 : 168} step="any" value={form.boothPaymentWindowValue} aria-invalid={Boolean(fieldErrors.boothPaymentWindowValue)} aria-describedby={describedBy('boothPaymentWindowValue')} onChange={changeEvent => updateField('boothPaymentWindowValue', changeEvent.target.value)} required />
                    <select id="event-payment-window-unit" aria-label="Đơn vị thời hạn giữ chỗ" value={form.boothPaymentWindowUnit} onChange={changeEvent => updatePaymentWindowUnit(changeEvent.target.value as EventFormState['boothPaymentWindowUnit'])}>
                      <option value="HOURS">Giờ</option>
                      <option value="DAYS">Ngày</option>
                    </select>
                  </div>
                  {renderFieldError('boothPaymentWindowValue')}
                  {!fieldErrors.boothPaymentWindowValue && <small>Cho phép từ 1 giờ đến 7 ngày.</small>}
                </div>
                <div className="org-event-form-field">
                  <label htmlFor="event-max-booths">Số gian hàng tối đa / đối tác <span aria-hidden="true">*</span></label>
                  <input id="event-max-booths" type="number" min="0" step="1" value={form.maxBoothsPerPartner} aria-invalid={Boolean(fieldErrors.maxBoothsPerPartner)} aria-describedby={describedBy('maxBoothsPerPartner')} onChange={changeEvent => updateField('maxBoothsPerPartner', changeEvent.target.value)} required />
                  {renderFieldError('maxBoothsPerPartner')}
                  {!fieldErrors.maxBoothsPerPartner && <small>Nhập 0 nếu chưa mở đăng ký gian hàng.</small>}
                </div>
                <div className="org-event-form-field">
                  <label htmlFor="event-max-activities">Số hoạt động tối đa / đối tác <span aria-hidden="true">*</span></label>
                  <input id="event-max-activities" type="number" min="0" step="1" value={form.maxActivitiesPerPartner} aria-invalid={Boolean(fieldErrors.maxActivitiesPerPartner)} aria-describedby={describedBy('maxActivitiesPerPartner')} onChange={changeEvent => updateField('maxActivitiesPerPartner', changeEvent.target.value)} required />
                  {renderFieldError('maxActivitiesPerPartner')}
                  {!fieldErrors.maxActivitiesPerPartner && <small>Giới hạn tổng đề xuất trong sự kiện.</small>}
                </div>
              </div>
            </section>
          </div>

          <div className="org-modal-footer org-event-form-footer">
            <div>
              <button type="button" className="btn-org-secondary" onClick={onClose} disabled={isSaving}>Hủy</button>
              <button type="submit" className="btn-org-primary" disabled={isSaving}><Check size={16} />{isSaving ? 'Đang lưu...' : event ? 'Lưu thay đổi' : 'Tạo bản nháp'}</button>
            </div>
          </div>
        </form>

        <EventImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={rawBannerUrl || bannerObjectUrl || form.bannerUrl}
          fileName={rawBannerMeta.name}
          fileType={rawBannerMeta.type}
          onClose={() => setIsCropModalOpen(false)}
          onConfirm={(croppedFile, previewUrl) => {
            setBannerFile(croppedFile);
            setBannerObjectUrl(previewUrl);
            setBannerPreviewFailed(false);
            setIsCropModalOpen(false);
          }}
        />
      </div>
    </div>,
    document.body,
  );
};
