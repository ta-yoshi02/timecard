'use client';

import { Employee } from '@/lib/types';
import { useRouter } from 'next/navigation';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AuthUser = {
  userId?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId?: string | null;
  employeeName?: string | null;
  exp?: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  employee: Employee | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  employee: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('failed to fetch session');
      const data = await res.json();
      setUser(data.user ?? null);
      setEmployee(data.employee ?? null);
    } catch (e) {
      console.error(e);
      setUser(null);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setEmployee(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      employee,
      loading,
      refresh,
      logout,
    }),
    [user, employee, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const useRequireRole = (role: 'ADMIN' | 'EMPLOYEE') => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== role) {
      router.replace(user.role === 'ADMIN' ? '/admin' : '/my');
    }
  }, [loading, user, role, router]);
};
