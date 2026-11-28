"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/sidebar"
import { UserNav } from "@/components/user-nav"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MapPin, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/toaster"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/hooks/use-auth"
import { getHomePathForRole, isPathAllowedForRole } from "@/lib/roles"
import {
  ALL_LOCATIONS,
  LocationSelectionProvider,
  useLocationSelection,
} from "@/hooks/use-location-selection"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Create a client
const queryClient = new QueryClient()

function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !user) return
    if (!isPathAllowedForRole(user.role, pathname)) {
      router.replace(getHomePathForRole(user.role))
    }
  }, [user, isLoading, pathname, router])

  if (user && !isPathAllowedForRole(user.role, pathname)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}

function LocationSwitcher() {
  const { user } = useAuth()
  const { locations, selectedLocationId, setSelectedLocationId, isLoadingLocations } =
    useLocationSelection()

  if (user?.role !== "SUPER_ADMIN" || isLoadingLocations || locations.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <MapPin className="hidden h-4 w-4 text-muted-foreground sm:block" />
      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
        <SelectTrigger aria-label="Seleccionar ubicación" className="h-9 w-[150px] bg-background sm:w-[210px]">
          <SelectValue placeholder="Ubicación" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_LOCATIONS}>Todas las ubicaciones</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  console.log('[AdminLayout] Layout mounted');

  return (
    <QueryClientProvider client={queryClient}>
      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CHEF', 'STAFF', 'CASHIER']}>
        <LocationSelectionProvider>
          <RoleRouteGuard>
            <div className="h-full">
              <div
                className="fixed inset-y-0 z-50 hidden h-full flex-col transition-all duration-300 md:flex"
                id="sidebar"
              >
                <Sidebar />
              </div>

              <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center border-b border-border bg-background px-4 transition-all duration-300 md:left-[var(--sidebar-width)]">
                <div className="md:hidden">
                  <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="mr-2">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                      <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                      <Sidebar isMobile onClose={() => setIsOpen(false)} />
                    </SheetContent>
                  </Sheet>
                </div>
                <div className="ml-auto flex min-w-0 items-center gap-2">
                  <LocationSwitcher />
                  <UserNav />
                </div>
              </div>

              <main className="h-full pt-16 transition-all duration-300 md:pl-[var(--sidebar-width)]">
                {children}
              </main>
            </div>
          </RoleRouteGuard>
        </LocationSelectionProvider>
      </ProtectedRoute>
      <Toaster />
    </QueryClientProvider>
  )
}