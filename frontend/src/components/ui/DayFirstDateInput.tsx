import { CalendarDays } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import './DayFirstDateInput.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  type: 'date' | 'datetime-local';
  value: string;
};

// Keep native ISO values, validation and picker behavior; only the visible label changes.
export function DayFirstDateInput({ type, value, style, onClick, ...props }: Props) {
  const [date, time] = value.split('T');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const label = match ? `${match[3]}/${match[2]}/${match[1]}` : 'dd/mm/yyyy';
  return (
    <span className="day-first-date-input" style={style} data-disabled={props.disabled || undefined}>
      <input {...props} type={type} value={value} style={{ ...style, width: '100%', opacity: 0 }}
        onClick={event => {
          onClick?.(event);
          if (event.defaultPrevented || props.readOnly || props.disabled) return;
          try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard input remains available. */ }
        }}
      />
      <span className="day-first-date-label" aria-hidden="true">
        <span>{label}{type === 'datetime-local' ? ` ${time?.slice(0, 5) || 'HH:mm'}` : ''}</span>
        <CalendarDays size={16} />
      </span>
    </span>
  );
}
