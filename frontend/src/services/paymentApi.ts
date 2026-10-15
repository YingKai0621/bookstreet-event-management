import type { PageResponse } from '../types/booth';
import type {
  BoothAssignment,
  BoothPayment,
  PaymentInitiationResponse,
} from '../types/payment';
import { apiClient } from './apiClient';

function withQuery(path: string, values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const paymentApi = {
  async listAllPayments(boothRequestId: number): Promise<BoothPayment[]> {
    const items: BoothPayment[] = [];
    let page = 0;
    let totalPages = 1;
    do {
      const result = await apiClient.get<PageResponse<BoothPayment>>(
        withQuery(`/partner/booth-requests/${boothRequestId}/payments`, {
          page, size: 100, sort: 'createdAt,desc',
        }),
      );
      items.push(...result.content);
      totalPages = result.totalPages;
      page++;
    } while (page < totalPages);
    return items;
  },
  /**
   * Tạo phiên thanh toán mới hoặc replay idempotent cho yêu cầu gian hàng đã được chọn (SELECTED).
   * Gửi kèm UUID Idempotency-Key trong header.
   */
  initiatePayment: (boothRequestId: number, idempotencyKey: string) =>
    apiClient.post<PaymentInitiationResponse>(
      `/partner/booth-requests/${boothRequestId}/payments`,
      undefined,
      { 'Idempotency-Key': idempotencyKey },
    ),

  /**
   * Lấy danh sách các lần thử thanh toán cho một booth request.
   */
  listPayments: (
    boothRequestId: number,
    params: { page?: number; size?: number; sort?: string } = {},
  ) =>
    apiClient.get<PageResponse<BoothPayment>>(
      withQuery(`/partner/booth-requests/${boothRequestId}/payments`, {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'createdAt,desc',
      }),
    ),

  /**
   * Lấy chi tiết một phiên thanh toán theo boothPaymentId.
   */
  getPayment: (paymentId: number) =>
    apiClient.get<BoothPayment>(`/partner/booth-payments/${paymentId}`),

  /**
   * Lấy thông tin BoothAssignment đã được tạo sau khi thanh toán thành công.
   */
  getAssignment: (boothRequestId: number) =>
    apiClient.get<BoothAssignment>(`/partner/booth-requests/${boothRequestId}/assignment`),
};

