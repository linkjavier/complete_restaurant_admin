"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getTables, createTable, deleteTable, updateTable, Table } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { getLocations, Location } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TablesManager() {
  const [tables, setTables] = useState<Table[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTable, setNewTable] = useState({
    number: "",
    seats: "",
    locationId: "",
  })
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchTables()
    fetchLocations()
  }, [])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const data = await getTables()
      setTables(data)
    } catch (err) {
      setError("Error al cargar las mesas")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const data = await getLocations()
      setLocations(data)
    } catch (err) {
      console.error("Error al cargar las ubicaciones:", err)
    }
  }

  const handleCreateTable = async () => {
    try {
      if (!newTable.number || !newTable.seats || !newTable.locationId) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos",
          variant: "destructive",
        })
        return
      }

      await createTable({
        number: parseInt(newTable.number),
        seats: parseInt(newTable.seats),
        locationId: newTable.locationId,
      })

      toast({
        title: "Éxito",
        description: "Mesa creada correctamente",
      })

      setNewTable({
        number: "",
        seats: "",
        locationId: "",
      })

      fetchTables()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error al crear la mesa",
        variant: "destructive",
      })
      console.error(err)
    }
  }

  const handleUpdateTable = async () => {
    if (!editingTable) return

    try {
      if (!editingTable.number || !editingTable.seats || !editingTable.locationId) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos",
          variant: "destructive",
        })
        return
      }

      await updateTable(editingTable.id, {
        number: editingTable.number,
        seats: editingTable.seats,
        locationId: editingTable.locationId,
      })

      toast({
        title: "Éxito",
        description: "Mesa actualizada correctamente",
      })

      setEditingTable(null)
      fetchTables()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error al actualizar la mesa",
        variant: "destructive",
      })
      console.error(err)
    }
  }

  const handleDeleteTable = async (id: string) => {
    try {
      await deleteTable(id)
      toast({
        title: "Éxito",
        description: "Mesa eliminada correctamente",
      })
      fetchTables()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error al eliminar la mesa",
        variant: "destructive",
      })
      console.error(err)
    }
  }

  if (loading) {
    return <div className="text-center">Cargando mesas...</div>
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingTable ? "Editar Mesa" : "Crear Nueva Mesa"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="number">Número de Mesa</Label>
              <Input
                id="number"
                type="number"
                value={editingTable ? editingTable.number : newTable.number}
                onChange={(e) =>
                  editingTable
                    ? setEditingTable({ ...editingTable, number: parseInt(e.target.value) })
                    : setNewTable({ ...newTable, number: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seats">Número de Asientos</Label>
              <Input
                id="seats"
                type="number"
                value={editingTable ? editingTable.seats : newTable.seats}
                onChange={(e) =>
                  editingTable
                    ? setEditingTable({ ...editingTable, seats: parseInt(e.target.value) })
                    : setNewTable({ ...newTable, seats: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="locationId">Ubicación</Label>
              <Select
                value={editingTable ? editingTable.locationId : newTable.locationId}
                onValueChange={(value) =>
                  editingTable
                    ? setEditingTable({ ...editingTable, locationId: value })
                    : setNewTable({ ...newTable, locationId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {editingTable ? (
                <>
                  <Button onClick={handleUpdateTable}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Mesa
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingTable(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateTable}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Mesa
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mesas Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">Mesa {table.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {table.seats} asientos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ubicación: {table.location?.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEditingTable(table)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteTable(table.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 