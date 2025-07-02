'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // No redirigir mientras carga
    if (!user) {
      router.push('/auth/login');
    } else if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.push('/');
    }
  }, [user, isLoading, allowedRoles, router]);

  // Log current state
  console.log('[ProtectedRoute] Current state - user:', user, 'isLoading:', isLoading, 'error:', error);

  if (isLoading) {
    console.log('[ProtectedRoute] Showing loading spinner');
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    console.log('[ProtectedRoute] Showing error:', error);
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, returning null');
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log('[ProtectedRoute] User role not allowed:', user.role, 'Allowed roles:', allowedRoles);
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  console.log('[ProtectedRoute] Rendering children');
  return <>{children}</>;
} 