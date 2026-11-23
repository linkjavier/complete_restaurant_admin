'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createFirstLocation } from '@/lib/api';
import { getHomePathForRole } from '@/lib/roles';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, error, refreshUser } = useAuth();
  const router = useRouter();
  const [locationForm, setLocationForm] = useState({
    name: 'Sede principal',
    address: '',
    city: '',
    country: '',
    phone: '',
  });
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const needsFirstLocation =
    user?.role === 'SUPER_ADMIN' && !user.locationId;

  const handleCreateFirstLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocationError(null);
    setIsCreatingLocation(true);
    try {
      await createFirstLocation(locationForm);
      await refreshUser();
    } catch (createError) {
      setLocationError(
        createError instanceof Error
          ? createError.message
          : 'No se pudo crear la ubicación. Inténtalo nuevamente.',
      );
    } finally {
      setIsCreatingLocation(false);
    }
  };

  useEffect(() => {
    if (isLoading) return; // No redirigir mientras carga
    if (!user) {
      router.push('/auth/login');
    } else if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(getHomePathForRole(user.role));
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

  if (needsFirstLocation) {
    return (
      <>
        <Dialog
          open
          onOpenChange={() => {
            // This first setup step must be completed before entering the app.
          }}
        >
          <DialogContent
            className="max-h-[90vh] overflow-y-auto [&>button]:hidden"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <p className="text-sm font-medium text-primary">Primer paso · 1 de 1</p>
              <DialogTitle>Registra la ubicación principal</DialogTitle>
              <DialogDescription>
                Antes de comenzar, crea la primera sede de tu negocio. Quedará asignada
                a tu cuenta de Super Admin.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreateFirstLocation}>
              <div className="space-y-2">
                <Label htmlFor="first-location-name">Nombre de la ubicación</Label>
                <Input
                  id="first-location-name"
                  required
                  maxLength={100}
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm({ ...locationForm, name: event.target.value })
                  }
                  disabled={isCreatingLocation}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-location-address">Dirección</Label>
                <Input
                  id="first-location-address"
                  required
                  value={locationForm.address}
                  onChange={(event) =>
                    setLocationForm({ ...locationForm, address: event.target.value })
                  }
                  disabled={isCreatingLocation}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-location-city">Ciudad</Label>
                  <Input
                    id="first-location-city"
                    value={locationForm.city}
                    onChange={(event) =>
                      setLocationForm({ ...locationForm, city: event.target.value })
                    }
                    disabled={isCreatingLocation}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first-location-country">País</Label>
                  <Input
                    id="first-location-country"
                    value={locationForm.country}
                    onChange={(event) =>
                      setLocationForm({ ...locationForm, country: event.target.value })
                    }
                    disabled={isCreatingLocation}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-location-phone">Teléfono</Label>
                <Input
                  id="first-location-phone"
                  type="tel"
                  required
                  value={locationForm.phone}
                  onChange={(event) =>
                    setLocationForm({ ...locationForm, phone: event.target.value })
                  }
                  disabled={isCreatingLocation}
                />
              </div>
              {locationError && (
                <p role="alert" className="text-sm text-destructive">
                  {locationError}
                </p>
              )}
              <Button className="w-full" type="submit" disabled={isCreatingLocation}>
                {isCreatingLocation ? 'Creando ubicación...' : 'Crear ubicación y continuar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  console.log('[ProtectedRoute] Rendering children');
  return <>{children}</>;
}