import type { BoothPaymentStatus } from '../types/payment';

export const paymentStatusLabel: Record<BoothPaymentStatus, string> = {
  PENDING: 'Đang chờ xác nhận',
  SUCCESS: 'Thanh toán thành công',
  FAILED: 'Thanh toán thất bại',
  TIMEOUT: 'Phiên thanh toán đã hết hạn',
};

export function paymentMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

export function paymentTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  }) : '—';
}

export function positiveId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
