"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SheetClose } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Table,
  MapPin,
  Tag,
  Package,
  Users,
  Settings,
  Utensils,
  ChefHat,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Receipt
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { ThemeSwitch } from "@/components/theme-switch"

interface SidebarProps {
  isMobile?: boolean
}

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "POS",
    icon: ShoppingCart,
    href: "/admin/pos",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "Órdenes",
    icon: Receipt,
    href: "/admin/orders",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "Mesas",
    icon: Table,
    href: "/admin/tables",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "Ubicaciones",
    icon: MapPin,
    href: "/admin/locations",
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: "Cocina",
    icon: ChefHat,
    href: "/admin/kitchen-manager",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CHEF'],
  },
  {
    label: "Categorías",
    icon: Tag,
    href: "/admin/categories",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "Productos",
    icon: Package,
    href: "/admin/products",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "Ingredientes",
    icon: Utensils,
    href: "/admin/ingredients",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CHEF'],
  },
  {
    label: "Usuarios",
    icon: Users,
    href: "/admin/users",
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: "Configuración",
    icon: Settings,
    href: "/admin/settings",
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
]

export function Sidebar({ isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Recuperar el estado del sidebar del localStorage
    const savedState = localStorage.getItem('sidebarCollapsed')
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState))
    }
  }, [])

  useEffect(() => {
    // Guardar el estado del sidebar en localStorage
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
    // Actualizar la variable CSS para el ancho del sidebar
    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '70px' : '280px')
  }, [isCollapsed])

  if (!user) {
    return null
  }

  // No renderizar nada hasta que el componente esté montado
  if (!mounted) {
    return null
  }

  return (
    <div className={cn(
      "flex h-full flex-col bg-[#111827] text-white",
      isCollapsed ? "w-[70px]" : "w-[280px]"
    )}>
      <div className="space-y-4 py-4 flex flex-col h-full">
        <div className="px-3 py-2 flex-1">
          <div className="flex items-center justify-between pl-3 mb-4">
            {!isCollapsed ? (
              <Link href="/admin/dashboard">
                <h1 className="text-2xl font-bold">
                  Admin Panel
                </h1>
              </Link>
            ) : null}
            <div className="flex items-center gap-2">
              <ThemeSwitch />
              <div className="md:block hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10 active:bg-zinc-300 dark:active:bg-white/20"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-white" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 text-white" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className={cn(
            "flex justify-center mb-10 transition-all duration-300",
            isCollapsed ? "px-2" : "px-4"
          )}>
            <Image
              src="/assets/blondie-logo.png"
              alt="Blondie Logo"
              width={isCollapsed ? 50 : 150}
              height={isCollapsed ? 50 : 150}
              className="object-contain"
            />
          </div>
          <div className="space-y-1">
            {routes.filter(route => !route.roles || route.roles.includes(user.role)).map((route) => {
              const linkContent = (
                <div
                  className={cn(
                    "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                    pathname === route.href ? "text-white bg-white/10" : "text-zinc-400",
                    isCollapsed ? "justify-center" : ""
                  )}
                >
                  <div className="flex items-center">
                    <route.icon className="h-5 w-5" />
                    {!isCollapsed && <span className="ml-3">{route.label}</span>}
                  </div>
                </div>
              );

              const link = (
                <Link href={route.href}>{linkContent}</Link>
              );

              return (
                <TooltipProvider key={route.href} delayDuration={100}>
                  <Tooltip open={isCollapsed ? undefined : false}>
                    <TooltipTrigger asChild>
                      {isMobile ? (
                        <SheetClose asChild>
                          <Link href={route.href}>
                            {linkContent}
                          </Link>
                        </SheetClose>
                      ) : (
                        link
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#111827] text-white border-none">
                      {route.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  )
}