import { API_BASE_URL } from './apiConfig';
import { ApiError, createApiError } from './apiError';
import { clearCsrfToken, getCsrfToken } from './csrfToken';
import { publishParticipationChange } from './participationSync';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const inFlightGetRequests = new Map<string, Promise<unknown>>();

export interface BinaryDownload {
  blob: Blob;
  filename?: string;
}

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

function downloadFilename(response: Response): string | undefined {
  const disposition = response.headers.get('Content-Disposition');
  if (!disposition) return undefined;

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }

  return disposition.match(/filename="?([^";]+)"?/i)?.[1];
}

async function downloadBinary(endpoint: string): Promise<BinaryDownload> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { Accept: 'application/pdf' },
      credentials: 'include',
      cache: 'no-store',
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

  if (response.status === 401) notifyAuthenticationRequired();
  if (!response.ok) throw await createApiError(response);

  return {
    blob: await response.blob(),
    filename: downloadFilename(response),
  };
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
    publishParticipationChange(endpoint);
  }

  return responseBody;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET' || options.signal) {
    return sendRequest<T>(endpoint, options, true);
  }

  const headerKey = [...new Headers(options.headers).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value}`)
    .join('|');
  const requestKey = `${endpoint}|${headerKey}`;
  const existing = inFlightGetRequests.get(requestKey);
  if (existing) return existing as Promise<T>;

  const pending = sendRequest<T>(endpoint, options, true);
  inFlightGetRequests.set(requestKey, pending);
  try {
    return await pending;
  } finally {
    if (inFlightGetRequests.get(requestKey) === pending) {
      inFlightGetRequests.delete(requestKey);
    }
  }
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
  postForm: <T>(endpoint: string, body: FormData, headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'POST', body, headers }),
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
  download: downloadBinary,
  request,
  refreshCsrfToken: () => getCsrfToken(true),
  clearCsrfToken,
};

export { ApiError } from './apiError';
