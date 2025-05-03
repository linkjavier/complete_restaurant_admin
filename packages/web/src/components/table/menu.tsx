"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Clock, Package } from "lucide-react"
import { getProducts, Product, Category, getActiveOrders } from "@/lib/api"
import { Cart } from "./cart"

interface MenuProps {
  locationId: string
  tableId: string
  customerName: string
}

export function Menu({ locationId, tableId, customerName }: MenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu')

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [productsData, ordersData] = await Promise.all([
        getProducts(
          locationId,
          selectedCategory === "all" ? undefined : selectedCategory,
          searchTerm || undefined
        ),
        getActiveOrders(tableId)
      ])
      setProducts(productsData)
      setActiveOrders(ordersData)
    } catch (err: any) {
      console.error('Error fetching data:', err)
      setError(err.message || "Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [locationId, selectedCategory, searchTerm, tableId])

  // Extraer categorías únicas de los productos
  const categoriesMap = new Map<string, Category>();
  
  // Mapear categorías de productos para generar lista única
  products.forEach(product => {
    if (product.category && product.categoryId) {
      categoriesMap.set(product.categoryId, product.category);
    }
  });
  
  // Lista final de categorías para el menú
  const categories = ["all", ...Array.from(categoriesMap.keys())];

  const handleAddToCart = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }))
  }

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId] -= 1
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const cartItems = Object.entries(cart).map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return null
    return {
      id: productId,
      product,
      quantity,
      price: product.price,
    }
  }).filter(Boolean)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Cargando menú y órdenes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-red-500">
            <p className="font-medium">Error al cargar los datos</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => {
            setError(null)
            setLoading(true)
            fetchData()
          }}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <div className="space-y-4">
          {/* Welcome Message */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">¡Hola {customerName}!</h2>
                <p className="text-muted-foreground">
                  Aquí podrás ver nuestro menú, ordenar productos, ver tus pedidos y pagar la cuenta.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'menu' ? 'default' : 'outline'}
              onClick={() => setActiveTab('menu')}
              className="flex items-center gap-2"
            >
              <Package className="h-4 w-4" />
              Menú
            </Button>
            <Button
              variant={activeTab === 'orders' ? 'default' : 'outline'}
              onClick={() => setActiveTab('orders')}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Órdenes Activas
            </Button>
          </div>

          {activeTab === 'orders' ? (
            <Card>
              <CardHeader>
                <CardTitle>Órdenes Activas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground">No hay órdenes activas</p>
                  ) : (
                    activeOrders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">Orden #{order.id.substring(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                          </span>
                        </div>
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <p className="text-sm">{item.product.name}</p>
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                  x{item.quantity}
                                </span>
                              </div>
                              <span className={`text-sm ${
                                item.status === "PENDING" ? "text-yellow-500" :
                                item.status === "IN_PROGRESS" ? "text-blue-500" :
                                "text-green-500"
                              }`}>
                                {item.status === "PENDING" ? "Pendiente" :
                                 item.status === "IN_PROGRESS" ? "En preparación" :
                                 item.status === "CANCELLED" ? "Cancelada" :
                                 "Listo"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {categories.map((categoryId) => (
                    <Button
                      key={categoryId}
                      variant={selectedCategory === categoryId ? "default" : "outline"}
                      onClick={() => setSelectedCategory(categoryId)}
                      className="whitespace-nowrap"
                    >
                      {categoryId === "all" 
                        ? "Todos" 
                        : (categoriesMap.get(categoryId)?.name || categoryId)
                      }
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardHeader>
                      <CardTitle>{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {product.image && (
                          <div className="relative w-full h-40">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {product.description}
                          </p>
                          <p className="font-bold">${product.price.toFixed(2)}</p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleRemoveFromCart(product.id)}
                              disabled={!cart[product.id]}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span>{cart[product.id] || 0}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleAddToCart(product.id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="md:col-span-1">
        <Cart
          customerName={customerName}
          tableId={tableId}
          locationId={locationId}
          items={cartItems}
          onItemsChange={(newItems) => {
            const newCart: Record<string, number> = {}
            newItems.forEach(item => {
              newCart[item.product.id] = item.quantity
            })
            setCart(newCart)
          }}
        />
      </div>
    </div>
  )
} 