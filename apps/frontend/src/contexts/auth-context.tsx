'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = apiClient.getToken();
    if (token) {
      apiClient
        .getProfile()
        .then((profile) => {
          setUser(profile);
        })
        .catch(() => {
          apiClient.setToken(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    apiClient.setToken(response.access_token);
    setUser(response.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await apiClient.register(email, password, name);
    apiClient.setToken(response.access_token);
    setUser(response.user);
  };

  const logout = () => {
    apiClient.setToken(null);
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      const profile = await apiClient.getProfile();
      setUser(profile);
    } catch {
      // ignore
    }
  }, []);

  const contextValue = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
