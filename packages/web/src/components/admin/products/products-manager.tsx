"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, ChevronUp, List, Grid } from "lucide-react"
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
import { ImageUpload } from "./image-upload"
import { Badge } from "@/components/ui/badge"

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    categoryId: "",
    locationId: "",
    isActive: true,
    quantity: 0,
    ingredients: [] as {
      id: string;
      productId: string;
      ingredientId: string;
      quantity: number;
      createdAt: string;
      updatedAt: string;
    }[],
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
        quantity: newProduct.quantity,
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
        quantity: 0,
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
        quantity: editingProduct.quantity,
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
      const fullIngredient = {
        id: `temp-${Date.now()}`,
        productId: ('id' in product) ? product.id : "",
        ingredientId: "",
        quantity: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      product.ingredients.push(fullIngredient)
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
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>
              {editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateFormVisible(!isCreateFormVisible)}
              className="flex items-center gap-2"
            >
              {isCreateFormVisible ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Contraer
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear Producto
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {(isCreateFormVisible || editingProduct) && (
          <CardContent className="pt-4">
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
                  min="0"
                  placeholder="Ingresa el precio"
                  value={editingProduct ? editingProduct.price : newProduct.price}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : Number(e.target.value);
                    if (editingProduct) {
                      setEditingProduct({ ...editingProduct, price: value });
                    } else {
                      setNewProduct({ ...newProduct, price: value });
                    }
                  }}
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Imagen del Producto</Label>
                <ImageUpload
                  onImageUploaded={(url) => {
                    if (editingProduct) {
                      setEditingProduct({ ...editingProduct, image: url })
                    } else {
                      setNewProduct({ ...newProduct, image: url })
                    }
                  }}
                  currentImage={editingProduct ? editingProduct.image : newProduct.image}
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
                <Label htmlFor="quantity">Stock Actual</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  placeholder="Ingresa el stock actual"
                  value={editingProduct ? editingProduct.quantity || 0 : newProduct.quantity}
                  onChange={(e) =>
                    editingProduct
                      ? setEditingProduct({ ...editingProduct, quantity: parseFloat(e.target.value) })
                      : setNewProduct({ ...newProduct, quantity: parseFloat(e.target.value) })
                  }
                />
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
                        newIngredients.push({
                          id: `temp-${Date.now()}`,
                          productId: editingProduct.id,
                          ingredientId: "",
                          quantity: 0,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        })
                        setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                      } else {
                        const newIngredients = [...newProduct.ingredients]
                        newIngredients.push({
                          id: `temp-${Date.now()}`,
                          productId: "",
                          ingredientId: "",
                          quantity: 0,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        })
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
                      onClick={() => {
                        setEditingProduct(null);
                        setIsCreateFormVisible(false);
                      }}
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
        )}
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Productos Existentes</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                Lista
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="flex items-center gap-2"
              >
                <Grid className="h-4 w-4" />
                Grid
              </Button>
            </div>
          </div>
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
            <>
              {products.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay productos creados
                </div>
              ) : viewMode === 'list' ? (
                <div className="grid gap-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {product.image && (
                          <div className="relative w-20 h-20">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground">
                              {product.description}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Precio: ${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Categoría: {product.category?.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Ubicación: {locations.find(loc => loc.id === product.locationId)?.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Estado: {product.isActive ? "Activo" : "Inactivo"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Stock actual: {product.quantity || 0}
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
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <Card key={product.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="relative">
                          {product.image ? (
                            <div className="aspect-square w-full overflow-hidden">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="aspect-square w-full bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground">Sin imagen</span>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                              onClick={() => setEditingProduct(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold">{product.name}</h3>
                              {product.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <Badge variant={product.isActive ? "default" : "secondary"}>
                              {product.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Precio:</span>
                              <span className="font-medium">
                                ${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Categoría:</span>
                              <span>{product.category?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Ubicación:</span>
                              <span>{locations.find(loc => loc.id === product.locationId)?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Stock:</span>
                              <span>{product.quantity || 0}</span>
                            </div>
                          </div>

                          {product.ingredients && product.ingredients.length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-sm font-medium mb-1">Ingredientes:</p>
                              <div className="flex flex-wrap gap-1">
                                {product.ingredients.map((pi, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {pi.ingredient?.name}: {pi.quantity} {pi.ingredient?.unit}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}