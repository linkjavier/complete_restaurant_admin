"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/sidebar"
import { UserNav } from "@/components/user-nav"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/toaster"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/hooks/use-auth"
import { getHomePathForRole, isPathAllowedForRole } from "@/lib/roles"

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  console.log('[AdminLayout] Layout mounted');

  return (
    <QueryClientProvider client={queryClient}>
      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CHEF', 'STAFF']}>
        <RoleRouteGuard>
        <div className="h-full">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex h-full flex-col fixed inset-y-0 z-50 transition-all duration-300" id="sidebar">
            <Sidebar />
          </div>
          
          {/* Mobile Header with Menu Button */}
          <div className="fixed top-0 right-0 left-0 md:left-[var(--sidebar-width)] h-16 bg-background border-b border-border z-40 flex items-center px-4 transition-all duration-300">
            <div className="md:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="mr-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                  <Sidebar isMobile onClose={() => setIsOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
            <div className="ml-auto">
              <UserNav />
            </div>
          </div>
          
          <main className="md:pl-[var(--sidebar-width)] pt-16 h-full transition-all duration-300">
            {children}
          </main>
        </div>
        </RoleRouteGuard>
      </ProtectedRoute>
      <Toaster />
    </QueryClientProvider>
  )
}