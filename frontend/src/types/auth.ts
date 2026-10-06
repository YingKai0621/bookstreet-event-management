export type RoleCode = 'PARTICIPANT' | 'PARTNER' | 'ORGANIZER' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface AccountResponse {
  userId: number;
  username: string;
  fullName: string;
  email: string | null;
  emailVerified: boolean;
  status: AccountStatus;
  roles: RoleCode[];
}

export interface LoginUserResponse {
  userId: number;
  username: string;
  fullName: string;
  roles: RoleCode[];
}

export interface LoginResponse {
  user: LoginUserResponse;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  email: string | null;
}
