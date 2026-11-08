import { AdminProfile } from '../types/admin';
import { apiClient } from './apiClient';

/** The Admin profile reads and updates through the shared /auth/profile API (AC-ADM-S11-03). */
interface ProfileResponse {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface AdminProfileUpdate {
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
}

function toProfile(user: ProfileResponse): AdminProfile {
  return {
    id: String(user.id),
    name: user.fullName,
    email: user.email ?? '',
    emailVerified: user.emailVerified,
    phone: user.phone ?? '',
    avatarUrl: user.avatarUrl || undefined,
    avatarInitials: user.fullName.split(' ').filter(Boolean).map(part => part[0]).slice(-2).join('').toUpperCase(),
  };
}

export const adminProfileApi = {
  async get(): Promise<AdminProfile> {
    return toProfile(await apiClient.get<ProfileResponse>('/auth/profile'));
  },
  async update(update: AdminProfileUpdate): Promise<AdminProfile> {
    return toProfile(await apiClient.put<ProfileResponse>('/auth/profile', update));
  },
};
