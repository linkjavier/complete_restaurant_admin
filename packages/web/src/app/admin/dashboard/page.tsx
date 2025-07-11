"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Overview } from "@/components/admin/overview"
import { Button } from "@/components/ui/button"
import { Building2, Users, Utensils, DollarSign, Package, ShoppingCart, CheckCircle2, XCircle, TrendingUp, Calendar, Clock, AlertTriangle, AlertCircle, Bell, QrCode, ShoppingBag, MessageCircle, ArrowRight, CreditCard } from "lucide-react"
import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Rectangle, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { API_URL } from '@/lib/api'
import { useLanguage } from "@/hooks/use-language"

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

interface ParetoData {
  name: string
  revenue: number
  cumulativePercentage: number
}

interface HeatMapData {
  hour: number
  category: string
  value: number
}

interface BoxPlotData {
  name: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

interface CongestionData {
  hour: number
  level: "low" | "medium" | "high"
  orders: number
}

interface InventoryItem {
  id: string
  name: string
  category: "A" | "B" | "C"
  currentStock: number
  consumption: number
  prediction: number
  unit: string
}

interface InventoryStats {
  categoryA: number
  categoryB: number
  categoryC: number
}

interface Prediction {
  id: string
  product: string
  confidence: number
  trend: number[]
  message: string
  type: "high_demand" | "low_stock" | "trend"
}

interface Alert {
  id: string
  type: "warning" | "error" | "info"
  message: string
  daysLeft?: number
  ingredient?: string
}

interface ConversionFunnel {
  stage: string
  value: number
  percentage: number
}

interface MenuSection {
  name: string
  avgTime: number
  views: number
  orders: number
}

interface CartAbandonment {
  date: string
  rate: number
  trend: number[]
}

export default function AdminDashboard() {
  const { tNested } = useLanguage()
  const dashboardTranslations = tNested('dashboard')
  
  const [orderStats, setOrderStats] = useState<OrderStats>({
    activeOrders: { count: 0, total: 0 },
    paidOrders: { count: 0, total: 0 },
    cancelledOrders: { count: 0, total: 0 }
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [timeRange, setTimeRange] = useState("week")
  const [paretoData, setParetoData] = useState<ParetoData[]>([])
  const [heatMapData, setHeatMapData] = useState<HeatMapData[]>([])
  const [boxPlotData, setBoxPlotData] = useState<BoxPlotData[]>([])
  const [congestionData, setCongestionData] = useState<CongestionData[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [inventoryStats, setInventoryStats] = useState<InventoryStats>({
    categoryA: 0,
    categoryB: 0,
    categoryC: 0
  })
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[]>([])
  const [cartAbandonment, setCartAbandonment] = useState<CartAbandonment[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [totalSales, setTotalSales] = useState<number>(0)
  const [unpaidOrders, setUnpaidOrders] = useState<{ count: number; total: number }>({ count: 0, total: 0 })

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
      const response = await fetch(`${API_URL}/orders?kitchen=false`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Error al cargar las órdenes')
      }

      const orders: Order[] = await response.json()
      setOrders(orders)
      
      // Calculate total sales (excluding cancelled orders)
      const totalSales = orders
        .filter(order => order.status !== "CANCELLED")
        .reduce((total, order) => total + calculateOrderTotal(order), 0)
      
      // Calculate unpaid orders (excluding cancelled orders)
      const unpaidOrdersData = {
        count: orders.filter(order => !order.isPaid && order.status !== "CANCELLED").length,
        total: orders
          .filter(order => !order.isPaid && order.status !== "CANCELLED")
          .reduce((total, order) => total + calculateOrderTotal(order), 0)
      }
      
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
      
      // Store total sales for use in the UI
      setTotalSales(totalSales)
      setUnpaidOrders(unpaidOrdersData)
    } catch (error) {
      console.error('Error fetching order stats:', error)
    }
  }

  // Mock data for Pareto chart
  const generateMockParetoData = () => {
    const products = [
      { name: "Hamburguesa Clásica", revenue: 2500000 },
      { name: "Pizza Margherita", revenue: 1800000 },
      { name: "Ensalada César", revenue: 1500000 },
      { name: "Pasta Carbonara", revenue: 1200000 },
      { name: "Sushi Roll", revenue: 1000000 },
      { name: "Pollo a la Parrilla", revenue: 800000 },
      { name: "Sándwich Club", revenue: 700000 },
      { name: "Sopa del Día", revenue: 600000 },
      { name: "Postre Tiramisú", revenue: 500000 },
      { name: "Bebida Refresco", revenue: 400000 },
    ]

    const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0)
    let cumulativeSum = 0

    return products.map(product => {
      cumulativeSum += product.revenue
      return {
        name: product.name,
        revenue: product.revenue,
        cumulativePercentage: (cumulativeSum / totalRevenue) * 100
      }
    })
  }

  // Mock data for heatmap
  const generateMockHeatMapData = () => {
    const categories = ["Entradas", "Platos Principales", "Postres", "Bebidas"]
    const data: HeatMapData[] = []
    
    for (let hour = 8; hour <= 22; hour++) {
      categories.forEach(category => {
        data.push({
          hour,
          category,
          value: Math.floor(Math.random() * 100)
        })
      })
    }
    
    return data
  }

  // Mock data for boxplot
  const generateMockBoxPlotData = () => {
    return [
      { name: "Hamburguesa", min: 5, q1: 8, median: 10, q3: 12, max: 15 },
      { name: "Pizza", min: 8, q1: 12, median: 15, q3: 18, max: 25 },
      { name: "Pasta", min: 6, q1: 10, median: 12, q3: 15, max: 20 },
      { name: "Ensalada", min: 3, q1: 5, median: 7, q3: 9, max: 12 },
      { name: "Postre", min: 2, q1: 4, median: 5, q3: 7, max: 10 }
    ]
  }

  // Mock data for congestion
  const generateMockCongestionData = () => {
    const data: CongestionData[] = []
    for (let hour = 8; hour <= 22; hour++) {
      const orders = Math.floor(Math.random() * 30)
      let level: "low" | "medium" | "high" = "low"
      if (orders > 20) level = "high"
      else if (orders > 10) level = "medium"
      
      data.push({ hour, level, orders })
    }
    return data
  }

  // Mock data for inventory
  const generateMockInventoryData = () => {
    const items: InventoryItem[] = [
      { id: "1", name: "Carne de Res", category: "A", currentStock: 150, consumption: 45, prediction: 50, unit: "kg" },
      { id: "2", name: "Pollo", category: "A", currentStock: 200, consumption: 60, prediction: 65, unit: "kg" },
      { id: "3", name: "Queso", category: "A", currentStock: 80, consumption: 25, prediction: 30, unit: "kg" },
      { id: "4", name: "Tomates", category: "B", currentStock: 100, consumption: 30, prediction: 35, unit: "kg" },
      { id: "5", name: "Cebollas", category: "B", currentStock: 120, consumption: 35, prediction: 40, unit: "kg" },
      { id: "6", name: "Papas", category: "B", currentStock: 200, consumption: 50, prediction: 55, unit: "kg" },
      { id: "7", name: "Especias", category: "C", currentStock: 50, consumption: 10, prediction: 12, unit: "kg" },
      { id: "8", name: "Aceite", category: "C", currentStock: 40, consumption: 8, prediction: 10, unit: "L" },
    ]

    const stats = {
      categoryA: items.filter(item => item.category === "A").length,
      categoryB: items.filter(item => item.category === "B").length,
      categoryC: items.filter(item => item.category === "C").length
    }

    setInventoryItems(items)
    setInventoryStats(stats)
  }

  // Mock data for predictions
  const generateMockPredictions = () => {
    return [
      {
        id: "1",
        product: "Croissants",
        confidence: 85,
        trend: [30, 35, 40, 38, 45, 50, 55],
        message: "Se espera alto consumo de croissants mañana",
        type: "high_demand" as const
      },
      {
        id: "2",
        product: "Café Americano",
        confidence: 75,
        trend: [45, 42, 40, 38, 35, 32, 30],
        message: "Tendencia a la baja en consumo de café americano",
        type: "trend" as const
      },
      {
        id: "3",
        product: "Ensalada César",
        confidence: 90,
        trend: [25, 28, 30, 32, 35, 38, 40],
        message: "Incremento esperado en pedidos de ensalada",
        type: "high_demand" as const
      }
    ]
  }

  // Mock data for alerts
  const generateMockAlerts = () => {
    return [
      {
        id: "1",
        type: "error" as const,
        message: "Queso parmesano se agotará en 2 días",
        daysLeft: 2,
        ingredient: "Queso parmesano"
      },
      {
        id: "2",
        type: "warning" as const,
        message: "Stock bajo de tomates cherry",
        daysLeft: 4,
        ingredient: "Tomates cherry"
      },
      {
        id: "3",
        type: "info" as const,
        message: "Nuevo proveedor disponible para aceite de oliva",
        ingredient: "Aceite de oliva"
      }
    ]
  }

  // Mock data for conversion funnel
  const generateMockConversionFunnel = () => {
    return [
      { stage: "Vistas", value: 1000, percentage: 100 },
      { stage: "Clicks", value: 750, percentage: 75 },
      { stage: "Pedidos", value: 500, percentage: 50 },
      { stage: "Pagos", value: 400, percentage: 40 }
    ]
  }

  // Mock data for menu sections
  const generateMockMenuSections = () => {
    return [
      { name: "Entradas", avgTime: 45, views: 1200, orders: 800 },
      { name: "Platos Principales", avgTime: 120, views: 2000, orders: 1500 },
      { name: "Postres", avgTime: 30, views: 800, orders: 600 },
      { name: "Bebidas", avgTime: 20, views: 1500, orders: 1200 }
    ]
  }

  // Mock data for cart abandonment
  const generateMockCartAbandonment = () => {
    return [
      { date: "Lun", rate: 25, trend: [30, 28, 25, 27, 25, 24, 25] },
      { date: "Mar", rate: 28, trend: [32, 30, 28, 29, 28, 27, 28] },
      { date: "Mié", rate: 22, trend: [25, 24, 22, 23, 22, 21, 22] },
      { date: "Jue", rate: 30, trend: [35, 33, 30, 32, 30, 29, 30] },
      { date: "Vie", rate: 35, trend: [40, 38, 35, 37, 35, 34, 35] },
      { date: "Sáb", rate: 40, trend: [45, 43, 40, 42, 40, 39, 40] },
      { date: "Dom", rate: 38, trend: [43, 41, 38, 40, 38, 37, 38] }
    ]
  }

  useEffect(() => {
    fetchOrderStats()
    const interval = setInterval(fetchOrderStats, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setParetoData(generateMockParetoData())
    setHeatMapData(generateMockHeatMapData())
    setBoxPlotData(generateMockBoxPlotData())
    setCongestionData(generateMockCongestionData())
  }, [timeRange])

  useEffect(() => {
    generateMockInventoryData()
  }, [])

  useEffect(() => {
    setPredictions(generateMockPredictions())
    setAlerts(generateMockAlerts())
  }, [])

  useEffect(() => {
    setConversionFunnel(generateMockConversionFunnel())
    setMenuSections(generateMockMenuSections())
    setCartAbandonment(generateMockCartAbandonment())
  }, [])

  const getCongestionColor = (level: string) => {
    switch (level) {
      case "low": return "bg-green-500"
      case "medium": return "bg-orange-500"
      case "high": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  // Custom heatmap cell component
  const CustomHeatMapCell = (props: any) => {
    const { x, y, width, height, value } = props;
    const color = value > 80 ? "#0284c7" : value > 40 ? "#38bdf8" : "#e0f2fe";
    
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#fff"
      />
    );
  };

  // Transform heatmap data for recharts
  const transformHeatMapData = (data: HeatMapData[]) => {
    const categories = Array.from(new Set(data.map(d => d.category)));
    const hours = Array.from(new Set(data.map(d => d.hour)));
    
    return categories.map(category => {
      const row: any = { category };
      hours.forEach(hour => {
        const cell = data.find(d => d.category === category && d.hour === hour);
        row[hour] = cell?.value || 0;
      });
      return row;
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "A": return "bg-red-500"
      case "B": return "bg-yellow-500"
      case "C": return "bg-blue-500"
      default: return "bg-gray-500"
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "A": return "Alto Valor"
      case "B": return "Valor Medio"
      case "C": return "Bajo Valor"
      default: return "Sin Categoría"
    }
  }

  const pieChartData = [
    { name: "Categoría A", value: inventoryStats.categoryA },
    { name: "Categoría B", value: inventoryStats.categoryB },
    { name: "Categoría C", value: inventoryStats.categoryC }
  ]

  const COLORS = ['#ef4444', '#eab308', '#3b82f6']

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "info":
        return <Bell className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  // Contadores de órdenes por canal
  const countBySource = (src: string) =>
    orders.filter(order => (order as any).source === src).length
  const countMeseros = () =>
    orders.filter(order => !(order as any).source || !['POS','WHATSAPP','QR','DIDDI','RAPPI'].includes((order as any).source)).length
  // Total de ventas por canal
  const totalBySource = (src: string) =>
    orders.filter(order => (order as any).source === src).reduce((sum, order) => sum + calculateOrderTotal(order), 0)
  const totalMeseros = () =>
    orders.filter(order => !(order as any).source || !['POS','WHATSAPP','QR','DIDDI','RAPPI'].includes((order as any).source)).reduce((sum, order) => sum + calculateOrderTotal(order), 0)

  // Utilidad para pluralizar 'órden/órdenes'
  const ordenesLabel = (count: number) => {
    const orderText = count === 1 ? dashboardTranslations.order : dashboardTranslations.orders
    return `${count} ${orderText}`
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{dashboardTranslations.title}</h2>
        <div className="flex items-center space-x-2">
          <Button>{dashboardTranslations.newLocation}</Button>
        </div>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{dashboardTranslations.overview}</TabsTrigger>
          <TabsTrigger value="analytics">{dashboardTranslations.analytics}</TabsTrigger>
          <TabsTrigger value="reports">{dashboardTranslations.reports}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {dashboardTranslations.totalSales}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalSales.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% {dashboardTranslations.sinceLastMonth}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {dashboardTranslations.activeOrders}
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.activeOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardTranslations.total}: ${orderStats.activeOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {dashboardTranslations.paidOrders}
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.paidOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardTranslations.total}: ${orderStats.paidOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {dashboardTranslations.unpaidOrders}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unpaidOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardTranslations.total}: ${unpaidOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {dashboardTranslations.cancelledOrders}
                </CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.cancelledOrders.count}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardTranslations.total}: ${orderStats.cancelledOrders.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Canales de Pedido - ORDEN PERSONALIZADO */}
          <Card>
            <CardHeader>
              <CardTitle>{dashboardTranslations.orderChannels}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* POS */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{dashboardTranslations.pos}</CardTitle>
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">${totalBySource('POS').toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">{ordenesLabel(countBySource('POS'))}</p>
                  </CardContent>
                </Card>
                {/* IA WHATSAPP */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{dashboardTranslations.aiWhatsapp}</CardTitle>
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">${totalBySource('WHATSAPP').toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">{ordenesLabel(countBySource('WHATSAPP'))}</p>
                  </CardContent>
                </Card>
                {/* QR MESAS */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{dashboardTranslations.qrTables}</CardTitle>
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">${totalBySource('QR').toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">{ordenesLabel(countBySource('QR'))}</p>
                  </CardContent>
                </Card>
                {/* MESEROS */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{dashboardTranslations.waiters}</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">${totalMeseros().toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">{ordenesLabel(countMeseros())}</p>
                  </CardContent>
                </Card>
                {/* DIDDI */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{dashboardTranslations.diddi}</CardTitle>
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">${totalBySource('DIDDI').toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">{ordenesLabel(countBySource('DIDDI'))}</p>
                  </CardContent>
                </Card>
                {/* RAPPI */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{dashboardTranslations.rappi}</CardTitle>
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-primary">${totalBySource('RAPPI').toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground">{ordenesLabel(countBySource('RAPPI'))}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>{dashboardTranslations.salesByLocation}</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <Overview />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{dashboardTranslations.topProducts}</CardTitle>
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
                            {product.quantity} {dashboardTranslations.unitsSold}
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
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{dashboardTranslations.salesAndPareto}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={dashboardTranslations.selectPeriod} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">{dashboardTranslations.lastWeek}</SelectItem>
                      <SelectItem value="month">{dashboardTranslations.lastMonth}</SelectItem>
                      <SelectItem value="custom">{dashboardTranslations.customRange}</SelectItem>
                    </SelectContent>
                  </Select>
                  {timeRange === "custom" && (
                    <Button variant="outline" size="icon">
                      <Calendar className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={paretoData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name={dashboardTranslations.revenueByProduct} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativePercentage"
                      stroke="#82ca9d"
                      name={dashboardTranslations.cumulativePercentage}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#8884d8] rounded"></div>
                  <span className="text-sm">{dashboardTranslations.revenueByProduct}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#82ca9d] rounded"></div>
                  <span className="text-sm">{dashboardTranslations.cumulativePercentage}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Kitchen Analytics Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{dashboardTranslations.kitchenTimes}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={dashboardTranslations.selectPeriod} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">{dashboardTranslations.lastWeek}</SelectItem>
                      <SelectItem value="month">{dashboardTranslations.lastMonth}</SelectItem>
                      <SelectItem value="custom">{dashboardTranslations.customRange}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {/* Heatmap Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">{dashboardTranslations.activityByHour}</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={transformHeatMapData(heatMapData)}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="category" 
                          type="category"
                          tick={{ transform: 'translate(0, 10) rotate(-45)' }}
                          height={60}
                        />
                        <YAxis 
                          type="category"
                          dataKey="hour"
                          tickFormatter={(value) => `${value}:00`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const hour = payload[0].name;
                              const value = payload[0].value;
                              return (
                                <div className="bg-white p-2 border rounded shadow">
                                  <p className="font-medium">{label}</p>
                                  <p className="text-sm">{`${hour}:00 - ${value} ${dashboardTranslations.orders}`}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {Array.from(new Set(heatMapData.map(d => d.hour))).map(hour => (
                          <Bar
                            key={hour}
                            dataKey={hour.toString()}
                            fill="#8884d8"
                            shape={<CustomHeatMapCell />}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Boxplot Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">{dashboardTranslations.preparationTimes}</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={boxPlotData}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ value: dashboardTranslations.minutes, angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Bar dataKey="median" fill="#8884d8" name={dashboardTranslations.averageTime} />
                        <Line type="monotone" dataKey="max" stroke="#ff7300" name={dashboardTranslations.maximum} />
                        <Line type="monotone" dataKey="min" stroke="#82ca9d" name={dashboardTranslations.minimum} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Congestion Indicator Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">{dashboardTranslations.congestionByHour}</h3>
                  <div className="grid grid-cols-15 gap-2">
                    {congestionData.map((data) => (
                      <div key={data.hour} className="flex flex-col items-center">
                        <div className={`w-full h-8 ${getCongestionColor(data.level)} rounded-t`} />
                        <div className="text-sm font-medium mt-1">{data.hour}:00</div>
                        <div className="text-xs text-muted-foreground">{data.orders} {dashboardTranslations.orders}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">{dashboardTranslations.low}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span className="text-sm">{dashboardTranslations.medium}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm">{dashboardTranslations.high}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Inventory Analysis Card */}
          <Card>
            <CardHeader>
              <CardTitle>{dashboardTranslations.ingredientsAndWaste}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {/* ABC Analysis Section */}
                <div className="grid grid-cols-3 gap-4">
                  {["A", "B", "C"].map((category) => (
                    <Card key={category}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {dashboardTranslations.category} {category}
                          </CardTitle>
                          <Badge className={getCategoryColor(category)}>
                            {category === "A" ? dashboardTranslations.highValue :
                             category === "B" ? dashboardTranslations.mediumValue :
                             dashboardTranslations.lowValue}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {inventoryItems.filter(item => item.category === category).length} {dashboardTranslations.items}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {category === "A" ? dashboardTranslations.highValueDesc :
                           category === "B" ? dashboardTranslations.mediumValueDesc :
                           dashboardTranslations.lowValueDesc}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Donut Chart Section */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{dashboardTranslations.inventoryDistribution}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              fill="#8884d8"
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 flex justify-center gap-4">
                        {pieChartData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full`} style={{ backgroundColor: COLORS[index] }} />
                            <span className="text-sm">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Inventory Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{dashboardTranslations.consumptionVsStock}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>{dashboardTranslations.category}</TableHead>
                              <TableHead>{dashboardTranslations.currentStock}</TableHead>
                              <TableHead>{dashboardTranslations.consumption}</TableHead>
                              <TableHead>{dashboardTranslations.prediction}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {inventoryItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>
                                  <Badge className={getCategoryColor(item.category)}>
                                    {item.category}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.currentStock}
                                    onChange={(e) => {
                                      const newItems = inventoryItems.map(i =>
                                        i.id === item.id
                                          ? { ...i, currentStock: Number(e.target.value) }
                                          : i
                                      )
                                      setInventoryItems(newItems)
                                    }}
                                    className="w-20"
                                  />
                                  <span className="ml-2 text-sm text-muted-foreground">{item.unit}</span>
                                </TableCell>
                                <TableCell>{item.consumption} {item.unit}</TableCell>
                                <TableCell>{item.prediction} {item.unit}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{dashboardTranslations.predictionsAndRecommendations}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {/* Prediction Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {predictions.map((prediction) => (
                    <Card key={prediction.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {prediction.product}
                          </CardTitle>
                          <Badge variant={prediction.type === "high_demand" ? "success" : "warning"}>
                            {prediction.confidence}% {dashboardTranslations.confidence}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-4">{prediction.message}</p>
                        <div className="h-[60px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={prediction.trend.map((value, index) => ({ value }))}>
                              <defs>
                                <linearGradient id={`color-${prediction.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#8884d8"
                                fillOpacity={1}
                                fill={`url(#color-${prediction.id})`}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Alerts Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{dashboardTranslations.systemAlerts}</CardTitle>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Bell className="h-4 w-4" />
                        {alerts.length} {dashboardTranslations.alerts}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-start gap-4 p-4 rounded-lg border"
                        >
                          <div className="mt-1">
                            {getAlertIcon(alert.type)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{alert.message}</p>
                            {alert.daysLeft && (
                              <p className="text-sm text-muted-foreground">
                                {alert.daysLeft} {dashboardTranslations.daysLeft}
                              </p>
                            )}
                          </div>
                          {alert.ingredient && (
                            <Badge variant="outline">
                              {alert.ingredient}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Order Analysis Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>{dashboardTranslations.orderAnalysis}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6">
                      {/* Conversion Funnel */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">{dashboardTranslations.conversionFunnel}</h3>
                        <div className="grid grid-cols-4 gap-4">
                          {conversionFunnel.map((stage, index) => (
                            <div key={stage.stage} className="relative">
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium">
                                    {dashboardTranslations[stage.stage.toLowerCase() as keyof typeof dashboardTranslations] || stage.stage}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold">{stage.value}</div>
                                  <p className="text-xs text-muted-foreground">
                                    {stage.percentage}% {dashboardTranslations.conversionRate}
                                  </p>
                                </CardContent>
                              </Card>
                              {index < conversionFunnel.length - 1 && (
                                <div className="absolute -right-2 top-1/2 transform -translate-y-1/2">
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Menu Section Analysis */}
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>{dashboardTranslations.averageTimeBySection}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[300px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={menuSections}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis label={{ value: dashboardTranslations.seconds, angle: -90, position: 'insideLeft' }} />
                                  <Tooltip />
                                  <Bar dataKey="avgTime" fill="#8884d8" name={dashboardTranslations.averageTime} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Cart Abandonment */}
                        <Card>
                          <CardHeader>
                            <CardTitle>{dashboardTranslations.cartAbandonmentRate}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[300px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={cartAbandonment}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis label={{ value: dashboardTranslations.percentage, angle: -90, position: 'insideLeft' }} />
                                  <Tooltip />
                                  <Bar dataKey="rate" fill="#ef4444" name={dashboardTranslations.abandonmentRate} />
                                  <Line
                                    type="monotone"
                                    dataKey="trend"
                                    stroke="#8884d8"
                                    name={dashboardTranslations.trend}
                                    dot={false}
                                  />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
  