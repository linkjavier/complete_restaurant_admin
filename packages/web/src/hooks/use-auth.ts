import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { getUser, User } from "@/lib/api";
import { useRouter } from 'next/navigation';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

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
        console.error("Failed to fetch user:", error);
        setState({ user: null, isLoading: false, error: 'Failed to fetch user' });
      }
    };

    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      if (!process.env.NEXT_PUBLIC_API_URL) {
        throw new Error('API URL is not configured');
      }

      console.log('Attempting login to:', `${process.env.NEXT_PUBLIC_API_URL}/auth/login`);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Login failed:", errorData);
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      setState({ user: data.user, isLoading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error("Login error:", errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      if (!process.env.NEXT_PUBLIC_API_URL) {
        throw new Error('API URL is not configured');
      }

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { 
        method: 'POST',
        credentials: 'include',
      });
      localStorage.removeItem('token');
      setState({ user: null, isLoading: false, error: null });
      router.push('/auth/login');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      console.error("Logout error:", errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  };

  return {
    ...state,
    login,
    logout,
  };
} 