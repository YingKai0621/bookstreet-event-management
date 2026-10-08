import React, { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { Language } from '../../types';
import { OrganizerEvent, OrganizerEventRequest } from '../../types/organizer';
import { ApiError } from '../../services/apiClient';

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

const DATE_FIELDS: Array<{ key: keyof EventFormState; vi: string; en: string }> = [
  { key: 'partnerApplicationDeadlineAt', vi: 'Hạn đối tác đăng ký', en: 'Partner application deadline' },
  { key: 'boothRequestDeadlineAt', vi: 'Hạn yêu cầu gian hàng', en: 'Booth request deadline' },
  { key: 'activityProposalDeadlineAt', vi: 'Hạn đề xuất hoạt động', en: 'Activity proposal deadline' },
  { key: 'participantRegistrationDeadlineAt', vi: 'Hạn người tham gia đăng ký', en: 'Participant registration deadline' },
  { key: 'partnerWithdrawalCutoffAt', vi: 'Hạn đối tác rút hồ sơ', en: 'Partner withdrawal cutoff' },
  { key: 'boothCancellationCutoffAt', vi: 'Hạn hủy gian hàng', en: 'Booth cancellation cutoff' },
  { key: 'activityCancellationCutoffAt', vi: 'Hạn hủy hoạt động', en: 'Activity cancellation cutoff' },
];

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formFromEvent(event?: OrganizerEvent | null): EventFormState {
  if (!event) return { ...EMPTY_FORM };
  const useDays = event.boothPaymentWindowMinutes > 1440
    && event.boothPaymentWindowMinutes % 1440 === 0;
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
    boothPaymentWindowValue: String(
      event.boothPaymentWindowMinutes / (useDays ? 1440 : 60),
    ),
    boothPaymentWindowUnit: useDays ? 'DAYS' : 'HOURS',
    maxBoothsPerPartner: String(event.maxBoothsPerPartner),
    maxActivitiesPerPartner: String(event.maxActivitiesPerPartner),
    bannerUrl: event.bannerUrl || '',
  };
}

function optionalInstant(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export const OrganizerCreateEventModal: React.FC<OrganizerCreateEventModalProps> = ({
  language,
  isOpen,
  event,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<EventFormState>(() => formFromEvent(event));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const updateField = (field: keyof EventFormState, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const updatePaymentWindowUnit = (unit: EventFormState['boothPaymentWindowUnit']) => {
    setForm(current => {
      const currentFactor = current.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60;
      const nextFactor = unit === 'DAYS' ? 1440 : 60;
      const minutes = Number(current.boothPaymentWindowValue) * currentFactor;
      return {
        ...current,
        boothPaymentWindowUnit: unit,
        boothPaymentWindowValue: Number.isFinite(minutes)
          ? String(minutes / nextFactor)
          : current.boothPaymentWindowValue,
      };
    });
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return language === 'vi' ? 'Vui lòng nhập tên sự kiện.' : 'Event name is required.';
    if (form.name.trim().length > 150) return language === 'vi' ? 'Tên sự kiện không được vượt quá 150 ký tự.' : 'Event name must not exceed 150 characters.';
    if (!form.startAt || !form.endAt) return language === 'vi' ? 'Vui lòng nhập thời gian bắt đầu và kết thúc.' : 'Start and end time are required.';

    const startTime = new Date(form.startAt).getTime();
    const endTime = new Date(form.endAt).getTime();
    if (endTime <= startTime) return language === 'vi' ? 'Thời gian kết thúc phải sau thời gian bắt đầu.' : 'End time must be after start time.';

    for (const field of DATE_FIELDS) {
      const value = form[field.key];
      if (value && new Date(value).getTime() > startTime) {
        return language === 'vi' ? `${field.vi} không được sau thời gian bắt đầu sự kiện.` : `${field.en} must not be after the event start time.`;
      }
    }

    const partnerDeadline = form.partnerApplicationDeadlineAt;
    if (partnerDeadline && form.boothRequestDeadlineAt && new Date(form.boothRequestDeadlineAt) < new Date(partnerDeadline)) {
      return language === 'vi' ? 'Hạn yêu cầu gian hàng không được trước hạn đối tác đăng ký.' : 'Booth request deadline must not be before partner application deadline.';
    }
    if (partnerDeadline && form.activityProposalDeadlineAt && new Date(form.activityProposalDeadlineAt) < new Date(partnerDeadline)) {
      return language === 'vi' ? 'Hạn đề xuất hoạt động không được trước hạn đối tác đăng ký.' : 'Activity proposal deadline must not be before partner application deadline.';
    }

    const paymentWindowValue = Number(form.boothPaymentWindowValue);
    const paymentWindowMinutes = Math.round(paymentWindowValue
      * (form.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60));
    if (!Number.isFinite(paymentWindowValue) || paymentWindowValue <= 0
      || !Number.isInteger(paymentWindowMinutes)
      || paymentWindowMinutes < 60 || paymentWindowMinutes > 10080) {
      return language === 'vi'
        ? 'Thời hạn giữ chỗ phải từ 1 giờ đến 7 ngày.'
        : 'The Booth hold window must be between 1 hour and 7 days.';
    }
    const numericValues = [Number(form.maxBoothsPerPartner), Number(form.maxActivitiesPerPartner)];
    if (numericValues.some(value => !Number.isInteger(value) || value < 0)) {
      return language === 'vi' ? 'Các giới hạn số phải là số nguyên không âm.' : 'Numeric limits must be non-negative integers.';
    }
    return null;
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
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
      boothPaymentWindowMinutes: Math.round(Number(form.boothPaymentWindowValue)
        * (form.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60)),
      maxBoothsPerPartner: Number(form.maxBoothsPerPartner),
      maxActivitiesPerPartner: Number(form.maxActivitiesPerPartner),
      bannerUrl: form.bannerUrl.trim() || null,
    };

    setIsSaving(true);
    setError('');
    try {
      await onSave(request, event?.id);
      onClose();
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        const fieldMessages = caughtError.fieldErrors.map(item => item.message).join(' ');
        setError(fieldMessages || caughtError.message);
      } else {
        setError(caughtError instanceof Error ? caughtError.message : 'Không thể lưu sự kiện.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: '40px', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB',
    borderRadius: '8px', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.35rem', color: '#1F2937', fontSize: '0.8rem', fontWeight: 650,
  };

  return (
    <div className="org-modal-backdrop" onClick={onClose}>
      <div className="org-modal-box" style={{ maxWidth: '820px' }} onClick={clickEvent => clickEvent.stopPropagation()}>
        <div className="org-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{event ? 'Chỉnh sửa bản nháp' : 'Tạo sự kiện mới'}</h3>
            <p style={{ margin: '0.3rem 0 0', color: '#556B65', fontSize: '0.82rem' }}>Sự kiện được lưu ở trạng thái bản nháp. Công bố là một thao tác riêng.</p>
          </div>
          <button type="button" className="organizer-icon-button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="org-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div style={{ padding: '0.75rem', marginBottom: '1rem', color: '#B91C1C', background: '#FEE2E2', borderRadius: '8px' }}><AlertCircle size={16} /> {error}</div>}

            <div style={{ marginBottom: '1rem' }}><label htmlFor="event-name" style={labelStyle}>Tên sự kiện *</label><input id="event-name" style={inputStyle} maxLength={150} value={form.name} onChange={changeEvent => updateField('name', changeEvent.target.value)} required /></div>
            <div style={{ marginBottom: '1rem' }}><label htmlFor="event-description" style={labelStyle}>Mô tả</label><textarea id="event-description" style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.description} onChange={changeEvent => updateField('description', changeEvent.target.value)} /></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div><label htmlFor="event-start-at" style={labelStyle}>Bắt đầu *</label><input id="event-start-at" style={inputStyle} type="datetime-local" value={form.startAt} onChange={changeEvent => updateField('startAt', changeEvent.target.value)} required /></div>
              <div><label htmlFor="event-end-at" style={labelStyle}>Kết thúc *</label><input id="event-end-at" style={inputStyle} type="datetime-local" value={form.endAt} onChange={changeEvent => updateField('endAt', changeEvent.target.value)} required /></div>
            </div>

            <h4 style={{ margin: '1.25rem 0 0.75rem' }}>Mốc thời hạn (có thể để trống khi còn là bản nháp)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {DATE_FIELDS.map(field => <div key={field.key}><label htmlFor={`event-${field.key}`} style={labelStyle}>{language === 'vi' ? field.vi : field.en}</label><input id={`event-${field.key}`} style={inputStyle} type="datetime-local" value={form[field.key]} onChange={changeEvent => updateField(field.key, changeEvent.target.value)} /></div>)}
            </div>

            <h4 style={{ margin: '1.25rem 0 0.75rem' }}>Giới hạn vận hành *</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
              <div>
                <label htmlFor="event-payment-window" style={labelStyle}>Thời hạn giữ chỗ gian hàng</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: '.5rem' }}>
                  <input
                    id="event-payment-window"
                    style={inputStyle}
                    type="number"
                    min="1"
                    max={form.boothPaymentWindowUnit === 'DAYS' ? 7 : 168}
                    step="any"
                    value={form.boothPaymentWindowValue}
                    onChange={changeEvent => updateField('boothPaymentWindowValue', changeEvent.target.value)}
                    required
                  />
                  <select
                    aria-label="Đơn vị thời hạn giữ chỗ"
                    style={inputStyle}
                    value={form.boothPaymentWindowUnit}
                    onChange={changeEvent => updatePaymentWindowUnit(
                      changeEvent.target.value as EventFormState['boothPaymentWindowUnit'],
                    )}
                  >
                    <option value="HOURS">Giờ</option>
                    <option value="DAYS">Ngày</option>
                  </select>
                </div>
                <small style={{ color: '#637771' }}>Cho phép từ 1 giờ đến 7 ngày.</small>
              </div>
              <div><label htmlFor="event-max-booths" style={labelStyle}>Số gian hàng tối đa / đối tác</label><input id="event-max-booths" style={inputStyle} type="number" min="0" step="1" value={form.maxBoothsPerPartner} onChange={changeEvent => updateField('maxBoothsPerPartner', changeEvent.target.value)} required /></div>
              <div><label htmlFor="event-max-activities" style={labelStyle}>Số hoạt động tối đa / đối tác</label><input id="event-max-activities" style={inputStyle} type="number" min="0" step="1" value={form.maxActivitiesPerPartner} onChange={changeEvent => updateField('maxActivitiesPerPartner', changeEvent.target.value)} required /></div>
            </div>

            <div style={{ marginTop: '1rem' }}><label htmlFor="event-banner-url" style={labelStyle}>URL ảnh banner</label><input id="event-banner-url" style={inputStyle} type="url" value={form.bannerUrl} onChange={changeEvent => updateField('bannerUrl', changeEvent.target.value)} /></div>
          </div>

          <div className="org-modal-footer">
            <button type="button" className="btn-org-secondary" onClick={onClose} disabled={isSaving}>Hủy</button>
            <button type="submit" className="btn-org-primary" disabled={isSaving}><Check size={16} />{isSaving ? 'Đang lưu...' : event ? 'Lưu thay đổi' : 'Tạo bản nháp'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
