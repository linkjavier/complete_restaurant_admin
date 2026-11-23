"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, CheckCircle2, ShoppingCart } from "lucide-react"
import {
  getProducts,
  Product,
  ProductVariant,
  Category,
  getTables,
  Table,
  createOrder,
  getActiveOrders,
  processPayment,
  getCategories,
  getLocations,
  Location
} from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Cart } from "@/components/admin/pos/cart"
import { ProductGrid } from "@/components/admin/pos/product-grid"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/hooks/use-auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ALL_LOCATIONS = "all"

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState(ALL_LOCATIONS)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [cart, setCart] = useState<Record<string, { product: Product, variant?: ProductVariant, quantity: number }>>({})
  const [orderType, setOrderType] = useState<"table" | "takeout" | "delivery">("takeout")
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [customerName, setCustomerName] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [phone, setPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "TRANSFER">("CASH")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { user, isLoading: isAuthLoading } = useAuth()
  const isSuperAdmin = user?.role === "SUPER_ADMIN"

  // Fetch active orders when table is selected
  useEffect(() => {
    if (selectedTable) {
      refreshActiveOrders()
    } else {
      setActiveOrders([])
    }
  }, [selectedTable])

  const refreshActiveOrders = async () => {
    try {
      const orders = await getActiveOrders(selectedTable)
      setActiveOrders(orders)
    } catch (err) {
      console.error('Error fetching active orders:', err)
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes activas",
        variant: "destructive",
      })
    }
  }

  const fetchData = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      if (!isSuperAdmin && !user.locationId) {
        throw new Error("Tu usuario no tiene una sucursal asignada.")
      }

      const [productsData, tablesData, categoriesData, locationsData] = await Promise.all([
        getProducts(isSuperAdmin ? undefined : user.locationId ?? undefined),
        getTables(),
        getCategories(),
        getLocations(),
      ])
      setProducts(
        productsData
          .filter((product) => !product.isIntermediate)
          .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
      )
      setTables(tablesData)
      setCategories(categoriesData)
      setLocations(locationsData)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Error al cargar los datos. Por favor, intente de nuevo.')
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, toast, user])

  useEffect(() => {
    if (!isAuthLoading && user) {
      void fetchData()
    }
  }, [fetchData, isAuthLoading, user])

  // Nueva función para generar la clave del carrito
  function getCartKey(product: Product, variants?: ProductVariant[] | ProductVariant) {
    if (Array.isArray(variants) && variants.length > 0) {
      // Clave única por producto y variantes seleccionadas
      return `${product.id}__${variants.map(v => v.id).join('_')}`
    } else if (variants && !Array.isArray(variants)) {
      return `${product.id}__${variants.id}`
    }
    return product.id
  }

  // Actualizar handleAddToCart para soportar múltiples variantes
  const handleAddToCart = (product: Product, variantsOrVariant?: ProductVariant[] | ProductVariant) => {
    const cartLocationIds = new Set(
      Object.values(cart)
        .map((item) => item.product.locationId)
        .filter(Boolean),
    )
    if (
      product.locationId &&
      [...cartLocationIds].some((locationId) => locationId !== product.locationId)
    ) {
      toast({
        title: "Productos de distintas sucursales",
        description: "El carrito solo puede incluir productos de una sucursal. Filtra por sucursal para continuar.",
        variant: "destructive",
      })
      return
    }

    // Validar ids
    if (Array.isArray(variantsOrVariant)) {
      if (variantsOrVariant.some(v => !v.id)) {
        toast({
          title: "Error",
          description: "Alguna variante seleccionada no tiene un ID válido.",
          variant: "destructive",
        })
        return
      }
    } else if (variantsOrVariant && !variantsOrVariant.id) {
      toast({
        title: "Error",
        description: "La variante seleccionada no tiene un ID válido.",
        variant: "destructive",
      })
      return
    }
    const key = getCartKey(product, variantsOrVariant)
    setCart(prev => {
      const prevItem = prev[key]
      return {
        ...prev,
        [key]: {
          product,
          ...(Array.isArray(variantsOrVariant)
            ? { variants: variantsOrVariant }
            : variantsOrVariant
              ? { variant: variantsOrVariant }
              : {}),
          quantity: prevItem ? prevItem.quantity + 1 : 1
        }
      }
    })
  }

  // Actualizar handleRemoveFromCart
  const handleRemoveFromCart = (key: string) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[key].quantity > 1) {
        newCart[key].quantity -= 1
      } else {
        delete newCart[key]
      }
      return newCart
    })
  }

  const handleCreateOrder = async (assignedLocationId?: string) => {
    try {
      if (orderType === "table" && !selectedTable) {
        toast({
          title: "Error",
          description: "Por favor selecciona una mesa",
          variant: "destructive",
        })
        return
      }

      if ((orderType === "takeout" || orderType === "delivery") && !customerName.trim()) {
        toast({
          title: "Error",
          description: "Por favor ingresa el nombre del cliente",
          variant: "destructive",
        })
        return
      }

      if (orderType === "delivery") {
        if (!deliveryAddress.trim()) {
          toast({
            title: "Error",
            description: "Por favor ingresa la dirección de entrega",
            variant: "destructive",
          })
          return
        }
        if (!phone.trim()) {
          toast({
            title: "Error",
            description: "Por favor ingresa el teléfono",
            variant: "destructive",
          })
          return
        }
      }

      setSubmitting(true)
      const selectedTableData = tables.find(t => t.id === selectedTable)
      if (!selectedTableData && orderType === "table") {
        toast({
          title: "Error",
          description: "No se encontró la información de la mesa",
          variant: "destructive",
        })
        return
      }

      const cartLocationIds = new Set(
        Object.values(cart)
          .map((item) => item.product.locationId)
          .filter(Boolean),
      )
      if (cartLocationIds.size > 1) {
        toast({
          title: "Productos de distintas sucursales",
          description: "El pedido debe contener productos de una sola sucursal.",
          variant: "destructive",
        })
        return
      }

      const [productLocationId] = [...cartLocationIds]
      const orderLocationId =
        (orderType === "delivery" && assignedLocationId) ||
        (orderType === "table" ? selectedTableData?.locationId : undefined) ||
        (isSuperAdmin && selectedLocationId !== ALL_LOCATIONS ? selectedLocationId : undefined) ||
        productLocationId ||
        user?.locationId ||
        tables[0]?.locationId

      if (productLocationId && orderLocationId !== productLocationId) {
        toast({
          title: "La sucursal no coincide",
          description: "Selecciona la sucursal de los productos del carrito antes de crear el pedido.",
          variant: "destructive",
        })
        return
      }

      const orderItems = Object.values(cart).map(item => {
        let variantsArr: { productVariantId: string, groupName?: string }[] = [];
        // Soporte para múltiples variantes por item
        if (Array.isArray((item as any).variants) && (item as any).variants.length > 0) {
          variantsArr = (item as any).variants.map((v: any) => ({
            productVariantId: v.id,
            groupName: v.groupName || undefined
          }))
        } else if ((item as any).variant) {
          variantsArr = [{ productVariantId: (item as any).variant.id }]
        }
        return {
          productId: item.product.id,
          quantity: item.quantity,
          variants: variantsArr
        }
      })

      const locationId = orderLocationId
      if (!locationId) {
        toast({
          title: "Error",
          description: "No se pudo determinar la ubicación. Por favor, asegúrate de tener una ubicación asignada o al menos una mesa creada.",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      const orderData = {
        tableId: orderType === "table" ? selectedTable : undefined,
        type: orderType === "table" ? "TABLE" as const :
          orderType === "delivery" ? "DELIVERY" as const : "TAKEOUT" as const,
        locationId,
        customerName: (orderType === "takeout" || orderType === "delivery") ? customerName : undefined,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        neighborhood: orderType === "delivery" ? neighborhood : undefined,
        phone: orderType === "delivery" ? phone : undefined,
        paymentMethod: orderType === "delivery" ? paymentMethod : undefined,
        items: orderItems,
        status: orderType === "takeout" ? "IN_PROGRESS" as const : "PENDING" as const,
        isPaid: orderType === "takeout" ? true : false,
        source: 'POS' as const,
      }

      const createdOrder = await createOrder(orderData)

      // Si es para llevar, crear el pago automáticamente
      if (orderType === "takeout") {
        const total = orderItems.reduce((sum, item) => {
          const product = products.find(p => p.id === item.productId)
          return sum + (product?.price || 0) * item.quantity
        }, 0)

        await processPayment(createdOrder.id, total, "CASH")
      }

      // Clear cart and form fields
      setCart({})
      setCustomerName("")
      setDeliveryAddress("")
      setNeighborhood("")
      setPhone("")
      setPaymentMethod("CASH")

      // Refresh active orders
      if (selectedTable) {
        await refreshActiveOrders()
      }

      toast({
        title: "Éxito",
        description: (
          <span className="flex items-center justify-between text-green-600">
            <span>Pedido creado correctamente</span>
            <CheckCircle2 className="ml-4" style={{ width: '60px', height: '60px' }} />
          </span>
        ),
        variant: "default"
      })
    } catch (err) {
      console.error('Error creating order:', err)
      toast({
        title: "Error",
        description: "Error al crear el pedido",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentProcessed = async () => {
    if (selectedTable) {
      await refreshActiveOrders()
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesLocation =
      !isSuperAdmin ||
      selectedLocationId === ALL_LOCATIONS ||
      product.locationId === selectedLocationId
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesLocation && matchesCategory && matchesSearch
  })

  const groupedProducts =
    selectedCategory === "all"
      ? categories
        .map(category => ({
          categoryName: category.name,
          categoryId: category.id,
          products: filteredProducts.filter(p => p.categoryId === category.id),
        }))
        .filter(group => group.products.length > 0)
      : filteredProducts.length > 0
        ? [
          {
            categoryName: categories.find((c) => c.id === selectedCategory)?.name || "",
            categoryId: selectedCategory,
            products: filteredProducts,
          },
        ]
        : []

  // Get all active orders for selected table
  const currentOrders = activeOrders
  const cartItemCount = Object.values(cart).reduce((total, item) => total + item.quantity, 0)
  const showMobileCart = cartItemCount > 0 || currentOrders.length > 0

  const renderCart = (className?: string) => (
    <Cart
      className={className}
      items={Object.values(cart)}
      onUpdateQuantity={(key, quantity) => {
        setCart(prev => {
          if (quantity <= 0) {
            const newCart = { ...prev }
            delete newCart[key]
            return newCart
          } else {
            return {
              ...prev,
              [key]: {
                ...prev[key],
                quantity
              }
            }
          }
        })
      }}
      onRemoveItem={handleRemoveFromCart}
      orderType={orderType}
      selectedTable={selectedTable}
      tables={tables}
      onOrderTypeChange={setOrderType}
      onTableSelect={(tableId) => {
        setSelectedTable(tableId)
        setCart({})
      }}
      onSubmit={handleCreateOrder}
      currentOrders={currentOrders}
      loading={submitting}
      customerName={customerName}
      onCustomerNameChange={setCustomerName}
      deliveryAddress={deliveryAddress}
      onDeliveryAddressChange={setDeliveryAddress}
      neighborhood={neighborhood}
      onNeighborhoodChange={setNeighborhood}
      phone={phone}
      onPhoneChange={setPhone}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
      locations={locations}
    />
  )

  if (loading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-muted-foreground">Cargando POS...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => void fetchData()}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 pb-20 lg:pb-4 min-h-[calc(100dvh-4rem)] lg:h-[calc(100vh-4rem)]">
      <div className="lg:col-span-3 lg:h-full">
        <Card className="lg:h-full lg:flex lg:flex-col">
          <CardHeader className="flex-none">
            <div className="flex flex-col gap-4">
              <CardTitle>Punto de Venta</CardTitle>
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
                    onValueChange={(locationId) => {
                      setSelectedLocationId(locationId)
                      setCart({})
                      setSelectedTable("")
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_LOCATIONS}>Todas las sucursales</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full md:w-[180px]">
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
            </div>
          </CardHeader>
          <CardContent className="lg:flex-1 lg:overflow-y-auto">
            <ProductGrid
              groupedProducts={groupedProducts}
              onAddToCart={handleAddToCart}
              cart={Object.fromEntries(Object.entries(cart).map(([key, item]) => [key, item.quantity]))}
              showLocationName={isSuperAdmin}
            />
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:col-span-1 lg:block lg:h-full">
        <div className="sticky top-4">
          {renderCart()}
        </div>
      </div>
      {showMobileCart && (
        <Button
          type="button"
          className="fixed inset-x-4 bottom-4 z-40 h-12 justify-between shadow-lg lg:hidden"
          onClick={() => setIsMobileCartOpen(true)}
          disabled={submitting}
          aria-label={`Abrir carrito con ${cartItemCount} productos`}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {cartItemCount > 0 ? `Ver carrito · ${cartItemCount}` : "Ver cuenta"}
          </span>
          <span>{currentOrders.length > 0 ? `${currentOrders.length} órdenes` : "Continuar"}</span>
        </Button>
      )}
      <Dialog open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg overflow-y-auto p-2 max-h-[90dvh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Carrito y cuenta</DialogTitle>
            <DialogDescription>
              Revisa los productos, ajusta las cantidades y completa la venta.
            </DialogDescription>
          </DialogHeader>
          {renderCart("h-[82dvh] min-h-0 flex flex-col")}
        </DialogContent>
      </Dialog>
    </div>
  )
}