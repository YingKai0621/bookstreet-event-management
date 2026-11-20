import { ApiError } from '../../services/apiClient';
import { PartnerEventApplication } from '../../types';

export const PARTNER_APPLICATION_STATUS_LABELS: Record<PartnerEventApplication['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  withdrawn: 'Đã rút',
};

export function formatPartnerEventDateTime(value: string | null | undefined): string {
  if (!value) return 'Đang cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function partnerEventTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function partnerApplicationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Không thể xử lý hồ sơ đăng ký.';
  }

  switch (error.code) {
    case 'PARTNER_ORGANIZATION_INACTIVE':
      return 'Tổ chức đang bị khóa; hiện không thể gửi yêu cầu mới.';
    case 'PARTNER_ORGANIZATION_REQUIRED':
      return 'Bạn cần hoàn thiện một hồ sơ tổ chức đang hoạt động trước khi đăng ký.';
    case 'EVENT_NOT_ACCEPTING_APPLICATIONS':
      return 'Sự kiện này hiện không nhận hồ sơ đối tác.';
    case 'APPLICATION_DEADLINE_PASSED':
      return 'Đã hết hạn đăng ký đối tác cho sự kiện này.';
    case 'APPLICATION_ALREADY_EXISTS':
      return 'Tổ chức đã có hồ sơ cho sự kiện này và không thể đăng ký lần hai.';
    case 'APPLICATION_NOT_PENDING':
      return 'Chỉ hồ sơ đang chờ duyệt mới có thể rút.';
    default:
      return error.message;
  }
}
