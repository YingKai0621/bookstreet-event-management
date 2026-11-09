import { AlertCircle, Check, ChevronDown, Crop, Image as ImageIcon, X } from 'lucide-react';
import { EventImageCropModal } from './EventImageCropModal';
import { OrganizerDateTimeField } from './OrganizerDateTimeField';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import { ApiError } from '../../services/apiClient';
import { organizerApi } from '../../services/organizerApi';
import { Language } from '../../types';
import { OrganizerEvent, OrganizerEventRequest } from '../../types/organizer';

interface OrganizerCreateEventModalProps {
  language: Language;
  isOpen: boolean;
  event?: OrganizerEvent | null;
  focusPublishIssues?: boolean;
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
type EndPreset = 'SAME_DAY' | 'PLUS_ONE_DAY' | 'PLUS_TWO_DAYS' | 'PLUS_THREE_DAYS' | 'PLUS_SEVEN_DAYS' | 'CUSTOM';
type DeadlineSchedulePreset = 'COMPACT' | 'STANDARD' | 'EXTENDED';
type DeadlineField =
  | 'partnerApplicationDeadlineAt'
  | 'boothRequestDeadlineAt'
  | 'activityProposalDeadlineAt'
  | 'participantRegistrationDeadlineAt';
type PublishIssueField = DeadlineField | 'boothPaymentWindowValue';

interface ValidationIssue {
  field: FormField;
  message: string;
}

type PublishTimelineIssues = Partial<Record<PublishIssueField, string>>;

interface DeadlineFieldDefinition {
  key: DeadlineField;
  vi: string;
  en: string;
}

interface DeadlineScheduleDefinition {
  labelVi: string;
  labelEn: string;
  minimumLeadDays: number;
  offsets: Record<DeadlineField, number>;
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
const ACTIVE_DATE_FIELDS: DeadlineFieldDefinition[] = [
  { key: 'partnerApplicationDeadlineAt', vi: 'Hạn đối tác đăng ký', en: 'Partner application deadline' },
  { key: 'boothRequestDeadlineAt', vi: 'Hạn yêu cầu gian hàng', en: 'Booth request deadline' },
  { key: 'activityProposalDeadlineAt', vi: 'Hạn đề xuất hoạt động', en: 'Activity proposal deadline' },
  { key: 'participantRegistrationDeadlineAt', vi: 'Hạn người tham gia đăng ký', en: 'Participant registration deadline' },
];
const DATE_FIELDS = ACTIVE_DATE_FIELDS;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEADLINE_SCHEDULES: Record<DeadlineSchedulePreset, DeadlineScheduleDefinition> = {
  COMPACT: {
    labelVi: 'Rút gọn (14 ngày)',
    labelEn: 'Compact (14 days)',
    minimumLeadDays: 14,
    offsets: {
      partnerApplicationDeadlineAt: 10,
      boothRequestDeadlineAt: 7,
      activityProposalDeadlineAt: 7,
      participantRegistrationDeadlineAt: 1,
    },
  },
  STANDARD: {
    labelVi: 'Tiêu chuẩn (30 ngày)',
    labelEn: 'Standard (30 days)',
    minimumLeadDays: 30,
    offsets: {
      partnerApplicationDeadlineAt: 28,
      boothRequestDeadlineAt: 21,
      activityProposalDeadlineAt: 21,
      participantRegistrationDeadlineAt: 1,
    },
  },
  EXTENDED: {
    labelVi: 'Dài (60 ngày)',
    labelEn: 'Extended (60 days)',
    minimumLeadDays: 60,
    offsets: {
      partnerApplicationDeadlineAt: 56,
      boothRequestDeadlineAt: 42,
      activityProposalDeadlineAt: 42,
      participantRegistrationDeadlineAt: 1,
    },
  },
};

const DEADLINE_KEYS = new Set<FormField>(DATE_FIELDS.map(field => field.key));
const PUBLISH_ISSUE_KEYS = new Set<FormField>([...DEADLINE_KEYS, 'boothPaymentWindowValue']);

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

function shiftLocalDateTime(value: string, amount: number, unit: 'MINUTES' | 'DAYS'): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  if (unit === 'MINUTES') date.setMinutes(date.getMinutes() + amount);
  else date.setDate(date.getDate() + amount);
  return toDateTimeLocal(date.toISOString());
}

function buildDeadlineSchedule(
  startAt: string,
  preset: DeadlineSchedulePreset,
): Record<DeadlineField, string> | null {
  if (!startAt) return null;
  const schedule = {} as Record<DeadlineField, string>;
  const definition = DEADLINE_SCHEDULES[preset];
  for (const field of DATE_FIELDS) {
    const value = shiftLocalDateTime(startAt, -definition.offsets[field.key], 'DAYS');
    if (!value) return null;
    schedule[field.key] = value;
  }
  return schedule;
}

function endFromPreset(startAt: string, preset: EndPreset, currentEndAt = ''): string {
  if (!startAt || preset === 'CUSTOM') return currentEndAt;
  if (preset === 'SAME_DAY') return `${startAt.slice(0, 10)}T23:59`;
  const days = {
    PLUS_ONE_DAY: 1,
    PLUS_TWO_DAYS: 2,
    PLUS_THREE_DAYS: 3,
    PLUS_SEVEN_DAYS: 7,
  }[preset];
  return shiftLocalDateTime(startAt, days, 'DAYS');
}

function formatLocalDateTime(value: string, language: Language): string {
  if (!value) return language === 'vi' ? 'Chọn thời gian bắt đầu trước' : 'Choose the start time first';
  const [date = '', time = ''] = value.split('T');
  const [year, month, day] = date.split('-');
  if (!year || !month || !day || !time) return value;
  return language === 'vi'
    ? `${day}/${month}/${year} lúc ${time.slice(0, 5)}`
    : `${day}/${month}/${year} at ${time.slice(0, 5)}`;
}

function customDurationLabel(startAt: string, endAt: string, language: Language): string {
  const fallback = language === 'vi' ? 'Tùy chỉnh ngày kết thúc' : 'Custom end date';
  if (!startAt || !endAt) return fallback;
  const duration = new Date(endAt).getTime() - new Date(startAt).getTime();
  const days = duration / 86_400_000;
  if (!Number.isInteger(days) || days <= 0) return fallback;
  return language === 'vi' ? `Tùy chỉnh · ${days} ngày` : `Custom · ${days} days`;
}

function getPublishTimelineIssues(form: EventFormState, language: Language): PublishTimelineIssues {
  const vi = language === 'vi';
  const issues: PublishTimelineIssues = {};
  const time = (value: string) => value ? new Date(value).getTime() : Number.NaN;
  const partnerApplication = time(form.partnerApplicationDeadlineAt);
  const boothRequest = time(form.boothRequestDeadlineAt);
  const activityProposal = time(form.activityProposalDeadlineAt);
  const participantRegistration = time(form.participantRegistrationDeadlineAt);
  const eventStart = time(form.startAt);
  const maxBooths = Number(form.maxBoothsPerPartner);
  const maxActivities = Number(form.maxActivitiesPerPartner);
  const boothsEnabled = Number.isInteger(maxBooths) && maxBooths > 0;
  const activitiesEnabled = Number.isInteger(maxActivities) && maxActivities > 0;
  const now = Date.now();

  if (!form.partnerApplicationDeadlineAt) {
    issues.partnerApplicationDeadlineAt = vi
      ? 'Cần thiết lập hạn đối tác đăng ký trước khi công bố.'
      : 'Set the partner application deadline before publishing.';
  } else if (Number.isFinite(partnerApplication) && partnerApplication <= now) {
    issues.partnerApplicationDeadlineAt = vi
      ? 'Hạn đối tác đăng ký phải ở tương lai khi công bố.'
      : 'The partner application deadline must be in the future when publishing.';
  }
  if (boothsEnabled && !form.boothRequestDeadlineAt) {
    issues.boothRequestDeadlineAt = vi
      ? 'Cần thiết lập hạn yêu cầu gian hàng vì sự kiện đang mở đăng ký gian hàng.'
      : 'Set the Booth request deadline because Booth registration is enabled.';
  } else if (boothsEnabled && Number.isFinite(boothRequest) && boothRequest <= now) {
    issues.boothRequestDeadlineAt = vi
      ? 'Hạn yêu cầu gian hàng phải ở tương lai khi công bố.'
      : 'The Booth request deadline must be in the future when publishing.';
  } else if (boothsEnabled && Number.isFinite(boothRequest)
      && Number.isFinite(eventStart) && boothRequest > eventStart) {
    issues.boothRequestDeadlineAt = vi
      ? 'Hạn yêu cầu gian hàng không được sau thời gian bắt đầu sự kiện.'
      : 'The Booth request deadline must not be after the Event start time.';
  } else if (boothsEnabled && Number.isFinite(partnerApplication)
      && Number.isFinite(boothRequest) && boothRequest < partnerApplication + DAY_MS) {
    issues.boothRequestDeadlineAt = vi
      ? 'Phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức có thời gian duyệt hồ sơ.'
      : 'Must be at least 24 hours after the partner application deadline for application review.';
  }
  if (activitiesEnabled && !form.activityProposalDeadlineAt) {
    issues.activityProposalDeadlineAt = vi
      ? 'Cần thiết lập hạn đề xuất hoạt động vì sự kiện đang cho phép hoạt động của đối tác.'
      : 'Set the Activity proposal deadline because Partner activities are enabled.';
  } else if (activitiesEnabled && Number.isFinite(activityProposal) && activityProposal <= now) {
    issues.activityProposalDeadlineAt = vi
      ? 'Hạn đề xuất hoạt động phải ở tương lai khi công bố.'
      : 'The Activity proposal deadline must be in the future when publishing.';
  } else if (activitiesEnabled && Number.isFinite(activityProposal)
      && Number.isFinite(eventStart) && activityProposal > eventStart) {
    issues.activityProposalDeadlineAt = vi
      ? 'Hạn đề xuất hoạt động không được sau thời gian bắt đầu sự kiện.'
      : 'The Activity proposal deadline must not be after the Event start time.';
  } else if (activitiesEnabled && Number.isFinite(partnerApplication)
      && Number.isFinite(activityProposal) && activityProposal < partnerApplication + DAY_MS) {
    issues.activityProposalDeadlineAt = vi
      ? 'Phải sau hạn đối tác đăng ký ít nhất 24 giờ để Ban tổ chức có thời gian duyệt hồ sơ.'
      : 'Must be at least 24 hours after the partner application deadline for application review.';
  }
  if (!form.participantRegistrationDeadlineAt) {
    issues.participantRegistrationDeadlineAt = vi
      ? 'Cần thiết lập hạn người tham gia đăng ký trước khi công bố.'
      : 'Set the Participant registration deadline before publishing.';
  } else if (Number.isFinite(participantRegistration) && participantRegistration <= now) {
    issues.participantRegistrationDeadlineAt = vi
      ? 'Hạn người tham gia đăng ký phải ở tương lai khi công bố.'
      : 'The Participant registration deadline must be in the future when publishing.';
  } else if (Number.isFinite(participantRegistration) && Number.isFinite(eventStart) && participantRegistration >= eventStart) {
    issues.participantRegistrationDeadlineAt = vi
      ? 'Phải trước giờ bắt đầu sự kiện để ban tổ chức có thời gian chuẩn bị danh sách.'
      : 'Must be before the event starts so the organizer has time to prepare the attendee list.';
  }
  const paymentWindowValue = Number(form.boothPaymentWindowValue);
  const paymentWindowMinutes = Math.round(paymentWindowValue
    * (form.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60));
  if (boothsEnabled && Number.isFinite(boothRequest) && Number.isFinite(eventStart)
      && Number.isInteger(paymentWindowMinutes)
      && boothRequest + (paymentWindowMinutes * 60_000) + DAY_MS > eventStart) {
    issues.boothPaymentWindowValue = vi
      ? 'Hạn yêu cầu gian hàng cộng thời gian thanh toán phải kết thúc trước sự kiện ít nhất 24 giờ để chuẩn bị gian hàng.'
      : 'The Booth request deadline plus payment window must end at least 24 hours before the Event for setup.';
  }

  return issues;
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
  focusPublishIssues = false,
  onClose,
  onSave,
}) => {
  const basicInfoOnly = Boolean(event) && event?.apiStatus !== 'DRAFT';
  const [initialForm] = useState<EventFormState>(() => formFromEvent(event));
  const [form, setForm] = useState<EventFormState>(() => ({ ...initialForm }));
  const [minimumFutureAt] = useState(nextLocalMinute);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeadlinesOpen, setIsDeadlinesOpen] = useState(Boolean(event));
  const [endPreset, setEndPreset] = useState<EndPreset>(event ? 'CUSTOM' : 'PLUS_TWO_DAYS');
  const [deadlineSchedulePreset, setDeadlineSchedulePreset] = useState<DeadlineSchedulePreset>('STANDARD');
  const [linkedDeadlineSchedule, setLinkedDeadlineSchedule] = useState<DeadlineSchedulePreset | null>(null);
  const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerObjectUrl, setBannerObjectUrl] = useState('');
  const [rawBannerUrl, setRawBannerUrl] = useState('');
  const [rawBannerMeta, setRawBannerMeta] = useState<{ name: string; type: string }>({ name: 'event-banner.jpg', type: 'image/jpeg' });
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const ownedBannerUrlsRef = useRef<Set<string>>(new Set());
  const errorAlertRef = useRef<HTMLDivElement>(null);
  useModalDismiss(isOpen && !isCropModalOpen, () => { if (!isSaving) onClose(); });
  const backdropHandlers = useBackdropClick(() => { if (!isSaving) onClose(); });

  useEffect(() => {
    if (!error) return;
    errorAlertRef.current?.focus({ preventScroll: true });
    errorAlertRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  useEffect(() => () => {
    ownedBannerUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    ownedBannerUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!isOpen || !focusPublishIssues) return undefined;
    const issues = getPublishTimelineIssues(initialForm, language);
    const issueOrder: PublishIssueField[] = [
      'partnerApplicationDeadlineAt',
      'boothRequestDeadlineAt',
      'activityProposalDeadlineAt',
      'participantRegistrationDeadlineAt',
      'boothPaymentWindowValue',
    ];
    const firstIssue = issueOrder.find(field => issues[field]);
    if (!firstIssue) return undefined;
    const focusTimer = window.setTimeout(() => {
      const input = document.getElementById(FIELD_IDS[firstIssue]);
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [focusPublishIssues, initialForm, isOpen, language]);

  if (!isOpen) return null;

  const updateField = (field: FormField, value: string) => {
    if (DEADLINE_KEYS.has(field)) setLinkedDeadlineSchedule(null);
    setForm(current => {
      const next = { ...current, [field]: value };
      if (field === 'startAt') {
        next.endAt = endFromPreset(value, endPreset, current.endAt);
        if (linkedDeadlineSchedule !== null) {
          const schedule = buildDeadlineSchedule(value, linkedDeadlineSchedule);
          if (schedule) DATE_FIELDS.forEach(deadline => { next[deadline.key] = schedule[deadline.key]; });
        }
      }
      if (field === 'partnerApplicationDeadlineAt' && value) {
        const earliestDownstreamDeadline = shiftLocalDateTime(value, 24 * 60, 'MINUTES');
        if (earliestDownstreamDeadline) {
          (['boothRequestDeadlineAt', 'activityProposalDeadlineAt'] as DeadlineField[])
            .forEach(dependentField => {
              const dependentValue = current[dependentField];
              if (dependentValue && new Date(dependentValue).getTime()
                  < new Date(earliestDownstreamDeadline).getTime()) {
                next[dependentField] = earliestDownstreamDeadline;
              }
            });
        }
      }
      return next;
    });
    setFieldErrors(current => {
      const clearsPaymentBoundary = field === 'startAt' || field === 'boothRequestDeadlineAt';
      if (!current[field] && (!clearsPaymentBoundary || !current.boothPaymentWindowValue)) return current;
      const next = { ...current };
      delete next[field];
      if (clearsPaymentBoundary) delete next.boothPaymentWindowValue;
      if (field === 'partnerApplicationDeadlineAt') {
        delete next.boothRequestDeadlineAt;
        delete next.activityProposalDeadlineAt;
        delete next.boothPaymentWindowValue;
      }
      return next;
    });
    setError('');
    if (field === 'bannerUrl') {
      ownedBannerUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      ownedBannerUrlsRef.current.clear();
      setBannerFile(null);
      setBannerObjectUrl('');
      setRawBannerUrl('');
      setRawBannerMeta({ name: 'event-banner.jpg', type: 'image/jpeg' });
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
    ownedBannerUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    ownedBannerUrlsRef.current.clear();
    const objectUrl = URL.createObjectURL(file);
    ownedBannerUrlsRef.current.add(objectUrl);
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

  const updateEndPreset = (preset: EndPreset) => {
    setEndPreset(preset);
    setForm(current => ({
      ...current,
      endAt: endFromPreset(current.startAt, preset, current.endAt),
    }));
    setFieldErrors(current => {
      if (!current.endAt) return current;
      const next = { ...current };
      delete next.endAt;
      return next;
    });
  };

  const applyDeadlineSchedule = () => {
    if (!form.startAt) {
      const message = language === 'vi'
        ? 'Vui lòng chọn thời gian bắt đầu trước khi tạo lịch trình.'
        : 'Choose the event start time before generating deadlines.';
      setFieldErrors(current => ({ ...current, startAt: message }));
      focusIssue({ field: 'startAt', message });
      return;
    }
    const definition = DEADLINE_SCHEDULES[deadlineSchedulePreset];
    const schedule = buildDeadlineSchedule(form.startAt, deadlineSchedulePreset);
    const minimumTime = new Date(minimumFutureAt).getTime();
    const scheduleIsFuture = schedule && DATE_FIELDS.every(field => (
      new Date(schedule[field.key]).getTime() > minimumTime
    ));
    if (!schedule || !scheduleIsFuture) {
      setError(language === 'vi'
        ? `Mẫu này cần sự kiện còn ít nhất ${definition.minimumLeadDays} ngày. Hãy chọn lịch ngắn hơn hoặc chỉnh từng mốc.`
        : `This template needs an Event at least ${definition.minimumLeadDays} days away. Choose a shorter schedule or edit each deadline.`);
      return;
    }
    setForm(current => {
      const next = { ...current };
      DATE_FIELDS.forEach(field => { next[field.key] = schedule[field.key]; });
      return next;
    });
    setLinkedDeadlineSchedule(deadlineSchedulePreset);
    setError('');
    setFieldErrors(current => {
      const next = { ...current };
      DATE_FIELDS.forEach(field => { delete next[field.key]; });
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
    if (basicInfoOnly) {
      return !bannerFile && !isValidBannerUrl(form.bannerUrl)
        ? { field: 'bannerUrl', message: 'Liên kết ảnh phải bắt đầu bằng http:// hoặc https://.' }
        : null;
    }
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

    const maxBooths = Number(form.maxBoothsPerPartner);
    if (!Number.isInteger(maxBooths) || maxBooths < 0) {
      return { field: 'maxBoothsPerPartner', message: language === 'vi' ? 'Số gian hàng tối đa phải là số nguyên không âm.' : 'Maximum booths must be a non-negative integer.' };
    }
    const maxActivities = Number(form.maxActivitiesPerPartner);
    if (!Number.isInteger(maxActivities) || maxActivities < 0) {
      return { field: 'maxActivitiesPerPartner', message: language === 'vi' ? 'Số hoạt động tối đa phải là số nguyên không âm.' : 'Maximum activities must be a non-negative integer.' };
    }
    const enabledDateFields = DATE_FIELDS.filter(field => (
      field.key !== 'boothRequestDeadlineAt' || maxBooths > 0
    ) && (
      field.key !== 'activityProposalDeadlineAt' || maxActivities > 0
    ));

    for (const field of enabledDateFields) {
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

    const paymentWindowValue = Number(form.boothPaymentWindowValue);
    const paymentWindowMinutes = Math.round(paymentWindowValue * (form.boothPaymentWindowUnit === 'DAYS' ? 1440 : 60));
    if (maxBooths > 0 && (!Number.isFinite(paymentWindowValue) || paymentWindowValue <= 0 || !Number.isInteger(paymentWindowMinutes) || paymentWindowMinutes < 60 || paymentWindowMinutes > 10080)) {
      return { field: 'boothPaymentWindowValue', message: language === 'vi' ? 'Thời hạn giữ chỗ phải từ 1 giờ đến 7 ngày.' : 'The Booth hold window must be between 1 hour and 7 days.' };
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
  const publishTimelineIssues = getPublishTimelineIssues(form, language);
  const publishTimelineIssueCount = Object.keys(publishTimelineIssues).length;
  const publishIssueId = (field: PublishIssueField) => `${FIELD_IDS[field]}-publish-issue`;
  const describedBy = (field: FormField) => {
    const descriptions: string[] = [];
    if (fieldErrors[field]) descriptions.push(`${FIELD_IDS[field]}-error`);
    if (!fieldErrors[field] && PUBLISH_ISSUE_KEYS.has(field)
        && publishTimelineIssues[field as PublishIssueField]) {
      descriptions.push(publishIssueId(field as PublishIssueField));
    }
    return descriptions.length > 0 ? descriptions.join(' ') : undefined;
  };
  const renderPublishTimelineIssue = (field: PublishIssueField) => {
    const message = publishTimelineIssues[field];
    if (!message || fieldErrors[field]) return null;
    return (
      <span className="org-event-publish-issue" id={publishIssueId(field)} role="status">
        <AlertCircle size={15} aria-hidden="true" />
        <span>{message}</span>
      </span>
    );
  };
  const selectedScheduleDefinition = DEADLINE_SCHEDULES[deadlineSchedulePreset];
  const deadlineSchedulePreview = buildDeadlineSchedule(form.startAt, deadlineSchedulePreset);
  const deadlineScheduleIsAvailable = Boolean(deadlineSchedulePreview && DATE_FIELDS.every(field => (
    new Date(deadlineSchedulePreview[field.key]).getTime() > new Date(minimumFutureAt).getTime()
  )));
  const maxBooths = Number(form.maxBoothsPerPartner);
  const maxActivities = Number(form.maxActivitiesPerPartner);
  const boothsEnabled = Number.isInteger(maxBooths) && maxBooths > 0;
  const activitiesEnabled = Number.isInteger(maxActivities) && maxActivities > 0;
  const earliestDownstreamDeadline = form.partnerApplicationDeadlineAt
    ? shiftLocalDateTime(form.partnerApplicationDeadlineAt, 24 * 60, 'MINUTES')
    : minimumFutureAt;
  const visibleDateFields = ACTIVE_DATE_FIELDS.filter(field => (
    field.key !== 'boothRequestDeadlineAt' || boothsEnabled
  ) && (
    field.key !== 'activityProposalDeadlineAt' || activitiesEnabled
  ));

  return createPortal(
    <div className="org-modal-backdrop" {...backdropHandlers}>
      <div
        className={`org-modal-box org-event-form-modal${basicInfoOnly ? ' org-event-basic-modal' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-event-form-title"
        aria-describedby="organizer-event-form-description"
        onClick={clickEvent => clickEvent.stopPropagation()}
      >
        <div className="org-modal-header org-event-form-header">
          <div>
            <h3 id="organizer-event-form-title">{basicInfoOnly ? 'Chỉnh sửa thông tin sự kiện' : event ? 'Chỉnh sửa bản nháp' : 'Tạo sự kiện mới'}</h3>
            <p id="organizer-event-form-description">
              {basicInfoOnly ? 'Cập nhật tên sự kiện, mô tả và ảnh banner.' : event
                ? (event.apiStatus === 'DRAFT'
                  ? 'Cập nhật thông tin trước khi công bố sự kiện.'
                  : 'Chỉ các trường thay đổi mới được gửi để giữ nguyên cấu hình vận hành đã khóa.')
                : 'Tạo bản nháp trước, bạn có thể hoàn thiện và công bố sau.'}
            </p>
          </div>
          <button type="button" className="organizer-icon-button" onClick={onClose} disabled={isSaving} aria-label="Đóng"><X size={20} /></button>
        </div>

        <form className="org-event-form" onSubmit={handleSubmit}>
          <div className="org-modal-body org-event-form-body">
            {error && <div ref={errorAlertRef} className="org-event-form-alert" role="alert" tabIndex={-1}><AlertCircle size={18} /> <span>{error}</span></div>}

            <section className="org-event-form-section" aria-labelledby="event-basic-heading">
              <div className="org-event-form-section-heading">
                {!basicInfoOnly && <span className="org-event-form-section-number">1</span>}
                <div><h4 id="event-basic-heading">Thông tin cơ bản</h4></div>
              </div>

              <div className="org-event-form-fields">
                <div className="org-event-form-field org-event-form-field-full">
                  <div className="org-event-form-label">Tên sự kiện <span aria-hidden="true">*</span></div>
                  <input id="event-name" aria-label="Tên sự kiện *" value={form.name} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={describedBy('name')} onChange={changeEvent => updateField('name', changeEvent.target.value)} required />
                  <div className="org-event-field-meta">{renderFieldError('name')}<small>{Array.from(form.name).length}/150</small></div>
                </div>

                <div className="org-event-form-field org-event-form-field-full">
                  <div className="org-event-form-label">Mô tả</div>
                  <textarea id="event-description" aria-label="Mô tả" rows={3} value={form.description} onChange={changeEvent => updateField('description', changeEvent.target.value)} placeholder="Mô tả ngắn về nội dung và mục tiêu của sự kiện" />
                </div>

                {!basicInfoOnly && <><div className="org-event-form-field">
                  <div className="org-event-form-label">Bắt đầu <span aria-hidden="true">*</span></div>
                  <OrganizerDateTimeField
                    id="event-start-at"
                    accessibleLabel={language === 'vi' ? 'Bắt đầu' : 'Start'}
                    value={form.startAt}
                    defaultTime="09:00"
                    min={dateFieldMinimum('startAt', minimumFutureAt)}
                    required
                    invalid={Boolean(fieldErrors.startAt)}
                    describedBy={describedBy('startAt')}
                    onChange={value => updateField('startAt', value)}
                  />
                  {renderFieldError('startAt')}
                </div>
                <div className="org-event-form-field">
                  <div className="org-event-form-label">Thời lượng sự kiện <span aria-hidden="true">*</span></div>
                  <select id="event-end-preset" aria-label="Thời lượng sự kiện" value={endPreset} onChange={changeEvent => updateEndPreset(changeEvent.target.value as EndPreset)}>
                    <option value="SAME_DAY">Trong ngày</option>
                    <option value="PLUS_ONE_DAY">1 ngày</option>
                    <option value="PLUS_TWO_DAYS">2 ngày</option>
                    <option value="PLUS_THREE_DAYS">3 ngày</option>
                    <option value="PLUS_SEVEN_DAYS">7 ngày</option>
                    <option value="CUSTOM">{customDurationLabel(form.startAt, form.endAt, language)}</option>
                  </select>
                  {endPreset === 'CUSTOM' ? (
                    <div className="org-event-custom-end">
                      <OrganizerDateTimeField
                        id="event-end-at"
                        accessibleLabel={language === 'vi' ? 'Kết thúc' : 'End'}
                        value={form.endAt}
                        defaultTime="17:00"
                        min={dateFieldMinimum('endAt', laterLocalDateTime(minimumFutureAt, form.startAt || minimumFutureAt))}
                        required
                        invalid={Boolean(fieldErrors.endAt)}
                        describedBy={describedBy('endAt')}
                        onChange={value => updateField('endAt', value)}
                      />
                    </div>
                  ) : (
                    <div id="event-end-at" className="org-event-end-preview" tabIndex={-1} aria-live="polite">
                      <span>Kết thúc</span>
                      <strong>{formatLocalDateTime(form.endAt, language)}</strong>
                    </div>
                  )}
                  {renderFieldError('endAt')}
                </div></>}

                <div className="org-event-form-field org-event-form-field-full">
                  <div className="org-event-form-label">Ảnh banner</div>
                  <div className="org-event-banner-field">
                    <div className="org-event-banner-controls">
                      <input
                        id="event-banner-file"
                        className="org-event-banner-file-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Ảnh banner"
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
                            onClick={() => {
                              ownedBannerUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
                              ownedBannerUrlsRef.current.clear();
                              setBannerFile(null);
                              setBannerObjectUrl('');
                              setRawBannerUrl('');
                              setRawBannerMeta({ name: 'event-banner.jpg', type: 'image/jpeg' });
                            }}
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
                          aria-label="Liên kết ảnh banner"
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
                    {!bannerObjectUrl && !form.bannerUrl && <div className="org-event-banner-error"><ImageIcon size={24} />Xem trước ảnh</div>}
                  </div>
                  {renderFieldError('bannerUrl')}
                </div>
              </div>
            </section>

            {!basicInfoOnly && <><section className="org-event-form-section org-event-deadline-section" aria-labelledby="event-deadlines-heading">
              <button type="button" className="org-event-form-section-toggle" aria-expanded={isDeadlinesOpen} onClick={() => setIsDeadlinesOpen(open => !open)}>
                <span className="org-event-form-section-number">2</span>
                <span className="org-event-form-section-toggle-copy">
                  <strong id="event-deadlines-heading">Mốc thời hạn</strong>
                  {publishTimelineIssueCount > 0 && (
                    <small className="org-event-section-issue-count">
                      {language === 'vi'
                        ? `${publishTimelineIssueCount} mốc cần sửa trước khi công bố`
                        : `${publishTimelineIssueCount} milestones must be fixed before publishing`}
                    </small>
                  )}
                </span>
                <ChevronDown size={20} className={isDeadlinesOpen ? 'is-open' : ''} />
              </button>

              {isDeadlinesOpen && (
                <div className="org-event-deadline-content">
                  <div className="org-event-deadline-assistant">
                    <strong>{language === 'vi' ? 'Thiết lập nhanh' : 'Quick setup'}</strong>
                    <div className="org-event-deadline-assistant-actions">
                      <select
                        aria-label={language === 'vi' ? 'Mẫu lịch trình' : 'Schedule template'}
                        value={deadlineSchedulePreset}
                        onChange={changeEvent => setDeadlineSchedulePreset(changeEvent.target.value as DeadlineSchedulePreset)}
                      >
                        {(Object.entries(DEADLINE_SCHEDULES) as Array<[DeadlineSchedulePreset, DeadlineScheduleDefinition]>).map(([key, definition]) => (
                          <option key={key} value={key}>{language === 'vi' ? definition.labelVi : definition.labelEn}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={applyDeadlineSchedule}
                        disabled={Boolean(form.startAt) && !deadlineScheduleIsAvailable}
                      >
                        {language === 'vi' ? 'Tạo lịch trình' : 'Generate schedule'}
                      </button>
                    </div>
                    {form.startAt && !deadlineScheduleIsAvailable && (
                      <small className="org-event-deadline-template-unavailable" role="status">
                        {language === 'vi'
                          ? `Mẫu này cần sự kiện còn ít nhất ${selectedScheduleDefinition.minimumLeadDays} ngày. Hãy chọn lịch ngắn hơn hoặc cấu hình thủ công.`
                          : `This template needs an Event at least ${selectedScheduleDefinition.minimumLeadDays} days away. Choose a shorter schedule or configure it manually.`}
                      </small>
                    )}
                  </div>
                  <fieldset>
                    <legend>{language === 'vi' ? 'Thời hạn tiếp nhận' : 'Submission deadlines'}</legend>
                    <div className="org-event-form-fields">
                      {visibleDateFields.map(field => (
                        <div className={`org-event-form-field${publishTimelineIssues[field.key] ? ' has-publish-issue' : ''}`} key={field.key}>
                          <div className="org-event-form-label">{language === 'vi' ? field.vi : field.en}</div>
                          <OrganizerDateTimeField
                            id={FIELD_IDS[field.key]}
                            accessibleLabel={language === 'vi' ? field.vi : field.en}
                            value={form[field.key]}
                            defaultTime="23:59"
                            min={dateFieldMinimum(
                              field.key,
                              field.key === 'boothRequestDeadlineAt'
                                || field.key === 'activityProposalDeadlineAt'
                                ? earliestDownstreamDeadline
                                : minimumFutureAt,
                            )}
                            max={form.startAt || undefined}
                            invalid={Boolean(fieldErrors[field.key])}
                            warning={Boolean(publishTimelineIssues[field.key])}
                            describedBy={describedBy(field.key)}
                            onChange={value => updateField(field.key, value)}
                          />
                          {renderFieldError(field.key)}
                          {renderPublishTimelineIssue(field.key)}
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
                {boothsEnabled && (
                  <div className={`org-event-form-field${publishTimelineIssues.boothPaymentWindowValue ? ' has-publish-issue' : ''}`}>
                    <div className="org-event-form-label">Thời hạn giữ chỗ gian hàng <span aria-hidden="true">*</span></div>
                    <div className="org-event-payment-window">
                      <input id="event-payment-window" aria-label="Thời hạn giữ chỗ gian hàng" type="number" min="1" max={form.boothPaymentWindowUnit === 'DAYS' ? 7 : 168} step="any" value={form.boothPaymentWindowValue} aria-invalid={Boolean(fieldErrors.boothPaymentWindowValue)} aria-describedby={describedBy('boothPaymentWindowValue')} onChange={changeEvent => updateField('boothPaymentWindowValue', changeEvent.target.value)} required />
                      <select id="event-payment-window-unit" aria-label="Đơn vị thời hạn giữ chỗ" value={form.boothPaymentWindowUnit} onChange={changeEvent => updatePaymentWindowUnit(changeEvent.target.value as EventFormState['boothPaymentWindowUnit'])}>
                        <option value="HOURS">Giờ</option>
                        <option value="DAYS">Ngày</option>
                      </select>
                    </div>
                    {renderFieldError('boothPaymentWindowValue')}
                    {renderPublishTimelineIssue('boothPaymentWindowValue')}
                  </div>
                )}
                <div className="org-event-form-field">
                  <div className="org-event-form-label">Số gian hàng tối đa / đối tác <span aria-hidden="true">*</span></div>
                  <input id="event-max-booths" aria-label="Số gian hàng tối đa / đối tác" type="number" min="0" step="1" value={form.maxBoothsPerPartner} aria-invalid={Boolean(fieldErrors.maxBoothsPerPartner)} aria-describedby={describedBy('maxBoothsPerPartner')} onChange={changeEvent => updateField('maxBoothsPerPartner', changeEvent.target.value)} required />
                  {renderFieldError('maxBoothsPerPartner')}
                </div>
                <div className="org-event-form-field">
                  <div className="org-event-form-label">Số hoạt động tối đa / đối tác <span aria-hidden="true">*</span></div>
                  <input id="event-max-activities" aria-label="Số hoạt động tối đa / đối tác" type="number" min="0" step="1" value={form.maxActivitiesPerPartner} aria-invalid={Boolean(fieldErrors.maxActivitiesPerPartner)} aria-describedby={describedBy('maxActivitiesPerPartner')} onChange={changeEvent => updateField('maxActivitiesPerPartner', changeEvent.target.value)} required />
                  {renderFieldError('maxActivitiesPerPartner')}
                </div>
              </div>
            </section>
            </>}
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
            ownedBannerUrlsRef.current.add(previewUrl);
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
