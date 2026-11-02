import { CalendarDays, Clock3 } from 'lucide-react';
import { useRef } from 'react';

interface OrganizerDateTimeFieldProps {
  id: string;
  accessibleLabel: string;
  value: string;
  defaultTime: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  warning?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

function parts(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

function dateOnly(value: string | undefined): string | undefined {
  return value ? value.split('T')[0] : undefined;
}

function displayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'dd/mm/yyyy';
}

function validPartialTime(value: string): boolean {
  if (!/^\d{0,2}(?::\d{0,2})?$/.test(value)) return false;
  const [hour = '', minute] = value.split(':');
  if (hour.length === 2 && Number(hour) > 23) return false;
  if (minute !== undefined && hour.length === 0) return false;
  if (minute?.length === 2 && Number(minute) > 59) return false;
  return true;
}

export function OrganizerDateTimeField({
  id,
  accessibleLabel,
  value,
  defaultTime,
  min,
  max,
  required = false,
  disabled = false,
  invalid = false,
  warning = false,
  describedBy,
  onChange,
}: OrganizerDateTimeFieldProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const current = parts(value);

  const updateTime = (rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9:]/g, '').slice(0, 5);
    const digitsOnly = cleaned.replace(/:/g, '');
    const formatted = cleaned.includes(':') || digitsOnly.length <= 2
      ? cleaned
      : `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)}`;
    if (!validPartialTime(formatted)) return;
    onChange(`${current.date}T${formatted}`);
  };

  const normalizeTime = () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(current.time);
    if (!match) return;
    const normalized = `${match[1].padStart(2, '0')}:${match[2]}`;
    if (normalized !== current.time) onChange(`${current.date}T${normalized}`);
  };

  return (
    <div
      className="org-local-datetime"
      data-invalid={invalid || undefined}
      data-warning={!invalid && warning ? true : undefined}
    >
      <div
        className="org-local-date-control"
        onClick={() => {
          if (disabled) return;
          const input = dateInputRef.current;
          if (!input) return;
          input.focus({ preventScroll: true });
          try {
            input.showPicker?.();
          } catch {
            // The field remains focused if the browser does not expose its native picker.
          }
        }}
      >
        <span className={current.date ? '' : 'is-placeholder'} aria-hidden="true">
          {displayDate(current.date)}
        </span>
        <CalendarDays size={18} aria-hidden="true" />
        <input
          ref={dateInputRef}
          id={id}
          type="date"
          lang="vi"
          value={current.date}
          min={dateOnly(min)}
          max={dateOnly(max)}
          required={required}
          disabled={disabled}
          aria-label={`${accessibleLabel} - ngày`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={event => {
            const date = event.target.value;
            onChange(date ? `${date}T${current.time || defaultTime}` : '');
          }}
        />
      </div>
      <div className="org-local-time-control">
        <Clock3 size={17} aria-hidden="true" />
        <input
          id={`${id}-time`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
          placeholder="HH:mm"
          title="Nhập giờ theo định dạng 24 giờ HH:mm"
          value={current.time}
          required={required}
          disabled={disabled || !current.date}
          aria-label={`${accessibleLabel} - giờ`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={event => updateTime(event.target.value)}
          onBlur={normalizeTime}
        />
      </div>
    </div>
  );
}
