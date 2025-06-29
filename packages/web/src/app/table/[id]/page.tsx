"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getTable, Table } from "@/lib/api"
import { Menu } from "@/components/table/menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Image from "next/image"

export default function TablePage() {
  const params = useParams()
  const [table, setTable] = useState<Table | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [isOrderStarted, setIsOrderStarted] = useState(false)
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("Kutchen AI")

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
        const res = await fetch("/api/settings/business")
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
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {!isOrderStarted ? (
        <div className="max-w-md mx-auto space-y-4 mt-2 md:mt-4">
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
        />
      )}
    </div>
  )
} 