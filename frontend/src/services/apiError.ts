export interface ApiFieldError {
  field: string;
  message: string;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
  fieldErrors?: ApiFieldError[];
  timestamp?: string;
  path?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiFieldError[];
  readonly timestamp?: string;
  readonly path?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: ApiFieldError[] = [],
    timestamp?: string,
    path?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.timestamp = timestamp;
    this.path = path;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null;
}

export async function createApiError(response: Response): Promise<ApiError> {
  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  if (!isApiErrorBody(responseBody)) {
    return new ApiError(
      response.status,
      'INVALID_ERROR_RESPONSE',
      `Máy chủ trả về lỗi HTTP ${response.status}.`,
    );
  }

  return new ApiError(
    response.status,
    responseBody.code || 'REQUEST_FAILED',
    responseBody.message || `Máy chủ trả về lỗi HTTP ${response.status}.`,
    Array.isArray(responseBody.fieldErrors) ? responseBody.fieldErrors : [],
    responseBody.timestamp,
    responseBody.path,
  );
}
