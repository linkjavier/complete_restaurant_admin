"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getCategories, createCategory, deleteCategory, updateCategory, Category } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
  })
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getCategories()
      setCategories(data)
    } catch (err) {
      console.error('Error fetching categories:', err)
      setError("Error al cargar las categorías. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async () => {
    try {
      if (!newCategory.name) {
        toast({
          title: "Error",
          description: "Por favor ingresa un nombre",
          variant: "destructive",
        })
        return
      }

      await createCategory({
        name: newCategory.name,
        description: newCategory.description || undefined,
      })

      toast({
        title: "Éxito",
        description: "Categoría creada correctamente",
      })

      setNewCategory({
        name: "",
        description: "",
      })

      fetchCategories()
    } catch (err) {
      console.error('Error creating category:', err)
      toast({
        title: "Error",
        description: "Error al crear la categoría. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory) return

    try {
      if (!editingCategory.name) {
        toast({
          title: "Error",
          description: "Por favor ingresa un nombre",
          variant: "destructive",
        })
        return
      }

      await updateCategory(editingCategory.id, {
        name: editingCategory.name,
        description: editingCategory.description || undefined,
      })

      toast({
        title: "Éxito",
        description: "Categoría actualizada correctamente",
      })

      setEditingCategory(null)
      fetchCategories()
    } catch (err) {
      console.error('Error updating category:', err)
      toast({
        title: "Error",
        description: "Error al actualizar la categoría. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id)
      toast({
        title: "Éxito",
        description: "Categoría eliminada correctamente",
      })
      fetchCategories()
    } catch (err) {
      console.error('Error deleting category:', err)
      toast({
        title: "Error",
        description: "Error al eliminar la categoría. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingCategory ? "Editar Categoría" : "Crear Nueva Categoría"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre de la Categoría</Label>
              <Input
                id="name"
                placeholder="Ingresa el nombre de la categoría"
                value={editingCategory ? editingCategory.name : newCategory.name}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, name: e.target.value })
                    : setNewCategory({ ...newCategory, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Ingresa una descripción (opcional)"
                value={editingCategory ? editingCategory.description || "" : newCategory.description}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, description: e.target.value })
                    : setNewCategory({ ...newCategory, description: e.target.value })
                }
              />
            </div>
            <div className="flex gap-2">
              {editingCategory ? (
                <>
                  <Button onClick={handleUpdateCategory}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Categoría
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingCategory(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Categoría
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center">Cargando categorías...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={fetchCategories}>Reintentar</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {categories.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay categorías creadas
                </div>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">
                          {category.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {category.products?.length || 0} productos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingCategory(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteCategory(category.id)}
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