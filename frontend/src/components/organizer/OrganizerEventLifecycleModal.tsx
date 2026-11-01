import { AlertTriangle, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { useBackdropClick } from '../../hooks/useBackdropClick';
import type { Language } from '../../types';
import type { OrganizerEvent } from '../../types/organizer';

export type EventLifecycleAction = 'cancel' | 'delete';

interface OrganizerEventLifecycleModalProps {
  language: Language;
  event: OrganizerEvent | null;
  action: EventLifecycleAction | null;
  isSubmitting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export const OrganizerEventLifecycleModal: React.FC<OrganizerEventLifecycleModalProps> = ({
  language,
  event,
  action,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isOpen = Boolean(event && action);
  const isCancellation = action === 'cancel';
  const vi = language === 'vi';

  useModalDismiss(isOpen, () => { if (!isSubmitting) onClose(); });
  const backdropHandlers = useBackdropClick(() => { if (!isSubmitting) onClose(); });

  useEffect(() => {
    if (!isOpen) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [action, event?.id, isOpen]);

  if (!event || !action) return null;

  const submit = () => {
    const normalizedReason = reason.trim().replace(/\s+/g, ' ');
    if (isCancellation && (normalizedReason.length < 10 || normalizedReason.length > 500)) {
      setValidationError(vi
        ? 'Lý do hủy phải có từ 10 đến 500 ký tự.'
        : 'Cancellation reason must contain between 10 and 500 characters.');
      return;
    }
    setValidationError('');
    void onConfirm(normalizedReason);
  };

  const title = isCancellation
    ? (vi ? 'Hủy sự kiện' : 'Cancel event')
    : (vi ? 'Xóa bản nháp' : 'Delete draft');
  const description = isCancellation
    ? (vi
      ? 'Thao tác này sẽ áp dụng quy trình hủy và đóng các đăng ký liên quan theo quy tắc hệ thống.'
      : 'This applies the cancellation workflow and closes related registrations according to system rules.')
    : (vi
      ? 'Bản nháp sẽ bị xóa vĩnh viễn nếu chưa có dữ liệu nghiệp vụ phụ thuộc.'
      : 'The draft will be permanently deleted if it has no dependent business records.');

  return createPortal(
    <div className="org-modal-backdrop" {...backdropHandlers}>
      <section
        className="org-modal-box org-event-lifecycle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-event-lifecycle-title"
        aria-describedby="organizer-event-lifecycle-description"
        onClick={clickEvent => clickEvent.stopPropagation()}
      >
        <header className="org-modal-header org-event-lifecycle-header">
          <span className="org-event-lifecycle-icon" aria-hidden="true">
            {isCancellation ? <AlertTriangle size={21} /> : <Trash2 size={20} />}
          </span>
          <div className="org-event-lifecycle-heading">
            <h3 id="organizer-event-lifecycle-title" ref={titleRef} tabIndex={-1}>{title}</h3>
            <p>{event.title}</p>
          </div>
          <button type="button" className="organizer-icon-button" onClick={onClose} disabled={isSubmitting} aria-label={vi ? 'Đóng' : 'Close'}><X size={20} /></button>
        </header>

        <div className="org-modal-body org-event-lifecycle-body">
          <p id="organizer-event-lifecycle-description">{description}</p>
          {isCancellation && (
            <label className="org-event-lifecycle-reason">
              <span>{vi ? 'Lý do hủy' : 'Cancellation reason'} <strong aria-hidden="true">*</strong></span>
              <textarea
                value={reason}
                onChange={changeEvent => setReason(changeEvent.target.value)}
                rows={4}
                maxLength={500}
                disabled={isSubmitting}
                aria-invalid={Boolean(validationError)}
                placeholder={vi ? 'Nhập lý do rõ ràng để lưu vào lịch sử sự kiện...' : 'Enter a clear reason for the event history...'}
              />
              <small>{reason.trim().length}/500</small>
            </label>
          )}
          {(validationError || error) && <div className="org-event-lifecycle-error" role="alert">{validationError || error}</div>}
        </div>

        <footer className="org-modal-footer">
          <button type="button" className="btn-org-secondary" onClick={onClose} disabled={isSubmitting}>{vi ? 'Quay lại' : 'Go back'}</button>
          <button type="button" className="btn-org-danger" onClick={submit} disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting
              ? (vi ? 'Đang xử lý...' : 'Processing...')
              : isCancellation
                ? (vi ? 'Xác nhận hủy' : 'Confirm cancellation')
                : (vi ? 'Xóa bản nháp' : 'Delete draft')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
