import { ChevronDown } from 'lucide-react';
import { useId, useRef, useState, type ComponentType } from 'react';

export function PartnerFilterSelect<T extends string>({ label, ariaLabel, icon: Icon, value, options, onChange, labelVisible = false }: {
  label: string;
  ariaLabel: string;
  icon: ComponentType<{ size?: number }>;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  labelVisible?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selected = options.find(option => option.value === value) || options[0];
  return <div className={`event-hub-select-field${labelVisible ? ' has-visible-label' : ''}`}>
    <span>{label}</span>
    <div className="event-hub-select-control" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
    }} onKeyDown={event => {
      if (event.key === 'Escape') { setIsOpen(false); triggerRef.current?.focus(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const control = event.currentTarget;
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setIsOpen(true);
        requestAnimationFrame(() => {
          const buttons = Array.from(control.querySelectorAll<HTMLButtonElement>('[role="option"]'));
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(current + direction + buttons.length) % buttons.length]?.focus();
        });
      }
    }}>
      <button ref={triggerRef} type="button" className="event-hub-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={menuId} onClick={() => setIsOpen(current => !current)}>
        <Icon size={15} /><span>{selected.label}</span><ChevronDown size={15} aria-hidden="true" />
      </button>
      {isOpen && <div id={menuId} className="event-hub-select-menu" role="listbox" aria-label={ariaLabel}>
        {options.map(option => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'is-selected' : ''} key={option.value} onClick={() => {
          onChange(option.value); setIsOpen(false); triggerRef.current?.focus();
        }}>{option.label}</button>)}
      </div>}
    </div>
  </div>;
}
