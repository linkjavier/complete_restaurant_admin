"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { getAuthToken } from "@/lib/auth";
import { getAuthHeaders } from "@/lib/api";
import { getUser, User, API_URL } from "@/lib/api";
import { useRouter } from 'next/navigation';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface LoginResponse {
  access_token: string;
  user: User;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<LoginResponse>;
  completeLogin: (accessToken: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Cargar usuario al montar
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        setState({ user: userData, isLoading: false, error: null });
      } catch (error) {
        setState({ user: null, isLoading: false, error: 'Failed to fetch user' });
      }
    };
    fetchUser();
  }, []);

  const completeLogin = useCallback(async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    const secureCookie = window.location.protocol === 'https:' ? ' secure;' : '';
    document.cookie = `token=${accessToken}; path=/; max-age=604800; samesite=lax;${secureCookie}`;
    const userData = await getUser();
    setState({ user: userData, isLoading: false, error: null });
    return userData;
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      const data = await response.json();
      const userData = await completeLogin(data.access_token);
      return { ...data, user: userData };
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  };

  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; max-age=0; samesite=lax;';
      setState({ user: null, isLoading: false, error: null });
      router.push('/auth/login');
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      }));
    }
  };

  const refreshUser = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const userData = await getUser();
      setState({ user: userData, isLoading: false, error: null });
    } catch (error) {
      setState({ user: null, isLoading: false, error: 'Failed to fetch user' });
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, completeLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 