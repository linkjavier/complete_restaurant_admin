"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, ChevronUp, List, Grid, Search } from "lucide-react"
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
import { cn } from "@/lib/utils"

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
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
    variants: [] as {
      id: string;
      name: string;
      price?: number;
      image?: string;
      isActive?: boolean;
    }[],
  })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const { toast } = useToast()
  const [productToDelete, setProductToDelete] = useState<{ id: string, name: string } | null>(null)
  const [scrollToProductId, setScrollToProductId] = useState<string | null>(null)
  const productRefs = useRef<Map<string, HTMLElement>>(new Map())
  const vh = useMobileViewportHeight()

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchLocations()
    fetchIngredients()
  }, [])

  useEffect(() => {
    if (scrollToProductId && productRefs.current.has(scrollToProductId)) {
      const element = productRefs.current.get(scrollToProductId)
      setTimeout(() => {
        element?.scrollIntoView({ behavior: "smooth", block: "center" })
        setScrollToProductId(null)
      }, 100)
    }
  }, [products, scrollToProductId])

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
        variants: newProduct.variants.map(v => ({
          ...v,
          id: v.id || `temp-${Date.now()}-${Math.random()}`
        })),
      })

      toast({
        title: "Éxito",
        description: "Producto creado correctamente",
      })

      resetNewProductForm()
      setIsCreateDialogOpen(false)
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
        variants: editingProduct.variants.map(v => ({
          ...v,
          id: v.id || `temp-${Date.now()}-${Math.random()}`
        })),
      })

      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente",
      })

      setIsEditDialogOpen(false)
      setScrollToProductId(editingProduct.id)
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

  const handleEditClick = (product: Product) => {
    setEditingProduct(product)
    setIsEditDialogOpen(true)
  }

  // Filter products based on search term and selected category
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const groupedProducts =
    selectedCategory === "all"
      ? Object.values(
          filteredProducts.reduce((acc, product) => {
            const categoryId = product.categoryId || "uncategorized"
            const category = categories.find((c) => c.id === product.categoryId)

            if (!acc[categoryId]) {
              acc[categoryId] = {
                categoryName: category?.name || "Sin Categoría",
                categoryId: categoryId,
                products: [],
              }
            }
            acc[categoryId].products.push(product)
            return acc
          }, {} as Record<string, { categoryName: string; categoryId: string; products: Product[] }>)
        ).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
      : filteredProducts.length > 0
      ? [
          {
            categoryName: categories.find((c) => c.id === selectedCategory)?.name || "",
            categoryId: selectedCategory,
            products: filteredProducts,
          },
        ]
      : []

  const resetNewProductForm = () => {
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
      variants: [],
    })
  }

  const handleCreateDialogClose = () => {
    setIsCreateDialogOpen(false)
    resetNewProductForm()
  }

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false)
    setEditingProduct(null)
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      <Card className="w-full">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-lg sm:text-xl">Productos Existentes</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Crear Producto
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
            {(searchTerm || selectedCategory !== "all") && (
              <div className="text-sm text-muted-foreground">
                Mostrando {filteredProducts.length} de {products.length} productos
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="w-full">
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
              {groupedProducts.length === 0 ? (
                <div className="text-center text-muted-foreground pt-8">
                  {products.length === 0
                    ? "No hay productos creados"
                    : "No se encontraron productos que coincidan con la búsqueda"}
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
                                  {product.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {product.description}
                                    </p>
                                  )}
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
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
                                      Stock: {product.quantity || 0}
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
                                  {product.variants && product.variants.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-sm font-medium">Variantes:</p>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {product.variants.map((variant, vIdx) => (
                                          <div key={vIdx} className="flex items-center gap-2 border rounded px-2 py-1 bg-muted/50">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                          {groupProducts.map((product) => (
                            <Card
                              key={product.id}
                              ref={el => {
                                if (el) productRefs.current.set(product.id, el as HTMLElement);
                                else productRefs.current.delete(product.id);
                              }}
                              className="overflow-hidden w-full"
                            >
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
                                <div className="p-4 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <h3 className="font-semibold truncate">{product.name}</h3>
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
                                      <span className="truncate">{product.category?.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">Ubicación:</span>
                                      <span className="truncate">{locations.find(loc => loc.id === product.locationId)?.name}</span>
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
                                  {product.variants && product.variants.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <p className="text-sm font-medium mb-1">Variantes:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {product.variants.map((variant, vIdx) => (
                                          <div key={vIdx} className="flex items-center gap-2 border rounded px-2 py-1 bg-muted/50">
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
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
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
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogClose}>
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
            <DialogTitle>Crear Nuevo Producto</DialogTitle>
            <DialogDescription>
              Completa la información del nuevo producto
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4 md:p-0">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-name">Nombre del Producto</Label>
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
                <div className="grid gap-2">
                  <Label htmlFor="create-price">Precio</Label>
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
                <div className="grid gap-2">
                  <Label htmlFor="create-quantity">Stock Actual</Label>
                  <Input
                    id="create-quantity"
                    type="number"
                    min="0"
                    placeholder="Ingresa el stock actual"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: parseFloat(e.target.value) })}
                    style={{ 
                      fontSize: '16px',
                      WebkitTextSizeAdjust: '100%'
                    }}
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
              </div>

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
                            {ingredients.map((ing) => (
                              <SelectItem key={ing.id} value={ing.id}>
                                {ing.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full lg:w-32">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          value={ingredient.quantity}
                          onChange={(e) => {
                            const newIngredients = [...newProduct.ingredients]
                            newIngredients[index].quantity = parseFloat(e.target.value)
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
                <Label>Variantes</Label>
                <div className="space-y-4 w-full">
                  {newProduct.variants?.map((variant, index) => (
                    <div key={index} className="flex flex-col lg:flex-row gap-2 items-end w-full border p-2 rounded-md bg-muted/30">
                      <div className="w-full lg:flex-1">
                        <Label>Nombre de la Variante</Label>
                        <Input
                          value={variant.name}
                          onChange={e => {
                            const newVariants = [...newProduct.variants]
                            newVariants[index].name = e.target.value
                            setNewProduct({ ...newProduct, variants: newVariants })
                          }}
                          placeholder="Ej: Fresa, Frío, Grande, etc."
                          style={{ 
                            fontSize: '16px',
                            WebkitTextSizeAdjust: '100%'
                          }}
                        />
                      </div>
                      <div className="w-full lg:w-32">
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          value={variant.price ?? ''}
                          onChange={e => {
                            const value = e.target.value === '' ? undefined : Number(e.target.value)
                            const newVariants = [...newProduct.variants]
                            newVariants[index].price = value
                            setNewProduct({ ...newProduct, variants: newVariants })
                          }}
                          placeholder="Opcional"
                          style={{ 
                            fontSize: '16px',
                            WebkitTextSizeAdjust: '100%'
                          }}
                        />
                      </div>
                      <div className="w-full lg:w-48">
                        <Label>Imagen</Label>
                        <ImageUpload
                          onImageUploaded={url => {
                            const newVariants = [...newProduct.variants]
                            newVariants[index].image = url
                            setNewProduct({ ...newProduct, variants: newVariants })
                          }}
                          currentImage={variant.image || ''}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`create-variant-active-${index}`}
                          checked={variant.isActive ?? true}
                          onCheckedChange={checked => {
                            const newVariants = [...newProduct.variants]
                            newVariants[index].isActive = checked
                            setNewProduct({ ...newProduct, variants: newVariants })
                          }}
                        />
                        <Label htmlFor={`create-variant-active-${index}`}>Activa</Label>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="w-full lg:w-10"
                        onClick={() => {
                          const newVariants = [...newProduct.variants]
                          newVariants.splice(index, 1)
                          setNewProduct({ ...newProduct, variants: newVariants })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newVariants = [...newProduct.variants]
                      newVariants.push({ id: `temp-${Date.now()}`, name: '', price: undefined, image: '', isActive: true })
                      setNewProduct({ ...newProduct, variants: newVariants })
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Variante
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
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogClose}>
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
                    <Label htmlFor="edit-name">Nombre del Producto</Label>
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
                  <div className="grid gap-2">
                    <Label htmlFor="edit-price">Precio</Label>
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
                  <div className="grid gap-2">
                    <Label htmlFor="edit-quantity">Stock Actual</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      min="0"
                      placeholder="Ingresa el stock actual"
                      value={editingProduct.quantity || 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, quantity: parseFloat(e.target.value) })}
                      style={{ 
                        fontSize: '16px',
                        WebkitTextSizeAdjust: '100%'
                      }}
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
                </div>

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
                              {ingredients.map((ing) => (
                                <SelectItem key={ing.id} value={ing.id}>
                                  {ing.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full lg:w-32">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            value={ingredient.quantity}
                            onChange={(e) => {
                              const newIngredients = [...editingProduct.ingredients || []]
                              newIngredients[index].quantity = parseFloat(e.target.value)
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
                  <Label>Variantes</Label>
                  <div className="space-y-4 w-full">
                    {editingProduct.variants?.map((variant, index) => (
                      <div key={index} className="flex flex-col lg:flex-row gap-2 items-end w-full border p-2 rounded-md bg-muted/30">
                        <div className="w-full lg:flex-1">
                          <Label>Nombre de la Variante</Label>
                          <Input
                            value={variant.name}
                            onChange={e => {
                              const newVariants = [...editingProduct.variants || []]
                              newVariants[index].name = e.target.value
                              setEditingProduct({ ...editingProduct, variants: newVariants })
                            }}
                            placeholder="Ej: Fresa, Frío, Grande, etc."
                            style={{ 
                              fontSize: '16px',
                              WebkitTextSizeAdjust: '100%'
                            }}
                          />
                        </div>
                        <div className="w-full lg:w-32">
                          <Label>Precio</Label>
                          <Input
                            type="number"
                            value={variant.price ?? ''}
                            onChange={e => {
                              const value = e.target.value === '' ? undefined : Number(e.target.value)
                              const newVariants = [...editingProduct.variants || []]
                              newVariants[index].price = value
                              setEditingProduct({ ...editingProduct, variants: newVariants })
                            }}
                            placeholder="Opcional"
                            style={{ 
                              fontSize: '16px',
                              WebkitTextSizeAdjust: '100%'
                            }}
                          />
                        </div>
                        <div className="w-full lg:w-48">
                          <Label>Imagen</Label>
                          <ImageUpload
                            onImageUploaded={url => {
                              const newVariants = [...editingProduct.variants || []]
                              newVariants[index].image = url
                              setEditingProduct({ ...editingProduct, variants: newVariants })
                            }}
                            currentImage={variant.image || ''}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`edit-variant-active-${index}`}
                            checked={variant.isActive ?? true}
                            onCheckedChange={checked => {
                              const newVariants = [...editingProduct.variants || []]
                              newVariants[index].isActive = checked
                              setEditingProduct({ ...editingProduct, variants: newVariants })
                            }}
                          />
                          <Label htmlFor={`edit-variant-active-${index}`}>Activa</Label>
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="w-full lg:w-10"
                          onClick={() => {
                            const newVariants = [...editingProduct.variants || []]
                            newVariants.splice(index, 1)
                            setEditingProduct({ ...editingProduct, variants: newVariants })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        const newVariants = [...editingProduct.variants || []]
                        newVariants.push({ id: `temp-${Date.now()}`, name: '', price: undefined, image: '', isActive: true })
                        setEditingProduct({ ...editingProduct, variants: newVariants })
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Variante
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
      </Dialog>

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
    </div>
  )
}