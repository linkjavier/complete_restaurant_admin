"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Menu } from "@/components/table/menu"
import { getTable, Table } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

interface TablePageProps {
  params: {
    id: string
  }
}

export default function TablePage({ params }: TablePageProps) {
  const [table, setTable] = useState<Table | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchTable = async () => {
      try {
        setLoading(true)
        const data = await getTable(params.id)
        setTable(data)
      } catch (err) {
        setError("Error al cargar la información de la mesa")
        toast({
          title: "Error",
          description: "No se pudo cargar la información de la mesa",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTable()
  }, [params.id, toast])

  if (loading) {
    return <div className="text-center">Cargando información de la mesa...</div>
  }

  if (error || !table) {
    return <div className="text-center text-red-500">{error || "Mesa no encontrada"}</div>
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Mesa {table.number}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ubicación: {table.location?.name}
          </p>
          <p className="text-muted-foreground">
            Asientos: {table.seats}
          </p>
        </CardContent>
      </Card>

      {table.locationId && (
        <Menu locationId={table.locationId} />
      )}
    </div>
  )
} 