import { createContext } from 'react';
import type { AccountResponse, LoginRequest, RegisterRequest, RoleCode } from '../types/auth';

export type AuthenticationStatus = 'loading' | 'authenticated' | 'guest';

export interface AuthContextValue {
  status: AuthenticationStatus;
  user: AccountResponse | null;
  initializationError: string | null;
  login: (request: LoginRequest) => Promise<AccountResponse>;
  register: (request: RegisterRequest) => Promise<AccountResponse>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<AccountResponse | null>;
  hasRole: (role: RoleCode) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
