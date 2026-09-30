const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('duongsach_token') || sessionStorage.getItem('duongsach_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = String(options.method || 'GET').toUpperCase();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      cache: method === 'GET' ? 'no-store' : options.cache,
    });
  } catch (cause) {
    throw new Error('Không thể kết nối đến máy chủ dữ liệu.', { cause });
  }

  if (response.status === 401) {
    localStorage.removeItem('duongsach_token');
    sessionStorage.removeItem('duongsach_token');
    localStorage.removeItem('duongsach_admin_auth_v1');
    sessionStorage.removeItem('duongsach_admin_auth_v1');
    localStorage.removeItem('duongsach_partner_auth_v1');
    sessionStorage.removeItem('duongsach_partner_auth_v1');
    localStorage.removeItem('duongsach_participant_auth_v1');
    sessionStorage.removeItem('duongsach_participant_auth_v1');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const json: ApiResponse<T> = await response.json().catch(() => ({ success: false, data: {} as T, error: { code: 'INVALID_JSON', message: 'Phản hồi từ máy chủ không hợp lệ' } }));

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'Có lỗi xảy ra khi gọi API');
  }

  if (method !== 'GET') {
    window.dispatchEvent(new Event('duongsach:data-changed'));
    window.dispatchEvent(new Event('participant:data-changed'));
  }

  return json.data;
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
