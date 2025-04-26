"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getTable, Table } from "@/lib/api"
import { Menu } from "@/components/table/menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function TablePage() {
  const params = useParams()
  const [table, setTable] = useState<Table | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [isOrderStarted, setIsOrderStarted] = useState(false)

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

    fetchTable()
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
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mesa {table.number}</h1>
        <p className="text-muted-foreground">
          Ubicación: {table.location?.name || "Sin ubicación"}
        </p>
      </div>

      {!isOrderStarted ? (
        <div className="max-w-md mx-auto space-y-4">
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
            Comenzar Pedido
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