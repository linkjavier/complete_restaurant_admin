"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { 
  getProducts, 
  Product, 
  Category, 
  getTables, 
  Table, 
  createOrder, 
  getActiveOrders 
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
  const [cart, setCart] = useState<Record<string, number>>({})
  const [orderType, setOrderType] = useState<"table" | "takeout">("table")
  const [selectedTable, setSelectedTable] = useState<string>("")
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

  const handleAddToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }))
  }

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId] -= 1
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const handleSubmitOrder = async () => {
    try {
      if (orderType === "table" && !selectedTable) {
        toast({
          title: "Error",
          description: "Por favor selecciona una mesa",
          variant: "destructive",
        })
        return
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

      const orderItems = Object.entries(cart).map(([productId, quantity]) => ({
        productId,
        quantity
      }))

      const orderData = {
        tableId: orderType === "table" ? selectedTable : undefined,
        locationId: orderType === "table" ? selectedTableData?.locationId : undefined,
        items: orderItems
      }

      await createOrder(orderData)
      
      // Clear cart
      setCart({})

      // Refresh active orders
      if (selectedTable) {
        await refreshActiveOrders()
      }

      toast({
        title: "Éxito",
        description: "Pedido creado correctamente",
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
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
          <CardContent>
            <ProductGrid
              products={filteredProducts}
              onAddToCart={handleAddToCart}
              cart={cart}
            />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Cart
          items={Object.entries(cart).map(([productId, quantity]) => ({
            product: products.find(p => p.id === productId)!,
            quantity
          }))}
          onUpdateQuantity={(productId, quantity) => {
            if (quantity <= 0) {
              const newCart = { ...cart }
              delete newCart[productId]
              setCart(newCart)
            } else {
              setCart(prev => ({ ...prev, [productId]: quantity }))
            }
          }}
          onRemoveItem={(productId) => {
            const newCart = { ...cart }
            delete newCart[productId]
            setCart(newCart)
          }}
          orderType={orderType}
          selectedTable={selectedTable}
          tables={tables}
          onOrderTypeChange={setOrderType}
          onTableSelect={(tableId) => {
            setSelectedTable(tableId)
            setCart({}) // Clear cart when changing tables
          }}
          onSubmit={handleSubmitOrder}
          currentOrders={currentOrders}
          loading={submitting}
        />
      </div>
    </div>
  )
}