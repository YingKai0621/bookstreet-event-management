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
  const token = localStorage.getItem('duongsach_token') || sessionStorage.getItem('duongsach_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    if (response.status === 401) {
      localStorage.removeItem('duongsach_token');
      sessionStorage.removeItem('duongsach_token');
      localStorage.removeItem('duongsach_admin_auth_v1');
      sessionStorage.removeItem('duongsach_admin_auth_v1');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorMsg = body?.error?.message || (typeof body?.error === 'string' ? body.error : 'Không thể tải dữ liệu. Vui lòng kiểm tra máy chủ API.');
    throw new Error(errorMsg);
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

