"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, CheckCircle2 } from "lucide-react"
import { 
  getProducts, 
  Product, 
  ProductVariant, 
  Category, 
  getTables, 
  Table, 
  createOrder, 
  getActiveOrders,
  processPayment
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

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tables, setTables] = useState<Table[]>([])
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
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

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

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [productsData, tablesData] = await Promise.all([
        getProducts(),
        getTables()
      ])
      setProducts(productsData)
      setTables(tablesData)
      
      // Extract unique categories
      const uniqueCategories = new Map<string, Category>()
      productsData.forEach(product => {
        if (product.category) {
          uniqueCategories.set(product.category.id, product.category)
        }
      })
      setCategories(Array.from(uniqueCategories.values()))
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
  }

  // Nueva función para generar la clave del carrito
  function getCartKey(product: Product, variant?: ProductVariant) {
    if (variant) {
      return `${product.id}__${variant.name}`
    }
    return product.id
  }

  // Actualizar handleAddToCart
  const handleAddToCart = (product: Product, variant?: ProductVariant) => {
    // Si hay variante, asegurar que tiene id
    if (variant && !variant.id) {
      toast({
        title: "Error",
        description: "La variante seleccionada no tiene un ID válido.",
        variant: "destructive",
      })
      return
    }
    const key = getCartKey(product, variant)
    setCart(prev => {
      const prevItem = prev[key]
      return {
        ...prev,
        [key]: {
          product,
          variant,
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

  const handleCreateOrder = async () => {
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

      const orderItems = Object.values(cart).map(item => {
        if (item.variant && !item.variant.id) {
          throw new Error("La variante seleccionada no tiene un ID válido.")
        }
        return {
          productId: item.product.id,
          quantity: item.quantity,
          ...(item.variant ? { productVariantId: item.variant.id } : {})
        }
      })

      // Si es para llevar o domicilio, usar el locationId de cualquier mesa disponible
      const locationId = orderType === "table" 
        ? selectedTableData?.locationId 
        : tables[0]?.locationId

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
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Get all active orders for selected table
  const currentOrders = activeOrders

  if (loading) {
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
          <Button onClick={fetchData}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 h-[calc(100vh-4rem)]">
      <div className="lg:col-span-3 h-full">
        <Card className="h-full flex flex-col">
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
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <ProductGrid
              products={filteredProducts}
              onAddToCart={handleAddToCart}
              cart={Object.fromEntries(Object.entries(cart).map(([key, item]) => [key, item.quantity]))}
            />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1 h-full">
        <div className="sticky top-4">
          <Cart
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
              setCart({}) // Clear cart when changing tables
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
          />
        </div>
      </div>
    </div>
  )
}