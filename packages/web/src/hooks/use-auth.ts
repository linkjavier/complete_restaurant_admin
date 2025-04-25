import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locationId?: string;
}

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
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          throw new Error('Not authenticated');
        }
        const user = await response.json();
        setState({ user, isLoading: false, error: null });
      } catch (error) {
        setState({ user: null, isLoading: false, error: 'Not authenticated' });
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      console.log("Login use-auth")
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Login failed: ", error); // Log para ver el error
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      // Guardar el token en localStorage
      localStorage.setItem('token', data.access_token);
      setState({ user: data.user, isLoading: false, error: null });
      return data;
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
      // Limpiar el token de localStorage
      localStorage.removeItem('token');
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

  return {
    ...state,
    login,
    logout,
  };
} 