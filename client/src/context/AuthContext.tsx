'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '@/lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  fullName: string;
  activeOrgId: string;
  role: string;
  memberships: Array<{
    organization: { id: string; name: string; domain: string };
    role: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

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
    router.push('/dashboard');
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

  const switchOrg = async (targetOrgId: string) => {
    try {
      const res = await API.post('/auth/switch-org', { targetOrgId });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch org', err);
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