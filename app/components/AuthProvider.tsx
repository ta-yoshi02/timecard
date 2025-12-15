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
  useRef,
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
  csrfToken: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  employee: null,
  loading: true,
  csrfToken: null,
  refresh: async () => { },
  logout: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const csrfTokenRef = useRef<string | null>(null);

  // Update ref whenever state changes so interceptor can access it
  useEffect(() => {
    csrfTokenRef.current = csrfToken;
  }, [csrfToken]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch CSRF Token
      const csrfRes = await fetch('/api/auth/csrf');
      if (csrfRes.ok) {
        const { token } = await csrfRes.json();
        setCsrfToken(token);
      }

      // 2. Fetch User Session
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

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const resource = args[0];
      let config = args[1];

      // Auto-inject CSRF token for mutation requests
      if (csrfTokenRef.current && config && typeof config === 'object') {
        const method = config.method?.toUpperCase();
        if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          config = {
            ...config,
            headers: {
              ...config.headers,
              'X-CSRF-Token': csrfTokenRef.current,
            }
          };
          args[1] = config;
        }
      } else if (csrfTokenRef.current && !config && args.length === 1) {
        // Case where fetch is called with just URL, but we want to be safe? 
        // Usually fetch(url) is GET. So we ignore.
      }

      const response = await originalFetch(...args);
      if (response.status === 401) {
        // Avoid infinite loop if logout itself returns 401
        const url = resource.toString();
        if (!url.includes('/api/auth/logout')) {
          setUser(null);
          setEmployee(null);
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setEmployee(null);
      // We might want to clear CSRF token too, or refresh it
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      employee,
      loading,
      csrfToken,
      refresh,
      logout,
    }),
    [user, employee, loading, csrfToken, refresh, logout],
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
