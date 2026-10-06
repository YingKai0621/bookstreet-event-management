export type FacilityKind = 'venues' | 'assets' | 'booths';
export interface Facility {
  id: string;
  name: string;
  campus: string;
  capacity: number;
  totalQuantity: number;
  createdAt: string;
  status?: 'available' | 'pending' | 'assigned';
}
export type FacilityInput = Pick<Facility, 'name'> & Partial<Pick<Facility, 'campus' | 'capacity' | 'totalQuantity'>>;

export async function facilityRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(`/admin/${path}`, options);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = await getCsrfToken();
    headers.set(csrfToken.headerName, csrfToken.token);
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorMsg = body?.message || body?.error?.message || (typeof body?.error === 'string' ? body.error : 'Không thể tải dữ liệu. Vui lòng kiểm tra máy chủ API.');
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!body) {
    throw new Error('Máy chủ không trả về dữ liệu hợp lệ.');
  }

  // Nếu body theo chuẩn ApiResponse { success, data, meta: { campuses, ... } }
  if (body.success !== undefined) {
    if (!body.success) {
      throw new Error(body?.error?.message || 'Có lỗi xảy ra khi gọi API');
    }
    // Trả về { data, campuses } tương thích với FacilityManagementView
    return {
      data: body.data,
      campuses: body.meta?.campuses || [],
      ...body,
    } as unknown as T;
  }

  return body;
}

import { API_BASE_URL } from './apiConfig';
import { getCsrfToken } from './csrfToken';
