"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Minus, Clock, Package, ShoppingCart, RefreshCw } from "lucide-react"
import { getProducts, Product, Category, getActiveOrders, getCategories } from "@/lib/api"
import { Cart } from "./cart"
import Image from "next/image"
import { toast } from "sonner"
import { io } from "socket.io-client"

interface MenuProps {
  locationId: string
  tableId: string
  customerName: string
}

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

export function Menu({ locationId, tableId, customerName }: MenuProps) {
  const vh = useMobileViewportHeight();
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu')
  const [isCartVisible, setIsCartVisible] = useState(false)
  const cartRef = useRef<HTMLDivElement>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleScroll = () => {
    if (!cartRef.current) return;

    const cartRect = cartRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    // Check if we're at the cart section or at the bottom of the page
    const isAtCart = cartRect.top <= windowHeight * 0.8;
    const isAtBottom = windowHeight + scrollTop >= documentHeight - 100;

    setIsCartVisible(isAtCart || isAtBottom);
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    // Check initial position
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true)
      const [productsData, ordersData, categoriesData] = await Promise.all([
        getProducts(locationId),
        getActiveOrders(tableId),
        getCategories()
      ])
      setProducts([...productsData].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })))
      setCategories(categoriesData)
      setActiveOrders(ordersData)
      setError(null)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Error al cargar los datos. Por favor, intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [locationId, tableId])

  // Add auto-refresh functionality for orders only
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const ordersData = await getActiveOrders(tableId)
        setActiveOrders(ordersData)
      } catch (err) {
        console.error('Error refreshing orders:', err)
      }
    }

    // Initial fetch
    fetchOrders()

    // Set up auto-refresh every minute
    const refreshInterval = setInterval(fetchOrders, 60000)

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval)
  }, [tableId])

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      const ordersData = await getActiveOrders(tableId)
      setActiveOrders(ordersData)
    } catch (err) {
      console.error('Error refreshing orders:', err)
      toast.error('Error al actualizar las órdenes')
    } finally {
      setIsRefreshing(false)
    }
  }

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

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const scrollToCart = () => {
    const cartElement = document.getElementById('cart-section')
    if (cartElement) {
      cartElement.scrollIntoView({ behavior: 'smooth' })
      // Force check visibility after scroll
      setTimeout(handleScroll, 100)
    }
  }

  // Add socket connection for real-time updates
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
      transports: ['websocket'],
      path: '/socket.io',
    });

    socket.on('connect', () => {
      socket.emit('join-kitchen', locationId);
    });

    socket.on('new_order_created', (newOrder) => {
      setActiveOrders(prev => {
        // Check if order already exists
        const exists = prev.some(order => order.id === newOrder.id);
        if (exists) return prev;
        return [newOrder, ...prev];
      });
    });

    socket.on('order_updated', (updatedOrder) => {
      setActiveOrders(prev => 
        prev.map(order => order.id === updatedOrder.id ? updatedOrder : order)
      );
    });

    socket.on('order_item_updated', ({ order }) => {
      setActiveOrders(prev => 
        prev.map(o => o.id === order.id ? order : o)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [locationId]);

  // Filtrar productos basado en categoría y término de búsqueda
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory;
    const matchesSearch = searchTerm === "" || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(var(--vh,1vh)*100)] w-full overflow-x-hidden">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Cargando menú y órdenes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(var(--vh,1vh)*100)] w-full overflow-x-hidden">
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
    <div 
      className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[100vh] min-h-[calc(var(--vh,1vh)*100)] w-full overflow-x-hidden"
      style={{ minHeight: vh }}
    >
      {/* Floating Cart Button - Only visible on mobile */}
      {totalItems > 0 && !isCartVisible && (
        <div className="fixed bottom-6 right-6 md:hidden z-50">
          <Button
            size="lg"
            className="rounded-full w-32 h-14 shadow-lg relative bg-red-500 hover:bg-red-600 flex items-center justify-center"
            onClick={scrollToCart}
          >
            <span className="text-white font-medium">Tu Pedido</span>
            <span className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold border-2 border-red-500 z-20">
              {totalItems}
            </span>
          </Button>
        </div>
      )}

      <div className="md:col-span-2">
        <div className="space-y-4 pb-20 md:pb-4">
          {/* Welcome Message with Logo */}
          <Card>
            <CardContent className="pt-2">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">¡Hola {customerName}!</h2>
                  <p className="text-muted-foreground">
                    Aquí podrás ver nuestro menú, ordenar productos, ver tus pedidos y pagar la cuenta.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs and Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
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
                Tus órdenes
              </Button>
            </div>
          </div>

          {activeTab === 'orders' ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Órdenes Activas</h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <Card>
                <CardContent>
                  <div className="space-y-4">
                    {activeOrders.length === 0 ? (
                      <p className="text-center text-muted-foreground">No tienes órdenes</p>
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
            </>
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
                  <Button
                    key="all"
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("all")}
                    className="whitespace-nowrap"
                  >
                    Todos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      onClick={() => setSelectedCategory(category.id)}
                      className="whitespace-nowrap"
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-8 pt-4">
                {groupedProducts.map(({ categoryId, categoryName, products: groupProducts }) => (
                  <div key={categoryId}>
                    <CategoryTitle title={categoryName} />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {groupProducts.map((product) => (
                        <Card 
                          key={product.id}
                          className={`${
                            cart[product.id] ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950' : ''
                          }`}
                        >
                          <CardHeader className="pb-1 pt-2">
                            <CardTitle className="text-base">{product.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {product.image && (
                                <div className="relative w-full h-40">
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <p className="text-sm text-muted-foreground">
                                  {product.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <p className="font-bold">${product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleRemoveFromCart(product.id)}
                                      disabled={!cart[product.id]}
                                      className="h-8 w-8"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-6 text-center">{cart[product.id] || 0}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleAddToCart(product.id)}
                                      className="h-8 w-8"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="md:col-span-1" id="cart-section" ref={cartRef}>
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