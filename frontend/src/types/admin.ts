// Account and role types live in services/adminUsersApi.ts, next to the Sprint 11 contract they follow.

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  avatarInitials: string;
  avatarUrl?: string;
}
