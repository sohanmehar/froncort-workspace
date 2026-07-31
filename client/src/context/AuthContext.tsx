'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  fullName: string;
  activeOrgId: string;
  role: string;
  memberships: Array<{
    orgId: string;
    orgName: string;
    role: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

  // Centralized Route Guard Logic
  useEffect(() => {
    if (loading) return;

    // 1. Redirect unauthenticated users to /login
    if (!user && pathname !== '/login') {
      router.push('/login');
      return;
    }

    if (user) {
      const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_SUPER_ADMIN' || user.email === 'superadmin@froncort.ai';

      // 2. Protect Super Admin Console (/admin)
      if (pathname.startsWith('/admin') && !isSuperAdmin) {
        alert('⛔ Access Denied: Platform Super Admin privileges required.');
        router.push('/dashboard');
        return;
      }

      // 3. Protect Review & Audit Console (/dashboard/reviews)
      if (pathname.startsWith('/dashboard/reviews') && user.role === 'SUPPORT_AGENT') {
        alert('⛔ Access Denied: Support Agents cannot access PR Reviews.');
        router.push('/dashboard');
        return;
      }
    }
  }, [pathname, user, loading, router]);

  const fetchMe = async () => {
    try {
      const res = await API.get('/auth/me');
      setUser(res.data.user);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    
    setUser(newUser); 

    fetchMe();

    if (newUser.role === 'SUPER_ADMIN' || newUser.role === 'PLATFORM_SUPER_ADMIN' || newUser.email === 'superadmin@froncort.ai') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout-everywhere');
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
      router.push('/login');
    }
  };

  const switchOrg = async (targetOrgId: string): Promise<boolean> => {
    try {
      const res = await API.post('/auth/switch-org', { targetOrgId });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      await fetchMe();
      window.location.reload();
      return true;
    } catch (err: any) {
      console.error('Failed to switch org', err);
      const msg = err?.response?.data?.error || 'Access Denied: You do not have membership in target organization.';
      alert(`⚠️ Organization Switch Blocked (403)\n\n${msg}`);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};