"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getTable, Table, API_URL } from "@/lib/api"
import { Menu } from "@/components/table/menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Image from "next/image"
import { Moon, Sun } from "lucide-react";
function MenuThemeSwitch({ menuTheme, toggleMenuTheme }: { menuTheme: 'light' | 'dark', toggleMenuTheme: () => void }) {
  return (
    <button
      onClick={toggleMenuTheme}
      className={`bg-background/80 rounded-full p-2 shadow hover:bg-background border transition-colors ${menuTheme === 'dark' ? 'bg-zinc-900 text-yellow-300' : 'bg-white text-yellow-500'}`}
      aria-label="Cambiar tema del menú"
      type="button"
    >
      {menuTheme === 'dark' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}

export default function TablePage() {
  const params = useParams()
  const [table, setTable] = useState<Table | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [isOrderStarted, setIsOrderStarted] = useState(false)
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("Kutchen AI")
  // Estado para dark/light local del menú
  const [menuTheme, setMenuTheme] = useState<'light' | 'dark'>(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const toggleMenuTheme = () => setMenuTheme(menuTheme === 'light' ? 'dark' : 'light');

  // Efecto para cambiar el fondo del body según el tema local SOLO en la pantalla de ingreso de nombre
  React.useEffect(() => {
    if (!isOrderStarted) {
      const prev = document.body.style.backgroundColor;
      document.body.style.backgroundColor = menuTheme === 'dark' ? '#111111' : '#fff';
      return () => {
        document.body.style.backgroundColor = prev;
      };
    }
  }, [menuTheme, isOrderStarted]);

  useEffect(() => {
    const fetchTable = async () => {
      try {
        setLoading(true)
        const data = await getTable(params.id as string)
        setTable(data)
      } catch (err) {
        setError("Error al cargar la información de la mesa")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    const fetchBusiness = async () => {
      try {
        const res = await fetch(`${API_URL}/settings/business`)
        if (res.ok) {
          const data = await res.json()
          setBusinessIcon(data.logo || "")
          setBusinessName(data.name || "Kutchen AI")
        }
      } catch {}
    }

    fetchTable()
    fetchBusiness()
  }, [params.id])

  const handleStartOrder = () => {
    if (!customerName.trim()) {
      toast.error("Por favor ingresa tu nombre")
      return
    }
    setIsOrderStarted(true)
  }

  if (loading) {
    return <div className="text-center">Cargando...</div>
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>
  }

  if (!table) {
    return <div className="text-center">Mesa no encontrada</div>
  }

  return (
    <div className={`${menuTheme === 'dark' ? 'menu-dark' : 'menu-light'} min-h-screen`}>
      <div className="container mx-auto">
        <div className="py-2 pb-0 md:pb-2">
          <div className="flex justify-between items-center">
            <div className="flex flex-col space-y-1">
              <h1 className="text-2xl font-bold">{businessName}</h1>
              <p className="text-muted-foreground text-sm">
                Ubicación: {table.location?.name || "Sin ubicación"}
              </p>
            </div>
            
            <div className="flex relative w-[100px] h-[100px]">
              <Image
                src={businessIcon || "/assets/kutchen_app_logo.png"}
                alt="Logo Negocio"
                width={100}
                height={100}
                priority
                className="object-contain rounded-lg"
              />
            </div>
          </div>
        </div>

        {!isOrderStarted ? (
          <div className="max-w-md mx-auto space-y-4 mt-2 md:mt-4 relative">
            <div className="absolute top-0 right-0 z-10">
              <MenuThemeSwitch menuTheme={menuTheme} toggleMenuTheme={toggleMenuTheme} />
            </div>
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium mb-2">
                Tu Nombre
              </label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ingresa tu nombre"
              />
            </div>
            <Button onClick={handleStartOrder} className="w-full">
              Ver Menú
            </Button>
          </div>
        ) : (
          <Menu
            locationId={table.locationId}
            tableId={table.id}
            customerName={customerName}
            businessIcon={businessIcon}
            menuTheme={menuTheme}
            setMenuTheme={setMenuTheme}
          />
        )}
      </div>
    </div>
  )
} 