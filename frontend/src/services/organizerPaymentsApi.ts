import type { BoothPaymentStatus } from '../types/payment';
import { apiClient } from './apiClient';

/** AC-ORG-PAY-S11-01: Booth Payments of the Events the signed-in Organizer owns, read-only. */
export type OrganizerPaymentSort = 'createdAt,desc' | 'createdAt,asc' | 'amount,desc' | 'amount,asc';

export interface OrganizerBoothPayment {
  boothPaymentId: number;
  event: { eventId: number; name: string };
  partnerOrganization: { partnerOrganizationId: number; name: string };
  booth: { boothId: number; code: string; name: string };
  transactionType: 'PAYMENT' | 'REFUND';
  amount: number;
  status: BoothPaymentStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface OrganizerBoothPaymentPage {
  content: OrganizerBoothPayment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  /** Successful payments under the same filters, ignoring the status filter. */
  collectedAmount: number;
}

export interface OrganizerPaymentQuery {
  page?: number;
  size?: number;
  status?: BoothPaymentStatus;
  eventId?: number;
  search?: string;
  from?: string;
  to?: string;
  sort?: OrganizerPaymentSort;
}

export const ORGANIZER_PAYMENT_STATUS_LABELS: Record<BoothPaymentStatus, string> = {
  PENDING: 'Đang chờ',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  TIMEOUT: 'Hết hạn',
};

export const organizerPaymentsApi = {
  list(query: OrganizerPaymentQuery = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 0),
      size: String(query.size ?? 20),
      sort: query.sort ?? 'createdAt,desc',
    });
    if (query.status) params.set('status', query.status);
    if (query.eventId) params.set('eventId', String(query.eventId));
    const search = query.search?.trim();
    if (search) params.set('search', search);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    return apiClient.get<OrganizerBoothPaymentPage>(`/organizer/booth-payments?${params}`);
  },
};
