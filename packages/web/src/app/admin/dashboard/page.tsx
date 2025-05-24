"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Overview } from "@/components/admin/overview"
import { Button } from "@/components/ui/button"
import { Building2, Users, Utensils, DollarSign, Package, ShoppingCart, CheckCircle2, XCircle, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

interface Order {
  id: string
  status: "PENDING" | "IN_PROGRESS" | "READY" | "CANCELLED" | "PAID"
  items: Array<{
    quantity: number
    product: {
      price: number
      name: string
    }
  }>
  isPaid: boolean
  total: number
}

interface OrderStats {
  activeOrders: {
    count: number
    total: number
  }
  paidOrders: {
    count: number
    total: number
  }
  cancelledOrders: {
    count: number
    total: number
  }
}

interface TopProduct {
  name: string
  quantity: number
  total: number
}

export default function AdminDashboard() {
  const [orderStats, setOrderStats] = useState<OrderStats>({
    activeOrders: { count: 0, total: 0 },
    paidOrders: { count: 0, total: 0 },
    cancelledOrders: { count: 0, total: 0 }
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  const calculateOrderTotal = (order: Order) => {
    if (!order?.items?.length) return 0
    return order.items.reduce((total, item) => {
      return total + (item.quantity * (item.product?.price || 0))
    }, 0)
  }

  const calculateTopProducts = (orders: Order[]) => {
    const productMap = new Map<string, { quantity: number; total: number }>()

    orders.forEach(order => {
      order.items.forEach(item => {
        const productName = item.product.name
        const current = productMap.get(productName) || { quantity: 0, total: 0 }
        
        productMap.set(productName, {
          quantity: current.quantity + item.quantity,
          total: current.total + (item.quantity * item.product.price)
        })
      })
    })

    return Array.from(productMap.entries())
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        total: stats.total
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }

  const fetchOrderStats = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders?kitchen=false`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Error al cargar las órdenes')
      }

      const orders: Order[] = await response.json()
      
      const stats: OrderStats = {
        activeOrders: {
          count: orders.filter(order => order.status === "PENDING" || order.status === "IN_PROGRESS").length,
          total: orders
            .filter(order => order.status === "PENDING" || order.status === "IN_PROGRESS")
            .reduce((total, order) => total + calculateOrderTotal(order), 0)
        },
        paidOrders: {
          count: orders.filter(order => order.isPaid).length,
          total: orders
            .filter(order => order.isPaid)
            .reduce((total, order) => total + calculateOrderTotal(order), 0)
        },
        cancelledOrders: {
          count: orders.filter(order => order.status === "CANCELLED").length,
          total: orders
            .filter(order => order.status === "CANCELLED")
            .reduce((total, order) => total + calculateOrderTotal(order), 0)
        }
      }

      setOrderStats(stats)
      setTopProducts(calculateTopProducts(orders))
    } catch (error) {
      console.error('Error fetching order stats:', error)
    }
  }

  useEffect(() => {
    fetchOrderStats()
    const interval = setInterval(fetchOrderStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Button>Nueva Sede</Button>
        </div>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Ventas Totales
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$45,231.89</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% desde el mes pasado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pedidos Activos
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.activeOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  Total: ${orderStats.activeOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pedidos Pagados
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.paidOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  Total: ${orderStats.paidOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pedidos Cancelados
                </CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.cancelledOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  Total: ${orderStats.cancelledOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Ventas por Sede</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <Overview />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Top 5 Productos Más Vendidos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.quantity} unidades vendidas
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        ${product.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
  