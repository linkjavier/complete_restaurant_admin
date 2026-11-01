"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getIngredients, createIngredient, deleteIngredient, updateIngredient, Ingredient } from "@/lib/api"
import { getLocations, Location } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { toFiniteNumber } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function IngredientsManager() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    description: "",
    quantity: 0,
    unit: "",
    minQuantity: 0,
    locationId: "",
  })
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchIngredients()
    fetchLocations()
  }, [])

  const fetchIngredients = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getIngredients()
      setIngredients(data)
    } catch (err) {
      console.error('Error fetching ingredients:', err)
      setError("Error al cargar los ingredientes. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const data = await getLocations()
      setLocations(data)
    } catch (err) {
      console.error('Error fetching locations:', err)
    }
  }

  const handleCreateIngredient = async () => {
    try {
      if (
        !newIngredient.name.trim() ||
        !newIngredient.unit.trim() ||
        !newIngredient.locationId ||
        !Number.isFinite(newIngredient.quantity) ||
        newIngredient.quantity < 0 ||
        !Number.isFinite(newIngredient.minQuantity) ||
        newIngredient.minQuantity < 0
      ) {
        toast({
          title: "Revisa los datos del ingrediente",
          description: "Completa el nombre, la unidad y la sucursal. Las cantidades pueden ser cero, pero no negativas.",
          variant: "destructive",
        })
        return
      }

      await createIngredient({
        name: newIngredient.name.trim(),
        description: newIngredient.description.trim() || undefined,
        quantity: newIngredient.quantity,
        unit: newIngredient.unit.trim(),
        minQuantity: newIngredient.minQuantity,
        locationId: newIngredient.locationId,
      })

      toast({
        title: "Éxito",
        description: "Ingrediente creado correctamente",
      })

      setNewIngredient({
        name: "",
        description: "",
        quantity: 0,
        unit: "",
        minQuantity: 0,
        locationId: "",
      })

      fetchIngredients()
    } catch (err) {
      console.error('Error creating ingredient:', err)
      toast({
        title: "No se pudo crear el ingrediente",
        description: err instanceof Error ? err.message : "Ocurrió un error inesperado.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateIngredient = async () => {
    if (!editingIngredient) return

    try {
      if (
        !editingIngredient.name.trim() ||
        !editingIngredient.unit.trim() ||
        !editingIngredient.locationId ||
        !Number.isFinite(editingIngredient.quantity) ||
        editingIngredient.quantity < 0 ||
        !Number.isFinite(editingIngredient.minQuantity) ||
        editingIngredient.minQuantity < 0
      ) {
        toast({
          title: "Revisa los datos del ingrediente",
          description: "Completa el nombre, la unidad y la sucursal. Las cantidades pueden ser cero, pero no negativas.",
          variant: "destructive",
        })
        return
      }

      await updateIngredient(editingIngredient.id, {
        name: editingIngredient.name.trim(),
        description: editingIngredient.description?.trim() || undefined,
        quantity: editingIngredient.quantity,
        unit: editingIngredient.unit.trim(),
        minQuantity: editingIngredient.minQuantity,
        locationId: editingIngredient.locationId,
      })

      toast({
        title: "Éxito",
        description: "Ingrediente actualizado correctamente",
      })

      setEditingIngredient(null)
      fetchIngredients()
    } catch (err) {
      console.error('Error updating ingredient:', err)
      toast({
        title: "Error",
        description: "Error al actualizar el ingrediente. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteIngredient = async (id: string) => {
    try {
      await deleteIngredient(id)
      toast({
        title: "Éxito",
        description: "Ingrediente eliminado correctamente",
      })
      fetchIngredients()
    } catch (err) {
      console.error('Error deleting ingredient:', err)
      toast({
        title: "Error",
        description: "Error al eliminar el ingrediente. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingIngredient ? "Editar Ingrediente" : "Crear Nuevo Ingrediente"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del Ingrediente</Label>
              <Input
                id="name"
                placeholder="Ingresa el nombre del ingrediente"
                value={editingIngredient ? editingIngredient.name : newIngredient.name}
                onChange={(e) =>
                  editingIngredient
                    ? setEditingIngredient({ ...editingIngredient, name: e.target.value })
                    : setNewIngredient({ ...newIngredient, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Ingresa una descripción (opcional)"
                value={editingIngredient ? editingIngredient.description || "" : newIngredient.description}
                onChange={(e) =>
                  editingIngredient
                    ? setEditingIngredient({ ...editingIngredient, description: e.target.value })
                    : setNewIngredient({ ...newIngredient, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity">Cantidad Actual</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="any"
                placeholder="Ingresa la cantidad actual"
                value={editingIngredient ? editingIngredient.quantity : newIngredient.quantity}
                onChange={(e) =>
                  editingIngredient
                    ? setEditingIngredient({ ...editingIngredient, quantity: toFiniteNumber(e.target.value) })
                    : setNewIngredient({ ...newIngredient, quantity: toFiniteNumber(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Unidad de Medida</Label>
              <Input
                id="unit"
                placeholder="Ej: kg, g, l, ml, etc."
                value={editingIngredient ? editingIngredient.unit : newIngredient.unit}
                onChange={(e) =>
                  editingIngredient
                    ? setEditingIngredient({ ...editingIngredient, unit: e.target.value })
                    : setNewIngredient({ ...newIngredient, unit: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minQuantity">Cantidad Mínima</Label>
              <Input
                id="minQuantity"
                type="number"
                min="0"
                step="any"
                placeholder="Ingresa la cantidad mínima"
                value={editingIngredient ? editingIngredient.minQuantity : newIngredient.minQuantity}
                onChange={(e) =>
                  editingIngredient
                    ? setEditingIngredient({ ...editingIngredient, minQuantity: toFiniteNumber(e.target.value) })
                    : setNewIngredient({ ...newIngredient, minQuantity: toFiniteNumber(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="locationId">Ubicación</Label>
              <Select
                value={editingIngredient ? editingIngredient.locationId : newIngredient.locationId}
                onValueChange={(value) =>
                  editingIngredient
                    ? setEditingIngredient({ ...editingIngredient, locationId: value })
                    : setNewIngredient({ ...newIngredient, locationId: value })
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
            <div className="flex flex-col gap-2 sm:flex-row">
              {editingIngredient ? (
                <>
                  <Button className="w-full sm:w-auto" onClick={handleUpdateIngredient}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Ingrediente
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setEditingIngredient(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto" onClick={handleCreateIngredient}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Ingrediente
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingredientes Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center">Cargando ingredientes...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={fetchIngredients}>Reintentar</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {ingredients.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay ingredientes creados
                </div>
              ) : (
                ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{ingredient.name}</p>
                      {ingredient.description && (
                        <p className="text-sm text-muted-foreground">
                          {ingredient.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Cantidad: {ingredient.quantity} {ingredient.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Mínimo: {ingredient.minQuantity} {ingredient.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ubicación: {ingredient.location?.name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingIngredient(ingredient)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteIngredient(ingredient.id)}
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