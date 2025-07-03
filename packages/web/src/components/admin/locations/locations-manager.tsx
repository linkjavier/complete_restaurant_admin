"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getLocations, createLocation, deleteLocation, updateLocation, Location } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

export function LocationsManager() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    phone: "",
  })
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLocations()
      setLocations(data)
    } catch (err) {
      console.error('Error fetching locations:', err)
      setError("Error al cargar las ubicaciones. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLocation = async () => {
    try {
      if (!newLocation.name || !newLocation.address || !newLocation.phone) {
        toast({
          title: "Error",
          description: "Por favor ingresa nombre, dirección y teléfono",
          variant: "destructive",
        })
        return
      }

      await createLocation({
        name: newLocation.name,
        address: newLocation.address,
        phone: newLocation.phone,
      })

      toast({
        title: "Éxito",
        description: "Ubicación creada correctamente",
      })

      setNewLocation({
        name: "",
        address: "",
        phone: "",
      })

      fetchLocations()
    } catch (err) {
      console.error('Error creating location:', err)
      toast({
        title: "Error",
        description: "Error al crear la ubicación. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateLocation = async () => {
    if (!editingLocation) return

    try {
      if (!editingLocation.name) {
        toast({
          title: "Error",
          description: "Por favor ingresa un nombre",
          variant: "destructive",
        })
        return
      }

      await updateLocation(editingLocation.id, {
        name: editingLocation.name,
      })

      toast({
        title: "Éxito",
        description: "Ubicación actualizada correctamente",
      })

      setEditingLocation(null)
      fetchLocations()
    } catch (err) {
      console.error('Error updating location:', err)
      toast({
        title: "Error",
        description: "Error al actualizar la ubicación. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteLocation(id)
      toast({
        title: "Éxito",
        description: "Ubicación eliminada correctamente",
      })
      fetchLocations()
    } catch (err) {
      console.error('Error deleting location:', err)
      toast({
        title: "Error",
        description: "Error al eliminar la ubicación. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingLocation ? "Editar Ubicación" : "Crear Nueva Ubicación"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre de la Ubicación</Label>
              <Input
                id="name"
                placeholder="Ingresa el nombre de la ubicación"
                value={editingLocation ? editingLocation.name : newLocation.name}
                onChange={(e) =>
                  editingLocation
                    ? setEditingLocation({ ...editingLocation, name: e.target.value })
                    : setNewLocation({ ...newLocation, name: e.target.value })
                }
              />
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                placeholder="Ingresa la dirección"
                value={editingLocation ? editingLocation.address : newLocation.address}
                onChange={(e) =>
                  editingLocation
                    ? setEditingLocation({ ...editingLocation, address: e.target.value })
                    : setNewLocation({ ...newLocation, address: e.target.value })
                }
              />
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                placeholder="Ingresa el teléfono"
                value={editingLocation ? editingLocation.phone : newLocation.phone}
                onChange={(e) =>
                  editingLocation
                    ? setEditingLocation({ ...editingLocation, phone: e.target.value })
                    : setNewLocation({ ...newLocation, phone: e.target.value })
                }
              />
            </div>
            <div className="flex gap-2">
              {editingLocation ? (
                <>
                  <Button onClick={handleUpdateLocation}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Ubicación
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingLocation(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateLocation}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Ubicación
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubicaciones Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center">Cargando ubicaciones...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={fetchLocations}>Reintentar</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {locations.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay ubicaciones creadas
                </div>
              ) : (
                locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{location.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingLocation(location)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteLocation(location.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 