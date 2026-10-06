import { apiClient } from './apiClient';
import type {
  AccountResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from '../types/auth';

export const authApi = {
  login: (request: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', request),

  register: (request: RegisterRequest) =>
    apiClient.post<AccountResponse>('/auth/register', request),

  getMe: () => apiClient.get<AccountResponse>('/auth/me'),

  logout: () => apiClient.post<void>('/auth/logout'),
};
