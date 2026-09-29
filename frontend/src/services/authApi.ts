import { apiClient } from './apiClient';

export const authApi = {
  login: (data: { email: string; password: string }) => 
    apiClient.post<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', data),
  getDemoAccounts: () => apiClient.get<Array<{ role: 'participant' | 'partner' | 'organizer' | 'admin'; email: string }>>('/auth/demo-accounts'),
  demoLogin: (role: 'participant' | 'partner' | 'organizer' | 'admin') =>
    apiClient.post<{ user: any; accessToken: string; refreshToken: string }>('/auth/demo-login', { role }),

  register: (data: { email: string; password: string; fullName: string; phone?: string; role?: string }) => 
    apiClient.post<{ user: any; accessToken: string; refreshToken: string }>('/auth/register', data),

  getMe: () => apiClient.get<{ user: any }>('/auth/me'),

  logout: (refreshToken?: string) => apiClient.post('/auth/logout', { refreshToken }),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
};
