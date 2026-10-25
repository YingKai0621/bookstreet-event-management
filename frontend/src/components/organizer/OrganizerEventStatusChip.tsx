import React from 'react';
import { Language } from '../../types';
import { OrganizerEventStatus } from '../../types/organizer';

const STATUS_LABELS: Record<OrganizerEventStatus, { vi: string; en: string }> = {
  DRAFT: { vi: 'Bản nháp', en: 'Draft' },
  PUBLISHED: { vi: 'Đã công bố', en: 'Published' },
  ONGOING: { vi: 'Đang diễn ra', en: 'Ongoing' },
  COMPLETED: { vi: 'Đã kết thúc', en: 'Completed' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
};

interface OrganizerEventStatusChipProps {
  language: Language;
  status: OrganizerEventStatus;
  className?: string;
}

export const OrganizerEventStatusChip: React.FC<OrganizerEventStatusChipProps> = ({
  language,
  status,
  className = '',
}) => (
  <span className={`org-chip org-event-status-chip status-${status.toLowerCase()} ${className}`.trim()}>
    <span className="org-event-status-dot" aria-hidden="true" />
    {STATUS_LABELS[status][language === 'vi' ? 'vi' : 'en']}
  </span>
);
