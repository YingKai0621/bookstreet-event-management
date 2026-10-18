export type ActivityRecordKind =
  | 'activity'
  | 'proposal'
  | 'changeRequest'
  | 'cancellationRequest';

export type ActivityStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const LABELS: Record<ActivityRecordKind, Record<string, string>> = {
  activity: {
    DRAFT: 'Bản nháp',
    PUBLISHED: 'Đã công bố',
    ONGOING: 'Đang diễn ra',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
  },
  proposal: {
    PENDING: 'Chờ duyệt đề xuất',
    NEED_CHANGES: 'Cần bổ sung',
    APPROVED: 'Đã duyệt đề xuất',
    REJECTED: 'Đã từ chối đề xuất',
    WITHDRAWN: 'Đã rút đề xuất',
    CANCELLED: 'Đã đóng hồ sơ',
  },
  changeRequest: {
    PENDING: 'Chờ duyệt thay đổi',
    APPROVED: 'Đã áp dụng thay đổi',
    REJECTED: 'Đã từ chối thay đổi',
    WITHDRAWN: 'Đã rút yêu cầu',
    CANCELLED: 'Đã đóng tự động',
  },
  cancellationRequest: {
    PENDING: 'Chờ duyệt hủy',
    APPROVED: 'Đã chấp nhận hủy',
    REJECTED: 'Đã từ chối hủy',
    WITHDRAWN: 'Đã rút yêu cầu',
    CANCELLED: 'Đã đóng tự động',
  },
};

export function activityStatusLabel(kind: ActivityRecordKind, status: string): string {
  return LABELS[kind][status] || status;
}

export function activityStatusTone(
  kind: ActivityRecordKind,
  status: string,
): ActivityStatusTone {
  if (kind === 'activity') {
    if (['PUBLISHED', 'ONGOING', 'COMPLETED'].includes(status)) return 'success';
    if (status === 'DRAFT') return 'warning';
    if (status === 'CANCELLED') return 'danger';
    return 'neutral';
  }
  if (kind === 'proposal') {
    if (status === 'APPROVED') return 'success';
    if (['PENDING', 'NEED_CHANGES'].includes(status)) return 'warning';
    if (status === 'REJECTED') return 'danger';
    return 'neutral';
  }
  if (kind === 'changeRequest') {
    if (status === 'APPROVED') return 'success';
    if (status === 'PENDING') return 'warning';
    if (status === 'REJECTED') return 'danger';
    return 'neutral';
  }
  if (status === 'PENDING') return 'warning';
  if (['APPROVED', 'REJECTED'].includes(status)) return 'danger';
  return 'neutral';
}

export function cancellationSourceLabel(source: string | null | undefined): string {
  const labels: Record<string, string> = {
    ORGANIZER: 'Ban tổ chức',
    PARTNER_REQUEST: 'Theo yêu cầu của đối tác',
    EVENT_CANCELLATION: 'Do sự kiện bị hủy',
    SYSTEM: 'Hệ thống',
  };
  return source ? labels[source] || source : 'Không xác định';
}
