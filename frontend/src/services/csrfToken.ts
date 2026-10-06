import { API_BASE_URL } from './apiConfig';
import { createApiError } from './apiError';

export interface CsrfTokenData {
  headerName: string;
  token: string;
}

let currentCsrfToken: CsrfTokenData | null = null;
let pendingCsrfRequest: Promise<CsrfTokenData> | null = null;

function isCsrfTokenData(value: unknown): value is CsrfTokenData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.headerName === 'string'
    && typeof candidate.token === 'string'
    && candidate.headerName.length > 0
    && candidate.token.length > 0;
}

async function requestCsrfToken(): Promise<CsrfTokenData> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch (cause) {
    throw new Error('Không thể kết nối đến máy chủ để lấy CSRF token.', { cause });
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  const responseBody: unknown = await response.json();
  if (!isCsrfTokenData(responseBody)) {
    throw new Error('Máy chủ trả về CSRF token không hợp lệ.');
  }

  currentCsrfToken = responseBody;
  return responseBody;
}

export async function getCsrfToken(forceRefresh = false): Promise<CsrfTokenData> {
  if (forceRefresh) {
    currentCsrfToken = null;
  }

  if (currentCsrfToken !== null) {
    return currentCsrfToken;
  }

  if (pendingCsrfRequest === null) {
    pendingCsrfRequest = requestCsrfToken().finally(() => {
      pendingCsrfRequest = null;
    });
  }

  return pendingCsrfRequest;
}

export function clearCsrfToken(): void {
  currentCsrfToken = null;
}
