import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function PartnerDialog({ title, children, onClose }: {
  title: string; children: ReactNode; onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(true, onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ) || []).filter(element => element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, []);
  const mouseDownTargetRef = useRef<EventTarget | null>(null);
  return <div className="partner-dialog-backdrop" onMouseDown={event => {
    mouseDownTargetRef.current = event.target;
  }} onClick={event => {
    if (event.target === event.currentTarget && mouseDownTargetRef.current === event.currentTarget) onClose();
    mouseDownTargetRef.current = null;
  }}>
    <div className="partner-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="partner-square-button" aria-label="Đóng" onClick={onClose}><X size={20} /></button></header>
      {children}
    </div>
  </div>;
}
