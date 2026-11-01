"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, ChevronUp, List, Grid, Search, Expand, Shrink } from "lucide-react"
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, toFiniteNumber } from "@/lib/utils"

import { ImportProductsDialog } from "./import-products-dialog"
import { FileText } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

// Custom hook for mobile viewport height
function useMobileViewportHeight() {
  const [vh, setVh] = useState('100vh');

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setVh(`${window.innerHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('scroll', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('scroll', updateHeight);
    };
  }, []);

  return vh;
}

const CategoryTitle = ({ title }: { title: string }) => {
  const words = title.split(' ')
  const lastWord = words.pop() || ''
  const firstPart = words.join(' ')

  return (
    <div className="text-center my-6">
      {firstPart && (
        <h2
          className="text-3xl"
          style={{
            fontFamily: "'Anton', sans-serif",
            color: '#c83b3b',
            textTransform: 'uppercase',
            fontWeight: 400,
            letterSpacing: '0.05em',
            lineHeight: 1,
          }}
        >
          {firstPart}
        </h2>
      )}
      <h3
        className="text-5xl"
        style={{
          fontFamily: "'Pacifico', cursive",
          color: '#e58c3d',
          lineHeight: 1.2,
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {lastWord}
      </h3>
    </div>
  )
}

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedProductType, setSelectedProductType] = useState<"all" | "sale" | "intermediate">("all")
  const [selectedLocationId, setSelectedLocationId] = useState("all")
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    categoryId: "",
    locationId: "",
    isActive: true,
    isIntermediate: false,
    unit: "unidad",
    quantity: 0,
    ingredients: [] as any[],
    components: [] as { componentId: string; quantity: number }[],
    variantGroups: [] as any[],
  })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const { toast } = useToast()
  const { user, isLoading: isAuthLoading } = useAuth()
  const isSuperAdmin = user?.role === "SUPER_ADMIN"
  const [productToDelete, setProductToDelete] = useState<{ id: string, name: string } | null>(null)
  const [scrollToProductId, setScrollToProductId] = useState<string | null>(null)
  const productRefs = useRef<Map<string, HTMLElement>>(new Map())
  const vh = useMobileViewportHeight()

  useEffect(() => {
    if (scrollToProductId && productRefs.current.has(scrollToProductId)) {
      const element = productRefs.current.get(scrollToProductId)
      setTimeout(() => {
        element?.scrollIntoView({ behavior: "smooth", block: "center" })
        setScrollToProductId(null)
      }, 100)
    }
  }, [products, scrollToProductId])

  const fetchProducts = async (locationId?: string) => {
    try {
      setLoading(true)
      setError(null)
      if (!isSuperAdmin && !locationId) {
        setProducts([])
        setError("Tu usuario no tiene una sucursal asignada.")
        return
      }

      const data = await getProducts(locationId)
      const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      setProducts(sortedData)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError("Error al cargar los productos. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const reloadProducts = () =>
    fetchProducts(isSuperAdmin ? undefined : user?.locationId ?? undefined)

  useEffect(() => {
    if (isAuthLoading || !user) return

    void reloadProducts()
    void fetchCategories()
    void fetchLocations()
    void fetchIngredients()
  }, [isAuthLoading, isSuperAdmin, user])

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

  const resetNewProductForm = () => {
    setNewProduct({
      name: "",
      description: "",
      price: 0,
      image: "",
      categoryId: "",
      locationId: "",
      isActive: true,
      isIntermediate: false,
      unit: "unidad",
      quantity: 0,
      ingredients: [],
      components: [],
      variantGroups: [],
    })
  }

  const handleCreateProduct = async () => {
    try {
      if (
        !newProduct.name.trim() ||
        !newProduct.categoryId ||
        !newProduct.locationId ||
        !newProduct.unit.trim() ||
        !Number.isFinite(newProduct.price) ||
        newProduct.price < 0 ||
        (!newProduct.isIntermediate && newProduct.price === 0)
      ) {
        toast({
          title: "Revisa los datos del producto",
          description: newProduct.isIntermediate
            ? "Completa el nombre, categoría, sucursal y unidad."
            : "Completa el nombre, un precio mayor que cero, categoría, sucursal y unidad.",
          variant: "destructive",
        })
        return
      }

      if (
        newProduct.ingredients.some(
          (line) => !line.ingredientId || !Number.isFinite(line.quantity) || line.quantity <= 0,
        ) ||
        newProduct.components.some(
          (line) => !line.componentId || !Number.isFinite(line.quantity) || line.quantity <= 0,
        )
      ) {
        toast({
          title: "Receta incompleta",
          description: "Selecciona cada insumo y asigna una cantidad mayor que cero.",
          variant: "destructive",
        })
        return
      }

      const variantGroupsWithIds = (newProduct.variantGroups || []).map(group => ({
        ...group,
        id: group.id || crypto.randomUUID(),
        variants: (group.variants || []).map((variant: any) => ({
          ...variant,
          id: variant.id || crypto.randomUUID(),
        }))
      }))

      await createProduct({
        ...newProduct,
        unit: newProduct.unit.trim(),
        locationId: isSuperAdmin ? newProduct.locationId : user?.locationId ?? "",
        variantGroups: variantGroupsWithIds,
      })
      toast({
        title: "Éxito",
        description: "Producto creado correctamente",
      })
      resetNewProductForm()
      setIsCreateDialogOpen(false)
      void reloadProducts()
    } catch (err) {
      console.error('Error creating product:', err)
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Error al crear el producto. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handleBulkImport = async (importedProducts: any[]) => {
    try {
      setLoading(true)
      for (const product of importedProducts) {
        await createProduct({
          ...product,
          locationId: isSuperAdmin ? product.locationId : user?.locationId ?? "",
          isActive: true,
          quantity: 0
        })
      }
      toast({
        title: "Éxito",
        description: `${importedProducts.length} productos importados correctamente`,
      })
      void reloadProducts()
    } catch (err) {
      console.error('Error in bulk import:', err)
      toast({
        title: "Error parcial",
        description: "Hubo un problema al importar algunos productos.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    try {
      if (
        !editingProduct.name.trim() ||
        !editingProduct.categoryId ||
        !editingProduct.locationId ||
        !editingProduct.unit.trim() ||
        !Number.isFinite(editingProduct.price) ||
        editingProduct.price < 0 ||
        (!editingProduct.isIntermediate && editingProduct.price === 0)
      ) {
        toast({
          title: "Revisa los datos del producto",
          description: editingProduct.isIntermediate
            ? "Completa el nombre, categoría, sucursal y unidad."
            : "Completa el nombre, un precio mayor que cero, categoría, sucursal y unidad.",
          variant: "destructive",
        })
        return
      }
      if (
        (editingProduct.ingredients ?? []).some(
          (line) => !line.ingredientId || !Number.isFinite(line.quantity) || line.quantity <= 0,
        ) ||
        (editingProduct.components ?? []).some(
          (line) => !line.componentId || !Number.isFinite(line.quantity) || line.quantity <= 0,
        )
      ) {
        toast({
          title: "Receta incompleta",
          description: "Selecciona cada insumo y asigna una cantidad mayor que cero.",
          variant: "destructive",
        })
        return
      }
      await updateProduct(editingProduct.id, {
        ...editingProduct,
        quantity: undefined,
        unit: editingProduct.unit.trim(),
        locationId: isSuperAdmin ? editingProduct.locationId : user?.locationId ?? "",
        ingredients: editingProduct.ingredients?.map(pi => ({
          ingredientId: pi.ingredientId,
          quantity: pi.quantity,
        })) || [],
        components: editingProduct.components?.map(({ componentId, quantity }) => ({
          componentId,
          quantity,
        })) || [],
      })
      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente",
      })
      setIsEditDialogOpen(false)
      setEditingProduct(null)
      void reloadProducts()
    } catch (err) {
      console.error('Error updating product:', err)
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Error al actualizar el producto.",
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
      void reloadProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto.",
        variant: "destructive",
      })
    }
  }

  const handleEditClick = (product: Product) => {
    setEditingProduct({
      ...product,
      variantGroups: product.variantGroups || [],
    })
    setIsEditDialogOpen(true)
  }

  const handleCreateDialogClose = () => {
    setIsCreateDialogOpen(false)
    resetNewProductForm()
  }

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false)
    setEditingProduct(null)
  }

  const addIngredient = (product: any) => {
    if (product.ingredients) {
      product.ingredients.push({
        ingredientId: "",
        quantity: 0,
      })
    }
  }

  const removeIngredient = (product: any, index: number) => {
    if (product.ingredients) {
      product.ingredients.splice(index, 1)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesLocation =
      !isSuperAdmin ||
      selectedLocationId === "all" ||
      product.locationId === selectedLocationId
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
    const matchesProductType =
      selectedProductType === "all" ||
      (selectedProductType === "intermediate" ? product.isIntermediate : !product.isIntermediate)
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesLocation && matchesCategory && matchesProductType && matchesSearch
  })

  const groupedProducts = selectedCategory === "all"
    ? categories.map(category => ({
      categoryName: category.name,
      categoryId: category.id,
      products: filteredProducts.filter(p => p.categoryId === category.id),
    })).filter(group => group.products.length > 0)
    : filteredProducts.length > 0
      ? [{
        categoryName: categories.find(c => c.id === selectedCategory)?.name || "",
        categoryId: selectedCategory,
        products: filteredProducts,
      }]
      : []

  const addVariantToGroup = (groupIdx: number) => {
    setNewProduct(prev => {
      const groups = [...prev.variantGroups]
      groups[groupIdx].variants.push({ id: crypto.randomUUID(), name: '', price: undefined, isActive: true })
      return { ...prev, variantGroups: groups }
    })
  }

  const addVariantGroup = () => {
    setNewProduct(prev => ({
      ...prev,
      variantGroups: [
        ...prev.variantGroups,
        { id: crypto.randomUUID(), name: '', order: prev.variantGroups.length, variants: [] }
      ]
    }))
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden" >
      <Card className="w-full">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-lg sm:text-xl">Catálogo de productos y preparaciones</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isSuperAdmin && !user?.locationId) {
                      toast({
                        title: "Sucursal requerida",
                        description: "Tu usuario no tiene una sucursal asignada.",
                        variant: "destructive",
                      })
                      return
                    }
                    setIsImportDialogOpen(true)
                  }}
                  className="flex items-center gap-2 border-primary text-primary hover:bg-primary/10"
                >
                  <FileText className="h-4 w-4" />
                  Importar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (!isSuperAdmin && !user?.locationId) {
                      toast({
                        title: "Sucursal requerida",
                        description: "Tu usuario no tiene una sucursal asignada.",
                        variant: "destructive",
                      })
                      return
                    }
                    setNewProduct((current) => ({
                      ...current,
                      locationId: isSuperAdmin
                        ? selectedLocationId === "all" ? "" : selectedLocationId
                        : user?.locationId ?? "",
                      isIntermediate: selectedProductType === "intermediate",
                      price: selectedProductType === "intermediate" ? 0 : current.price,
                    }))
                    setIsCreateDialogOpen(true)
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Crear producto / preparación
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="flex-1 sm:flex-none"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Lista</span>
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="flex-1 sm:flex-none"
                >
                  <Grid className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Grid</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              {isSuperAdmin && (
                <Select
                  value={selectedLocationId}
                  onValueChange={setSelectedLocationId}
                >
                  <SelectTrigger className="w-full md:w-[220px]">
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sucursales</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select
                value={selectedProductType}
                onValueChange={(value) => {
                  if (value === "all" || value === "sale" || value === "intermediate") {
                    setSelectedProductType(value)
                  }
                }}
              >
                <SelectTrigger className="w-full md:w-[220px]" aria-label="Tipo de catálogo">
                  <SelectValue placeholder="Tipo de catálogo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Productos y preparaciones</SelectItem>
                  <SelectItem value="sale">Productos de venta</SelectItem>
                  <SelectItem value="intermediate">Preparaciones intermedias</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(searchTerm || selectedCategory !== "all" || selectedProductType !== "all" || selectedLocationId !== "all") && (
              <div className="text-sm text-muted-foreground">
                Mostrando {filteredProducts.length} de {products.length} elementos del catálogo
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="w-full">
          {loading || isAuthLoading ? (
            <div className="text-center">Cargando productos...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={() => void reloadProducts()}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {groupedProducts.length === 0 ? (
                <div className="text-center text-muted-foreground pt-8">
                  {products.length === 0
                    ? "Aún no hay productos ni preparaciones creados."
                    : selectedProductType === "intermediate"
                      ? "No hay preparaciones intermedias que coincidan con los filtros."
                      : selectedProductType === "sale"
                        ? "No hay productos de venta que coincidan con los filtros."
                        : "No se encontraron elementos que coincidan con los filtros."}
                </div>
              ) : (
                <div className="space-y-8 pt-4">
                  {groupedProducts.map(({ categoryId, categoryName, products: groupProducts }) => (
                    <div key={categoryId}>
                      <CategoryTitle title={categoryName} />
                      {viewMode === 'list' ? (
                        <div className="grid gap-4 w-full">
                          {groupProducts.map((product) => (
                            <div
                              key={product.id}
                              ref={el => {
                                if (el) productRefs.current.set(product.id, el);
                                else productRefs.current.delete(product.id);
                              }}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4 w-full"
                            >
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                                {product.image && (
                                  <div className="relative w-20 h-20 flex-shrink-0">
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{product.name}</p>
                                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                                    Código: {product.code}
                                  </p>
                                  {product.isIntermediate && (
                                    <Badge variant="secondary" className="mt-1">
                                      Preparación intermedia
                                    </Badge>
                                  )}
                                  {product.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {product.description}
                                    </p>
                                  )}
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                    {!product.isIntermediate && (
                                      <p className="text-sm text-muted-foreground">
                                        Precio: ${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                      </p>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                      Categoría: {product.category?.name}
                                    </p>
                                    {isSuperAdmin && (
                                      <p className="text-sm text-muted-foreground">
                                        Ubicación: {product.location?.name || locations.find(loc => loc.id === product.locationId)?.name}
                                      </p>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                      Estado: {product.isActive ? "Activo" : "Inactivo"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Stock: {product.quantity || 0} {product.unit}
                                    </p>
                                  </div>
                                  {product.ingredients && product.ingredients.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-sm font-medium">Ingredientes:</p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {product.ingredients.map((pi, index) => (
                                          <Badge key={index} variant="outline" className="text-xs">
                                            {pi.ingredient?.name}: {pi.quantity} {pi.ingredient?.unit}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {product.components && product.components.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-sm font-medium">Productos preelaborados:</p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {product.components.map((component) => (
                                          <Badge key={component.id} variant="outline" className="text-xs">
                                            {component.component?.name}: {component.quantity}{" "}
                                            {component.component?.unit}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {product.variantGroups && product.variantGroups.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-sm font-medium">Variantes:</p>
                                      <div className="space-y-2">
                                        {product.variantGroups.map((group, gIdx) => (
                                          <div key={gIdx}>
                                            <span className="font-semibold text-xs">{group.name}:</span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                              {group.variants.map((variant, vIdx) => (
                                                <div key={vIdx} className="flex items-center gap-2 border rounded px-2 py-1 bg-muted/50">
                                                  {variant.image && (
                                                    <img src={variant.image} alt={variant.name} className="w-8 h-8 object-cover rounded" />
                                                  )}
                                                  <span className="font-medium text-xs">{variant.name}</span>
                                                  {typeof variant.price === 'number' && !isNaN(variant.price) && (
                                                    <span className="text-xs text-muted-foreground">${variant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                                                  )}
                                                  <span className="text-[10px] ml-2">
                                                    {variant.isActive ? 'Activa' : 'Inactiva'}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditClick(product)}
                                  className="flex-1 sm:flex-none"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                                  className="flex-1 sm:flex-none"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full">
                          {groupProducts.map((product) => {
                            return (
                              <Card
                                key={product.id}
                                ref={el => {
                                  if (el) productRefs.current.set(product.id, el as HTMLElement);
                                  else productRefs.current.delete(product.id);
                                }}
                                className="overflow-hidden w-full flex flex-col"
                              >
                                <CardContent className="p-0 flex-1 flex flex-col">
                                  <div className="relative">
                                    {product.image ? (
                                      <div className="aspect-square sm:aspect-video w-full overflow-hidden">
                                        <img
                                          src={product.image}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="aspect-square sm:aspect-video w-full bg-muted flex items-center justify-center">
                                        <span className="text-muted-foreground">Sin imagen</span>
                                      </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex flex-col gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                                        onClick={() => handleEditClick(product)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-destructive/90"
                                        onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <h3 className="font-semibold truncate">{product.name}</h3>
                                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                                            Código: {product.code}
                                          </p>
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

                                      <div className="space-y-1 text-sm mt-2">
                                        {!product.isIntermediate && (
                                          <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Precio:</span>
                                            <span className="font-medium">
                                              ${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                            </span>
                                          </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Categoría:</span>
                                          <span className="truncate">{product.category?.name}</span>
                                        </div>
                                        {isSuperAdmin && (
                                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>Sucursal:</span>
                                            <span className="truncate">{product.location?.name || locations.find(loc => loc.id === product.locationId)?.name}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Stock:</span>
                                          <span>{product.quantity || 0} {product.unit}</span>
                                        </div>
                                        {product.isIntermediate && (
                                          <Badge variant="secondary">Preparación intermedia</Badge>
                                        )}
                                      </div>
                                    </div>

                                    {product.ingredients && product.ingredients.length > 0 && (
                                      <div className="pt-2 border-t mt-2">
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
                                    {product.components && product.components.length > 0 && (
                                      <div className="pt-2 border-t mt-2">
                                        <p className="text-sm font-medium mb-1">Productos preelaborados:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {product.components.map((component) => (
                                            <Badge key={component.id} variant="outline" className="text-xs">
                                              {component.component?.name}: {component.quantity}{" "}
                                              {component.component?.unit}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {product.variantGroups && product.variantGroups.length > 0 && (
                                      <div className="pt-2 border-t mt-2">
                                        <p className="text-sm font-medium mb-1">Variantes:</p>
                                        <div className="flex flex-wrap gap-2">
                                          {product.variantGroups.map((group, gIdx) => (
                                            <div key={gIdx} className="border rounded p-2 bg-muted/50 w-full">
                                              <div className="font-medium text-sm mb-1">{group.name}</div>
                                              <div className="flex flex-wrap gap-2">
                                                {group.variants.map((variant, vIdx) => (
                                                  <div key={vIdx} className="flex items-center gap-2 border rounded px-2 py-1 bg-muted/70">
                                                    {variant.image && (
                                                      <img src={variant.image} alt={variant.name} className="w-8 h-8 object-cover rounded" />
                                                    )}
                                                    <span className="font-medium text-xs">{variant.name}</span>
                                                    {typeof variant.price === 'number' && !isNaN(variant.price) && (
                                                      <span className="text-xs text-muted-foreground">${variant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                                                    )}
                                                    <Badge variant={variant.isActive ? 'default' : 'secondary'} className="text-[10px]">{variant.isActive ? 'Activa' : 'Inactiva'}</Badge>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Product Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogClose} >
        <DialogContent
          className={cn(
            "max-w-4xl lg:max-w-6xl xl:max-w-7xl flex flex-col",
            "h-[calc(var(--vh,1vh)*90)] md:h-[600px]",
            "w-[calc(100%-2rem)] md:w-auto",
            "mx-auto md:mx-0",
            "top-[50%] md:top-[50%]",
            "translate-y-[-50%] md:translate-y-[-50%]",
            "rounded-lg md:rounded-lg",
            "p-0 md:p-6"
          )}
          style={{
            maxHeight: 'calc(var(--vh, 1vh) * 90)',
            height: 'calc(var(--vh, 1vh) * 90)'
          }}
        >
          <DialogHeader className="p-4 md:p-0 border-b">
            <DialogTitle>Crear producto o preparación</DialogTitle>
            <DialogDescription>
              Las preparaciones se producen por lote y se usan en las recetas; no se venden directamente.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4 md:p-0">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-name">Nombre del producto o preparación</Label>
                  <Input
                    id="create-name"
                    placeholder="Ingresa el nombre del producto"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    style={{
                      fontSize: '16px',
                      WebkitTextSizeAdjust: '100%'
                    }}
                  />
                </div>
                {!newProduct.isIntermediate && (
                  <div className="grid gap-2">
                    <Label htmlFor="create-price">Precio de venta</Label>
                    <Input
                      id="create-price"
                      type="number"
                      min="0"
                      placeholder="Ingresa el precio"
                      value={newProduct.price}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                        setNewProduct({ ...newProduct, price: value });
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '0') {
                          e.target.value = '';
                        }
                      }}
                      style={{
                        fontSize: '16px',
                        WebkitTextSizeAdjust: '100%'
                      }}
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="create-categoryId">Categoría</Label>
                  <Select
                    value={newProduct.categoryId}
                    onValueChange={(value) => setNewProduct({ ...newProduct, categoryId: value })}
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
                {isSuperAdmin && (
                  <div className="grid gap-2">
                    <Label htmlFor="create-locationId">Ubicación</Label>
                    <Select
                      value={newProduct.locationId}
                      onValueChange={(value) => setNewProduct({ ...newProduct, locationId: value })}
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
                )}
                <div className="grid gap-2">
                  <Label htmlFor="create-quantity">Stock Actual</Label>
                  <Input
                    id="create-quantity"
                    type="number"
                    min="0"
                    placeholder="Ingresa el stock actual"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: toFiniteNumber(e.target.value) })}
                    style={{
                      fontSize: '16px',
                      WebkitTextSizeAdjust: '100%'
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-unit">Unidad de medida / producción</Label>
                  <Input
                    id="create-unit"
                    placeholder="unidad, porción, kg..."
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="create-isActive"
                    checked={newProduct.isActive}
                    onCheckedChange={(checked) => setNewProduct({ ...newProduct, isActive: checked })}
                  />
                  <Label htmlFor="create-isActive">Producto Activo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="create-isIntermediate"
                    checked={newProduct.isIntermediate}
                    onCheckedChange={(checked) =>
                      setNewProduct({
                        ...newProduct,
                        isIntermediate: checked,
                        price: checked ? 0 : newProduct.price,
                      })
                    }
                  />
                  <Label htmlFor="create-isIntermediate">Es una preparación intermedia</Label>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Una preparación (por ejemplo, carne de hamburguesa) se produce desde Producción y se agrega a la receta del producto final. No aparece en el POS.
              </p>

              <div className="grid gap-2">
                <Label htmlFor="create-description">Descripción</Label>
                <Textarea
                  id="create-description"
                  placeholder="Ingresa una descripción (opcional)"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  style={{
                    fontSize: '16px',
                    WebkitTextSizeAdjust: '100%'
                  }}
                />
              </div>

              <div className="grid gap-2">
                <Label>Imagen del Producto</Label>
                <ImageUpload
                  onImageUploaded={(url) => setNewProduct({ ...newProduct, image: url })}
                  currentImage={newProduct.image}
                />
              </div>

              <div className="grid gap-2">
                <Label>Ingredientes</Label>
                <div className="space-y-4 w-full">
                  {newProduct.ingredients?.map((ingredient, index) => (
                    <div key={index} className="flex flex-col lg:flex-row gap-2 items-end w-full">
                      <div className="w-full lg:flex-1">
                        <Label>Ingrediente</Label>
                        <Select
                          value={ingredient.ingredientId}
                          onValueChange={(value) => {
                            const newIngredients = [...newProduct.ingredients]
                            newIngredients[index].ingredientId = value
                            setNewProduct({ ...newProduct, ingredients: newIngredients })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona un ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredients.filter((ing) => ing.locationId === newProduct.locationId).map((ing) => (
                              <SelectItem key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full lg:w-32">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          min="0.0001"
                          step="any"
                          value={ingredient.quantity}
                          onChange={(e) => {
                            const newIngredients = [...newProduct.ingredients]
                            newIngredients[index].quantity = toFiniteNumber(e.target.value)
                            setNewProduct({ ...newProduct, ingredients: newIngredients })
                          }}
                          style={{
                            fontSize: '16px',
                            WebkitTextSizeAdjust: '100%'
                          }}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="w-full lg:w-10"
                        onClick={() => {
                          const newIngredients = [...newProduct.ingredients]
                          newIngredients.splice(index, 1)
                          setNewProduct({ ...newProduct, ingredients: newIngredients })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
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
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Ingrediente
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Productos preelaborados de la receta</Label>
                <p className="text-sm text-muted-foreground">
                  Por ejemplo, agrega Carne de hamburguesa y define cuántas unidades lleva cada plato.
                </p>
                <div className="space-y-4 w-full">
                  {newProduct.components.map((component, index) => {
                    const selectedComponent = products.find(
                      (product) => product.id === component.componentId,
                    )
                    const availableComponents = products.filter(
                      (product) =>
                        product.isIntermediate &&
                        product.locationId === newProduct.locationId,
                    )

                    return (
                      <div key={index} className="flex flex-col lg:flex-row gap-2 items-end w-full">
                        <div className="w-full lg:flex-1">
                          <Label>Preparación</Label>
                          <Select
                            value={component.componentId}
                            onValueChange={(value) => {
                              const next = [...newProduct.components]
                              next[index] = { ...next[index], componentId: value }
                              setNewProduct({ ...newProduct, components: next })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una preparación" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableComponents.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full lg:w-40">
                          <Label>Cantidad por producto ({selectedComponent?.unit || "unidad"})</Label>
                          <Input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={component.quantity}
                            onChange={(e) => {
                              const next = [...newProduct.components]
                              next[index] = { ...next[index], quantity: Number(e.target.value) }
                              setNewProduct({ ...newProduct, components: next })
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() =>
                            setNewProduct({
                              ...newProduct,
                              components: newProduct.components.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setNewProduct({
                        ...newProduct,
                        components: [
                          ...newProduct.components,
                          { componentId: "", quantity: 1 },
                        ],
                      })
                    }
                    disabled={!products.some(
                      (product) =>
                        product.isIntermediate &&
                        product.locationId === newProduct.locationId,
                    )}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar preparación
                  </Button>
                  {newProduct.locationId &&
                    !products.some(
                      (product) =>
                        product.isIntermediate &&
                        product.locationId === newProduct.locationId,
                    ) && (
                      <p className="text-sm text-muted-foreground">
                        Primero crea un producto y márcalo como preparación intermedia.
                      </p>
                    )}
                </div>
              </div>

              {/* Grupos de variantes */}
              <div className="grid gap-2">
                <Label>Grupos de Variantes</Label>
                <div className="space-y-4 w-full">
                  {(newProduct.variantGroups || []).map((group, groupIdx) => (
                    <div key={groupIdx} className="border rounded p-2 bg-muted/30">
                      <div className="flex gap-2 items-center mb-2">
                        <Input
                          value={group.name}
                          onChange={e => {
                            const groups = [...newProduct.variantGroups]
                            groups[groupIdx].name = e.target.value
                            setNewProduct({ ...newProduct, variantGroups: groups })
                          }}
                          placeholder="Nombre del grupo (ej: Proteína, Sopa)"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            const groups = [...newProduct.variantGroups]
                            groups.splice(groupIdx, 1)
                            setNewProduct({ ...newProduct, variantGroups: groups })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(group.variants || []).map((variant, vIdx) => (
                          <div key={vIdx} className="flex gap-2 items-end">
                            <Input
                              value={variant.name}
                              onChange={e => {
                                const groups = [...newProduct.variantGroups]
                                groups[groupIdx].variants[vIdx].name = e.target.value
                                setNewProduct({ ...newProduct, variantGroups: groups })
                              }}
                              placeholder="Nombre de la variante (ej: Pollo, Carne, Sí, No)"
                            />
                            <Input
                              type="number"
                              value={variant.price ?? ''}
                              onChange={e => {
                                const groups = [...newProduct.variantGroups]
                                groups[groupIdx].variants[vIdx].price = e.target.value === '' ? undefined : Number(e.target.value)
                                setNewProduct({ ...newProduct, variantGroups: groups })
                              }}
                              placeholder="Precio opcional"
                            />
                            <Switch
                              checked={variant.isActive ?? true}
                              onCheckedChange={checked => {
                                const groups = [...newProduct.variantGroups]
                                groups[groupIdx].variants[vIdx].isActive = checked
                                setNewProduct({ ...newProduct, variantGroups: groups })
                              }}
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                const groups = [...newProduct.variantGroups]
                                groups[groupIdx].variants.splice(vIdx, 1)
                                setNewProduct({ ...newProduct, variantGroups: groups })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => {
                            const groups = [...newProduct.variantGroups]
                            groups[groupIdx].variants.push({ id: crypto.randomUUID(), name: '', price: undefined, image: '', isActive: true })
                            setNewProduct({ ...newProduct, variantGroups: groups })
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" /> Agregar Variante
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewProduct({
                        ...newProduct,
                        variantGroups: [
                          ...newProduct.variantGroups,
                          { id: crypto.randomUUID(), name: '', order: newProduct.variantGroups.length, variants: [] },
                        ],
                      })
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Agregar Grupo de Variantes
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="flex-none p-4 flex gap-2 border-t">
            <Button variant="outline" onClick={handleCreateDialogClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleCreateProduct} className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              Crear Producto
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* Edit Product Dialog */}
      < Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogClose} >
        <DialogContent
          className={cn(
            "max-w-4xl lg:max-w-6xl xl:max-w-7xl flex flex-col",
            "h-[calc(var(--vh,1vh)*90)] md:h-[600px]",
            "w-[calc(100%-2rem)] md:w-auto",
            "mx-auto md:mx-0",
            "top-[50%] md:top-[50%]",
            "translate-y-[-50%] md:translate-y-[-50%]",
            "rounded-lg md:rounded-lg",
            "p-0 md:p-6"
          )}
          style={{
            maxHeight: 'calc(var(--vh, 1vh) * 90)',
            height: 'calc(var(--vh, 1vh) * 90)'
          }}
        >
          <DialogHeader className="p-4 md:p-0 border-b">
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica la información del producto
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <ScrollArea className="flex-1 p-4 md:p-0">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Nombre del producto o preparación</Label>
                    <Input
                      id="edit-name"
                      placeholder="Ingresa el nombre del producto"
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      style={{
                        fontSize: '16px',
                        WebkitTextSizeAdjust: '100%'
                      }}
                    />
                  </div>
                  {!editingProduct.isIntermediate && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-price">Precio de venta</Label>
                      <Input
                        id="edit-price"
                        type="number"
                        min="0"
                        placeholder="Ingresa el precio"
                        value={editingProduct.price}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : Number(e.target.value);
                          setEditingProduct({ ...editingProduct, price: value });
                        }}
                        onFocus={(e) => {
                          if (e.target.value === '0') {
                            e.target.value = '';
                          }
                        }}
                        style={{
                          fontSize: '16px',
                          WebkitTextSizeAdjust: '100%'
                        }}
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="edit-categoryId">Categoría</Label>
                    <Select
                      value={editingProduct.categoryId}
                      onValueChange={(value) => setEditingProduct({ ...editingProduct, categoryId: value })}
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
                  {isSuperAdmin && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-locationId">Ubicación</Label>
                      <Select
                        value={editingProduct.locationId}
                        onValueChange={(value) => setEditingProduct({ ...editingProduct, locationId: value })}
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
                  )}
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-sm font-medium">
                      Existencias actuales: {editingProduct.quantity || 0} {editingProduct.unit || "unidad"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Para corregir esta cantidad, crea una modificación en Inventarios y registra el conteo físico.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-unit">Unidad de medida / producción</Label>
                    <Input
                      id="edit-unit"
                      value={editingProduct.unit || "unidad"}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, unit: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-isActive"
                      checked={editingProduct.isActive}
                      onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, isActive: checked })}
                    />
                    <Label htmlFor="edit-isActive">Producto Activo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-isIntermediate"
                      checked={editingProduct.isIntermediate}
                      onCheckedChange={(checked) =>
                        setEditingProduct({
                          ...editingProduct,
                          isIntermediate: checked,
                          price: checked ? 0 : editingProduct.price,
                        })
                      }
                    />
                      <Label htmlFor="edit-isIntermediate">Es una preparación intermedia</Label>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Una preparación (por ejemplo, carne de hamburguesa) se produce desde Producción y se agrega a la receta del producto final. No aparece en el POS.
                </p>

                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Descripción</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Ingresa una descripción (opcional)"
                    value={editingProduct.description || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    style={{
                      fontSize: '16px',
                      WebkitTextSizeAdjust: '100%'
                    }}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Imagen del Producto</Label>
                  <ImageUpload
                    onImageUploaded={(url) => setEditingProduct({ ...editingProduct, image: url })}
                    currentImage={editingProduct.image}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Ingredientes</Label>
                  <div className="space-y-4 w-full">
                    {editingProduct.ingredients?.map((ingredient, index) => (
                      <div key={index} className="flex flex-col lg:flex-row gap-2 items-end w-full">
                        <div className="w-full lg:flex-1">
                          <Label>Ingrediente</Label>
                          <Select
                            value={ingredient.ingredientId}
                            onValueChange={(value) => {
                              const newIngredients = [...editingProduct.ingredients || []]
                              newIngredients[index].ingredientId = value
                              setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona un ingrediente" />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredients.filter((ing) => ing.locationId === editingProduct.locationId).map((ing) => (
                                <SelectItem key={ing.id} value={ing.id}>
                                  {ing.name} ({ing.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full lg:w-32">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={ingredient.quantity}
                            onChange={(e) => {
                              const newIngredients = [...editingProduct.ingredients || []]
                              newIngredients[index].quantity = toFiniteNumber(e.target.value)
                              setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                            }}
                            style={{
                              fontSize: '16px',
                              WebkitTextSizeAdjust: '100%'
                            }}
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="w-full lg:w-10"
                          onClick={() => {
                            const newIngredients = [...editingProduct.ingredients || []]
                            newIngredients.splice(index, 1)
                            setEditingProduct({ ...editingProduct, ingredients: newIngredients })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
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
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Ingrediente
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Productos preelaborados de la receta</Label>
                  <p className="text-sm text-muted-foreground">
                    Define cuántas unidades de cada preparación consume este producto.
                  </p>
                  <div className="space-y-4 w-full">
                    {(editingProduct.components || []).map((component, index) => {
                      const selectedComponent = products.find(
                        (product) => product.id === component.componentId,
                      )
                      const availableComponents = products.filter(
                        (product) =>
                          product.id !== editingProduct.id &&
                          product.isIntermediate &&
                          product.locationId === editingProduct.locationId,
                      )

                      return (
                        <div key={component.id || index} className="flex flex-col lg:flex-row gap-2 items-end w-full">
                          <div className="w-full lg:flex-1">
                            <Label>Preparación</Label>
                            <Select
                              value={component.componentId}
                              onValueChange={(value) => {
                                const next = [...(editingProduct.components || [])]
                                next[index] = { ...next[index], componentId: value }
                                setEditingProduct({ ...editingProduct, components: next })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una preparación" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableComponents.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} ({product.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-full lg:w-40">
                            <Label>Cantidad por producto ({selectedComponent?.unit || "unidad"})</Label>
                            <Input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={component.quantity}
                              onChange={(e) => {
                                const next = [...(editingProduct.components || [])]
                                next[index] = { ...next[index], quantity: Number(e.target.value) }
                                setEditingProduct({ ...editingProduct, components: next })
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() =>
                              setEditingProduct({
                                ...editingProduct,
                                components: (editingProduct.components || []).filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEditingProduct({
                          ...editingProduct,
                          components: [
                            ...(editingProduct.components || []),
                            {
                              id: `temp-${Date.now()}`,
                              productId: editingProduct.id,
                              componentId: "",
                              quantity: 1,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            },
                          ],
                        })
                      }
                      disabled={!products.some(
                        (product) =>
                          product.id !== editingProduct.id &&
                          product.isIntermediate &&
                          product.locationId === editingProduct.locationId,
                      )}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar preparación
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Variantes</Label>
                  <div className="space-y-4 w-full">
                    {editingProduct.variantGroups?.map((group, groupIdx) => (
                      <div key={groupIdx} className="border rounded p-2 bg-muted/30">
                        <div className="flex gap-2 items-center mb-2">
                          <Input
                            value={group.name}
                            onChange={e => {
                              const groups = [...editingProduct.variantGroups]
                              groups[groupIdx].name = e.target.value
                              setEditingProduct({ ...editingProduct, variantGroups: groups })
                            }}
                            placeholder="Nombre del grupo (ej: Proteína, Sopa)"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              const groups = [...editingProduct.variantGroups]
                              groups.splice(groupIdx, 1)
                              setEditingProduct({ ...editingProduct, variantGroups: groups })
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(group.variants || []).map((variant, vIdx) => (
                            <div key={vIdx} className="flex gap-2 items-end">
                              <Input
                                value={variant.name}
                                onChange={e => {
                                  const groups = [...editingProduct.variantGroups]
                                  groups[groupIdx].variants[vIdx].name = e.target.value
                                  setEditingProduct({ ...editingProduct, variantGroups: groups })
                                }}
                                placeholder="Nombre de la variante (ej: Pollo, Carne, Sí, No)"
                              />
                              <Input
                                type="number"
                                value={variant.price ?? ''}
                                onChange={e => {
                                  const value = e.target.value === '' ? undefined : Number(e.target.value)
                                  const groups = [...editingProduct.variantGroups]
                                  groups[groupIdx].variants[vIdx].price = value
                                  setEditingProduct({ ...editingProduct, variantGroups: groups })
                                }}
                                placeholder="Precio opcional"
                              />
                              <Switch
                                checked={variant.isActive ?? true}
                                onCheckedChange={checked => {
                                  const groups = [...editingProduct.variantGroups]
                                  groups[groupIdx].variants[vIdx].isActive = checked
                                  setEditingProduct({ ...editingProduct, variantGroups: groups })
                                }}
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => {
                                  const groups = [...editingProduct.variantGroups]
                                  groups[groupIdx].variants.splice(vIdx, 1)
                                  setEditingProduct({ ...editingProduct, variantGroups: groups })
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            onClick={() => {
                              const groups = [...editingProduct.variantGroups]
                              groups[groupIdx].variants.push({ id: crypto.randomUUID(), name: '', price: undefined, image: '', isActive: true })
                              setEditingProduct({ ...editingProduct, variantGroups: groups })
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar Variante
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingProduct({
                          ...editingProduct,
                          variantGroups: [
                            ...editingProduct.variantGroups,
                            { id: crypto.randomUUID(), name: '', order: editingProduct.variantGroups.length, variants: [] },
                          ],
                        })
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Grupo de Variantes
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <div className="flex-none p-4 flex gap-2 border-t">
            <Button variant="outline" onClick={handleEditDialogClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleUpdateProduct} className="flex-1">
              <Pencil className="mr-2 h-4 w-4" />
              Actualizar Producto
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] mx-auto">
          <DialogHeader className="text-center">
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription className="pt-2 text-center">
              ¿Estás seguro que deseas eliminar el producto <span className="font-bold">{productToDelete?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 justify-center">
            <Button
              variant="outline"
              onClick={() => setProductToDelete(null)}
              className="w-full sm:w-auto"
            >
              No, mantener
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (productToDelete) {
                  handleDeleteProduct(productToDelete.id)
                  setProductToDelete(null)
                }
              }}
              className="w-full sm:w-auto"
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportProductsDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onProductsImported={handleBulkImport}
        categories={categories}
        locations={isSuperAdmin ? locations : locations.filter((location) => location.id === user?.locationId)}
        showLocationSelector={isSuperAdmin}
        defaultLocationId={!isSuperAdmin ? user?.locationId ?? "" : undefined}
        onCategoryCreated={fetchCategories}
      />
    </div >
  )
}