"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getProducts, createProduct, deleteProduct, updateProduct, Product } from "@/lib/api"
import { getCategories, Category } from "@/lib/api"
import { getLocations, Location } from "@/lib/api"
import { getIngredients, Ingredient } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    categoryId: "",
    locationId: "",
    isActive: true,
    ingredients: [] as { ingredientId: string; quantity: number }[],
  })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchLocations()
    fetchIngredients()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getProducts()
      setProducts(data)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError("Error al cargar los productos. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (err) {
      console.error('Error fetching categories:', err)
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

  const fetchIngredients = async () => {
    try {
      const data = await getIngredients()
      setIngredients(data)
    } catch (err) {
      console.error('Error fetching ingredients:', err)
    }
  }

  const handleCreateProduct = async () => {
    try {
      if (!newProduct.name || !newProduct.price || !newProduct.categoryId || !newProduct.locationId) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos requeridos",
          variant: "destructive",
        })
        return
      }

      await createProduct({
        name: newProduct.name,
        description: newProduct.description || undefined,
        price: newProduct.price,
        image: newProduct.image || undefined,
        categoryId: newProduct.categoryId,
        locationId: newProduct.locationId,
        isActive: newProduct.isActive,
        ingredients: newProduct.ingredients,
      })

      toast({
        title: "Éxito",
        description: "Producto creado correctamente",
      })

      setNewProduct({
        name: "",
        description: "",
        price: 0,
        image: "",
        categoryId: "",
        locationId: "",
        isActive: true,
        ingredients: [],
      })

      fetchProducts()
    } catch (err) {
      console.error('Error creating product:', err)
      toast({
        title: "Error",
        description: "Error al crear el producto. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return

    try {
      if (!editingProduct.name || !editingProduct.price || !editingProduct.categoryId || !editingProduct.locationId) {
        toast({
          title: "Error",
          description: "Por favor completa todos los campos requeridos",
          variant: "destructive",
        })
        return
      }

      await updateProduct(editingProduct.id, {
        name: editingProduct.name,
        description: editingProduct.description || undefined,
        price: editingProduct.price,
        image: editingProduct.image || undefined,
        categoryId: editingProduct.categoryId,
        locationId: editingProduct.locationId,
        isActive: editingProduct.isActive,
        ingredients: editingProduct.ingredients?.map(pi => ({
          ingredientId: pi.ingredientId,
          quantity: pi.quantity,
        })) || [],
      })

      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente",
      })

      setEditingProduct(null)
      fetchProducts()
    } catch (err) {
      console.error('Error updating product:', err)
      toast({
        title: "Error",
        description: "Error al actualizar el producto. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id)
      toast({
        title: "Éxito",
        description: "Producto eliminado correctamente",
      })
      fetchProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
      toast({
        title: "Error",
        description: "Error al eliminar el producto. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const addIngredient = (product: typeof newProduct | Product) => {
    const newIngredient = {
      ingredientId: "",
      quantity: 0,
    }
    if ('ingredients' in product) {
      product.ingredients.push(newIngredient)
    }
  }

  const removeIngredient = (product: typeof newProduct | Product, index: number) => {
    if ('ingredients' in product) {
      product.ingredients.splice(index, 1)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del Producto</Label>
              <Input
                id="name"
                placeholder="Ingresa el nombre del producto"
                value={editingProduct ? editingProduct.name : newProduct.name}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, name: e.target.value })
                    : setNewProduct({ ...newProduct, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Ingresa una descripción (opcional)"
                value={editingProduct ? editingProduct.description || "" : newProduct.description}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, description: e.target.value })
                    : setNewProduct({ ...newProduct, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Precio</Label>
              <Input
                id="price"
                type="number"
                placeholder="Ingresa el precio"
                value={editingProduct ? editingProduct.price : newProduct.price}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })
                    : setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image">URL de la Imagen</Label>
              <Input
                id="image"
                placeholder="Ingresa la URL de la imagen"
                value={editingProduct ? editingProduct.image || "" : newProduct.image}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, image: e.target.value })
                    : setNewProduct({ ...newProduct, image: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryId">Categoría</Label>
              <Select
                value={editingProduct ? editingProduct.categoryId : newProduct.categoryId}
                onValueChange={(value) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, categoryId: value })
                    : setNewProduct({ ...newProduct, categoryId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="locationId">Ubicación</Label>
              <Select
                value={editingProduct ? editingProduct.locationId : newProduct.locationId}
                onValueChange={(value) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, locationId: value })
                    : setNewProduct({ ...newProduct, locationId: value })
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
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={editingProduct ? editingProduct.isActive : newProduct.isActive}
                onCheckedChange={(checked) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, isActive: checked })
                    : setNewProduct({ ...newProduct, isActive: checked })
                }
              />
              <Label htmlFor="isActive">Producto Activo</Label>
            </div>
            <div className="grid gap-2">
              <Label>Ingredientes</Label>
              <div className="space-y-4">
                {(editingProduct ? editingProduct.ingredients : newProduct.ingredients)?.map((ingredient, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Ingrediente</Label>
                      <Select
                        value={ingredient.ingredientId}
                        onValueChange={(value) => {
                          if (editingProduct) {
                            const newIngredients = [...editingProduct.ingredients || []]
                            newIngredients[index].ingredientId = value
                            setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                          } else {
                            const newIngredients = [...newProduct.ingredients]
                            newIngredients[index].ingredientId = value
                            setNewProduct({ ...newProduct, ingredients: newIngredients })
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        value={ingredient.quantity}
                        onChange={(e) => {
                          if (editingProduct) {
                            const newIngredients = [...editingProduct.ingredients || []]
                            newIngredients[index].quantity = parseFloat(e.target.value)
                            setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                          } else {
                            const newIngredients = [...newProduct.ingredients]
                            newIngredients[index].quantity = parseFloat(e.target.value)
                            setNewProduct({ ...newProduct, ingredients: newIngredients })
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        if (editingProduct) {
                          const newIngredients = [...editingProduct.ingredients || []]
                          newIngredients.splice(index, 1)
                          setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                        } else {
                          const newIngredients = [...newProduct.ingredients]
                          newIngredients.splice(index, 1)
                          setNewProduct({ ...newProduct, ingredients: newIngredients })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (editingProduct) {
                      const newIngredients = [...editingProduct.ingredients || []]
                      newIngredients.push({ ingredientId: "", quantity: 0 })
                      setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                    } else {
                      const newIngredients = [...newProduct.ingredients]
                      newIngredients.push({ ingredientId: "", quantity: 0 })
                      setNewProduct({ ...newProduct, ingredients: newIngredients })
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Ingrediente
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              {editingProduct ? (
                <>
                  <Button onClick={handleUpdateProduct}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Actualizar Producto
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingProduct(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateProduct}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Producto
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos Existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center">Cargando productos...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={fetchProducts}>Reintentar</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {products.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay productos creados
                </div>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Precio: ${product.price}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Categoría: {product.category?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ubicación: {product.location?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Estado: {product.isActive ? "Activo" : "Inactivo"}
                      </p>
                      {product.ingredients && product.ingredients.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Ingredientes:</p>
                          <ul className="text-sm text-muted-foreground">
                            {product.ingredients.map((pi, index) => (
                              <li key={index}>
                                {pi.ingredient?.name}: {pi.quantity} {pi.ingredient?.unit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingProduct(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteProduct(product.id)}
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