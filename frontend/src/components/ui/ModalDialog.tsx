import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './ModalDialog.css';

export interface ModalDialogProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number | string;
  className?: string;
  headerAction?: ReactNode;
}

export function ModalDialog({
  title,
  subtitle,
  isOpen,
  onClose,
  children,
  footer,
  maxWidth = 640,
  className = '',
  headerAction,
}: ModalDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalDismiss(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) || [],
      ).filter(element => element.getClientRects().length > 0);

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-dialog-backdrop"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-dialog-container ${className}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }}
      >
        <header className="modal-dialog-header">
          <div>
            <h2 id={titleId} className="modal-dialog-title">
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#556B65' }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="modal-dialog-header-right">
            {headerAction}
            <button
              type="button"
              className="modal-dialog-close-btn"
              aria-label="Đóng hộp thoại"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="modal-dialog-body">
          {children}
        </div>

        {footer && (
          <footer style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid #E2EAE5',
            background: '#F8FAF9'
          }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
