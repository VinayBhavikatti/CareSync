import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser, Role } from '../types';
import { authApi } from '../api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (profileId: string, role: Role, passcode: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'kindred_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore session from localStorage
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const result = await authApi.verify(token);
        if (result.valid && result.profileId && result.role && result.elderName) {
          setUser({ profileId: result.profileId, role: result.role, elderName: result.elderName, token });
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (profileId: string, role: Role, passcode: string) => {
    const result = await authApi.login(profileId, role, passcode);
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser({ profileId: result.profileId, role: result.role, elderName: result.elderName, token: result.token });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

