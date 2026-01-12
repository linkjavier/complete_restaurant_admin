"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
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
  Receipt,
  Bot,
  MessageCircle,
  ContactRound
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
import { LanguageSwitch } from "@/components/language-switch"
import "@/app/sidebar-scrollbar.css"
import { API_URL } from '@/lib/api'
import { useLanguage } from "@/hooks/use-language"

interface SidebarProps {
  isMobile?: boolean
  onClose?: () => void
}

const routes = [
  {
    label: "dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "ai",
    icon: Bot,
    href: "/admin/ai-manager",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "pos",
    icon: ShoppingCart,
    href: "/admin/pos",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "orders",
    icon: Receipt,
    href: "/admin/orders",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "tables",
    icon: Table,
    href: "/admin/tables",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    label: "kitchen",
    icon: ChefHat,
    href: "/admin/kitchen-manager",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CHEF'],
  },
  {
    label: "categories",
    icon: Tag,
    href: "/admin/categories",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "products",
    icon: Package,
    href: "/admin/products",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "ingredients",
    icon: Utensils,
    href: "/admin/ingredients",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "locations",
    icon: MapPin,
    href: "/admin/locations",
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: "customers",
    icon: ContactRound,
    href: "/admin/customers",
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    label: "users",
    icon: Users,
    href: "/admin/users",
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },

  {
    label: "settings",
    icon: Settings,
    href: "/admin/settings",
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
]

export function Sidebar({ isMobile, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { tNested } = useLanguage()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("Admin Panel")

  const sidebarTranslations = tNested('sidebar')

  useEffect(() => {
    setMounted(true)
    // Recuperar el estado del sidebar del localStorage
    const savedState = localStorage.getItem('sidebarCollapsed')
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState))
    }
    // Obtener logo y nombre del negocio desde la API
    const fetchBusiness = async () => {
      try {
        const locationId = user?.locationId
        const res = await fetch(`${API_URL}/settings/business${locationId ? `?locationId=${locationId}` : ''}`)
        if (res.ok) {
          const data = await res.json()
          setBusinessIcon(data.logo || "")
          setBusinessName(data.name || "Admin Panel")
        }
      } catch { }
    }
    fetchBusiness()
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

  const handleNavigation = (href: string) => {
    if (isMobile && onClose) {
      onClose()
    }
    router.push(href)
  }

  return (
    <div className={cn(
      "flex h-full flex-col bg-[#111827] text-white relative overflow-y-auto sidebar-scrollbar",
      isCollapsed ? "w-[70px]" : "w-[280px]"
    )}>
      <div className="space-y-4 py-4 flex flex-col">
        <div className="px-3 py-2 flex-1">
          <div className="flex items-center justify-between pl-3 mb-4 sticky top-0 bg-[#111827] z-10">
            <div className="flex items-center gap-3">
              {!isCollapsed && (
                <>
                  <div className="md:hidden">
                    <Image
                      src={businessIcon || "/assets/kutchen_app_logo.png"}
                      alt="Logo Negocio"
                      width={40}
                      height={40}
                      priority
                    />
                  </div>
                  <div
                    className="cursor-pointer"
                    onClick={() => handleNavigation('/admin/dashboard')}
                  >
                    <h1 className="text-2xl font-bold">
                      {businessName}
                    </h1>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <ThemeSwitch />
            </div>
          </div>
          <div className={cn(
            "flex justify-center mb-10 transition-all duration-300",
            isCollapsed ? "px-2" : "px-4",
            "hidden md:flex"
          )}>
            <Image
              src={businessIcon || "/assets/kutchen_app_logo.png"}
              alt="Logo Negocio"
              width={150}
              height={150}
              priority
            />
          </div>
          <div className="space-y-1 pb-4">
            {routes.filter(route => !route.roles || route.roles.includes(user.role)).map((route) => {
              const isActive = pathname === route.href ||
                (route.href === '/admin/pos' && pathname.startsWith('/admin/pos/')) ||
                (route.href === '/admin/orders' && pathname.startsWith('/admin/orders/')) ||
                (route.href === '/admin/tables' && pathname.startsWith('/admin/tables/')) ||
                (route.href === '/admin/products' && pathname.startsWith('/admin/products/')) ||
                (route.href === '/admin/categories' && pathname.startsWith('/admin/categories/')) ||
                (route.href === '/admin/users' && pathname.startsWith('/admin/users/')) ||
                (route.href === '/admin/settings' && pathname.startsWith('/admin/settings/'));

              const linkContent = (
                <div
                  className={cn(
                    "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                    isActive ? "text-white bg-white/10" : "text-zinc-400",
                    isCollapsed ? "justify-center" : ""
                  )}
                  onClick={() => handleNavigation(route.href)}
                >
                  <div className="flex items-center">
                    <route.icon className="h-5 w-5" />
                    {!isCollapsed && <span className="ml-3">{sidebarTranslations[route.label] || route.label}</span>}
                  </div>
                </div>
              );

              return (
                <TooltipProvider key={route.href} delayDuration={100}>
                  <Tooltip open={isCollapsed ? undefined : false}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#111827] text-white border-none">
                      {sidebarTranslations[route.label] || route.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </div>
      {/* Collapse button for desktop, sticky at bottom */}
      {!isMobile && (
        <div className="sticky bottom-0 left-0 w-full bg-[#111827] z-20 flex justify-center pb-4 pt-2 border-t border-white/5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 relative z-[9999]"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-white" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-white" />
            )}
          </Button>
        </div>
      )}
      {/* Mobile close button */}
      {isMobile && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 md:hidden">
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </Button>
          </SheetClose>
        </div>
      )}
    </div>
  )
}