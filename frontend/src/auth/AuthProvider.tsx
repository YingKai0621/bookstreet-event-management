import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../services/apiClient';
import { authApi } from '../services/authApi';
import type { AccountResponse, LoginRequest, RegisterRequest, RoleCode } from '../types/auth';
import { AuthContext, type AuthContextValue, type AuthenticationStatus } from './authContext';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthenticationStatus>('loading');
  const [user, setUser] = useState<AccountResponse | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const setGuest = useCallback(() => {
    setUser(null);
    setStatus('guest');
  }, []);

  const refreshCurrentUser = useCallback(async (): Promise<AccountResponse | null> => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      setStatus('authenticated');
      setInitializationError(null);
      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setGuest();
        return null;
      }
      throw error;
    }
  }, [setGuest]);

  useEffect(() => {
    let isActive = true;

    async function initializeAuthentication() {
      try {
        await apiClient.refreshCsrfToken();
        const currentUser = await authApi.getMe();

        if (!isActive) return;

        setUser(currentUser);
        setStatus('authenticated');
        setInitializationError(null);
      } catch (error) {
        if (!isActive) return;

        if (error instanceof ApiError && error.status === 401) {
          setGuest();
          return;
        }

        setInitializationError(
          error instanceof Error ? error.message : 'Không thể kiểm tra phiên đăng nhập.',
        );
        setGuest();
      }
    }

    void initializeAuthentication();

    return () => {
      isActive = false;
    };
  }, [setGuest]);

  useEffect(() => {
    function handleUnauthorized() {
      setGuest();
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [setGuest]);

  const login = useCallback(async (request: LoginRequest): Promise<AccountResponse> => {
    await authApi.login(request);
    await apiClient.refreshCsrfToken();

    const currentUser = await authApi.getMe();
    setUser(currentUser);
    setStatus('authenticated');
    setInitializationError(null);
    return currentUser;
  }, []);

  const register = useCallback(async (request: RegisterRequest): Promise<AccountResponse> => {
    return authApi.register(request);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setGuest();
      apiClient.clearCsrfToken();

      try {
        await apiClient.refreshCsrfToken();
      } catch {
        // The user is already logged out. A later mutation can bootstrap CSRF again.
      }
    }
  }, [setGuest]);

  const hasRole = useCallback((role: RoleCode): boolean => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    initializationError,
    login,
    register,
    logout,
    refreshCurrentUser,
    hasRole,
  }), [
    status,
    user,
    initializationError,
    login,
    register,
    logout,
    refreshCurrentUser,
    hasRole,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
