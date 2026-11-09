import type { BoothPaymentStatus } from '../types/payment';
import { apiClient } from './apiClient';

/** AC-OPT-S11-01: Admin reads Booth Payments across Events and cannot change them. */
export type AdminPaymentSort = 'createdAt,desc' | 'createdAt,asc' | 'amount,desc' | 'amount,asc';

export interface AdminBoothPayment {
  boothPaymentId: number;
  event: { eventId: number; name: string };
  partnerOrganization: { partnerOrganizationId: number; name: string };
  booth: { boothId: number; code: string; name: string };
  transactionType: 'PAYMENT' | 'REFUND';
  amount: number;
  status: BoothPaymentStatus;
  reconciliationRequired: boolean;
  gatewayProvider: string;
  gatewayTransactionRef: string | null;
  failureCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminBoothPaymentPage {
  content: AdminBoothPayment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminPaymentQuery {
  page?: number;
  size?: number;
  status?: BoothPaymentStatus;
  eventId?: number;
  reconciliationRequired?: boolean;
  search?: string;
  from?: string;
  to?: string;
  sort?: AdminPaymentSort;
}

export const ADMIN_PAYMENT_STATUS_LABELS: Record<BoothPaymentStatus, string> = {
  PENDING: 'Đang chờ',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  TIMEOUT: 'Hết hạn',
};

export const ADMIN_PAYMENT_TYPE_LABELS: Record<AdminBoothPayment['transactionType'], string> = {
  PAYMENT: 'Thanh toán',
  REFUND: 'Hoàn tiền',
};

export const adminPaymentsApi = {
  list(query: AdminPaymentQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: query.sort ?? 'createdAt,desc',
    });
    if (query.status) params.set('status', query.status);
    if (query.eventId) params.set('eventId', String(query.eventId));
    if (query.reconciliationRequired !== undefined) {
      params.set('reconciliationRequired', String(query.reconciliationRequired));
    }
    const search = query.search?.trim();
    if (search) params.set('search', search);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    return apiClient.get<AdminBoothPaymentPage>(`/admin/booth-payments?${params}`);
  },
};
