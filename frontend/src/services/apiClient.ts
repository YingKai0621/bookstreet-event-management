import { API_BASE_URL } from './apiConfig';
import { ApiError, createApiError } from './apiError';
import { clearCsrfToken, getCsrfToken } from './csrfToken';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method);
}

function createRequestHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const hasRequestBody = options.body !== undefined && options.body !== null;
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasRequestBody && !isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

async function parseSuccessfulResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (responseText.length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_JSON_RESPONSE',
      'Phản hồi từ máy chủ không phải JSON hợp lệ.',
      [],
      undefined,
      response.url,
    );
  }
}

function notifyAuthenticationRequired(): void {
  window.dispatchEvent(new Event('auth:unauthorized'));
}

function notifyDataChanged(): void {
  window.dispatchEvent(new Event('duongsach:data-changed'));
  window.dispatchEvent(new Event('participant:data-changed'));
}

async function sendRequest<T>(
  endpoint: string,
  options: RequestInit,
  allowCsrfRetry: boolean,
): Promise<T> {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = createRequestHeaders(options);

  if (isMutationMethod(method)) {
    const csrfToken = await getCsrfToken();
    headers.set(csrfToken.headerName, csrfToken.token);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
      cache: method === 'GET' ? 'no-store' : options.cache,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Không thể kết nối đến máy chủ dữ liệu.',
      [],
      undefined,
      endpoint,
    );
  }

  if (response.status === 403 && isMutationMethod(method) && allowCsrfRetry) {
    clearCsrfToken();
    await getCsrfToken(true);
    return sendRequest<T>(endpoint, options, false);
  }

  if (response.status === 401) {
    notifyAuthenticationRequired();
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  const responseBody = await parseSuccessfulResponse<T>(response);

  if (isMutationMethod(method)) {
    notifyDataChanged();
  }

  return responseBody;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return sendRequest<T>(endpoint, options, true);
}

export const apiClient = {
  get: <T>(endpoint: string, headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'GET', headers }),
  post: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),
  put: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),
  patch: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),
  delete: <T>(endpoint: string, headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'DELETE', headers }),
  request,
  refreshCsrfToken: () => getCsrfToken(true),
  clearCsrfToken,
};

export { ApiError } from './apiError';
