import { LogOut, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import type { Language } from '../../types';
import './LeaveEventDialog.css';

interface LeaveEventDialogProps {
  eventName: string;
  language: Language;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function LeaveEventDialog({ eventName, language, onConfirm, onClose }: LeaveEventDialogProps) {
  const vi = language === 'vi';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useModalScrollLock(true);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    stayRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (vi ? 'Chưa thể rời sự kiện. Vui lòng thử lại.' : 'Unable to leave the event. Please try again.'));
    } finally {
      setPending(false);
    }
  };

  return createPortal(
    <dialog ref={dialogRef} className="leave-event-dialog" role="alertdialog" aria-labelledby={titleId} aria-describedby={`${descriptionId}-prompt ${descriptionId}`} aria-busy={pending}
      onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
      <button type="button" className="leave-event-close" aria-label={vi ? 'Đóng xác nhận' : 'Close confirmation'} disabled={pending} onClick={onClose}><X size={19} aria-hidden="true" /></button>
      <div className="leave-event-header">
        <span className="leave-event-icon" aria-hidden="true"><LogOut size={23} /></span>
        <div className="leave-event-heading">
          <h2 id={titleId}>{vi ? 'Rời sự kiện?' : 'Leave this event?'}</h2>
          <p id={`${descriptionId}-prompt`}>{vi ? 'Bạn có chắc muốn rời sự kiện này?' : 'Are you sure you want to leave this event?'}</p>
        </div>
      </div>
      <div id={descriptionId}>
        <strong className="leave-event-name">{eventName}</strong>
        <p className="leave-event-note">{vi ? 'Sự kiện sẽ không còn trong mục Đang tham gia. Bạn có thể đăng ký lại nếu vẫn còn hạn đăng ký.' : 'The event will leave your joined events list. You can rejoin while registration remains open.'}</p>
      </div>
      {error && <p className="leave-event-error" role="alert">{error}</p>}
      <div className="leave-event-actions">
        <button ref={stayRef} type="button" className="leave-event-stay" disabled={pending} onClick={onClose}>{vi ? 'Ở lại' : 'Stay'}</button>
        <button type="button" className="leave-event-confirm" disabled={pending} onClick={() => void confirm()}>{pending ? (vi ? 'Đang rời sự kiện...' : 'Leaving...') : (vi ? 'Rời sự kiện' : 'Leave event')}</button>
      </div>
    </dialog>, document.body,
  );
}
