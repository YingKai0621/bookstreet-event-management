import type {
  AccountResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from '../types/auth';
import { apiClient } from './apiClient';

export const authApi = {
  login: (request: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', request),

  register: (request: RegisterRequest) =>
    apiClient.post<AccountResponse>('/auth/register', request),

  getMe: () => apiClient.get<AccountResponse>('/auth/me'),

  logout: () => apiClient.post<void>('/auth/logout'),
  resendEmailVerification: () => apiClient.post<void>('/auth/email-verification/resend'),
  confirmEmailVerification: (token: string) => apiClient.post<void>('/auth/email-verification/confirm', { token }),
};
