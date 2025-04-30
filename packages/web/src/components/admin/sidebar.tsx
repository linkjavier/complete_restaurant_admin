"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  ChevronRight
} from "lucide-react"
import { getAuthToken } from "@/lib/auth"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState, useEffect } from "react"

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
  },
  {
    label: "POS",
    icon: ShoppingCart,
    href: "/admin/pos",
  },
  {
    label: "Mesas",
    icon: Table,
    href: "/admin/tables",
  },
  {
    label: "Ubicaciones",
    icon: MapPin,
    href: "/admin/locations",
  },
  {
    label: "Cocina",
    icon: ChefHat,
    href: "/admin/kitchen-manager",
  },
  {
    label: "Categorías",
    icon: Tag,
    href: "/admin/categories",
  },
  {
    label: "Productos",
    icon: Package,
    href: "/admin/products",
  },
  {
    label: "Ingredientes",
    icon: Utensils,
    href: "/admin/ingredients",
  },
  {
    label: "Usuarios",
    icon: Users,
    href: "/admin/users",
  },
  {
    label: "Configuración",
    icon: Settings,
    href: "/admin/settings",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const isAuthenticated = getAuthToken() !== null
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
  }, [isCollapsed])

  if (!isAuthenticated) {
    return null
  }

  // No renderizar nada hasta que el componente esté montado
  if (!mounted) {
    return null
  }

  return (
    <div className={cn(
      "relative h-full bg-[#111827] text-white transition-all duration-300",
      isCollapsed ? "w-[80px]" : "w-[240px]"
    )}>
      <div className="space-y-4 py-4 flex flex-col h-full">
        <div className="px-3 py-2 flex-1">
          <div className="flex items-center justify-between pl-3 mb-14">
            {!isCollapsed && (
              <Link href="/admin/dashboard">
                <h1 className="text-2xl font-bold">
                  Admin Panel
                </h1>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/10"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-white" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-white" />
              )}
            </Button>
          </div>
          <div className="space-y-1">
            {routes.map((route) => (
              <TooltipProvider key={route.href} delayDuration={100}>
                <Tooltip open={isCollapsed ? undefined : false}>
                  <TooltipTrigger asChild>
                    <Link
                      href={route.href}
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
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#111827] text-white border-none">
                    {route.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 