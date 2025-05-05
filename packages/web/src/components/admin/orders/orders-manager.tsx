"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  CreditCard, 
  Printer, 
  Receipt, 
  AlertCircle,
  Timer
} from "lucide-react"
import { useOrderSocket } from "@/hooks/use-order-socket"

// Tipos para las órdenes
type OrderStatus = "PENDING" | "IN_PROGRESS" | "READY" | "CANCELLED" | "PAID"
type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER"

interface OrderItem {
  id: string
  product: {
    name: string
    price: number
  }
  quantity: number
  status: OrderStatus
  notes?: string
}

interface Order {
  id: string
  table: {
    number: number
  }
  items: OrderItem[]
  status: OrderStatus
  paymentMethod?: PaymentMethod
  total: number
  createdAt: string
  updatedAt: string
}

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("active")
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const { subscribe, connected, socket, emit } = useOrderSocket()

  // Initial fetch and polling setup
  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  // Join orders room when socket is connected and user has a locationId
  useEffect(() => {
    if (connected && user?.locationId) {
      try {
        console.log(`Trying to join orders-${user.locationId} channel...`);
        
        setTimeout(() => {
          const joined = emit('join-kitchen', user.locationId);
          console.log(`Emit join-kitchen for location: ${user.locationId}. Success: ${joined}`);
          
          if (joined) {
            setTimeout(() => {
              console.log("Testing WebSocket by emitting a test message");
              emit('ping', { test: 'message' });
            }, 1000);
          }
        }, 500);
      } catch (error) {
        console.error("Error joining orders channel:", error);
      }
    }
  }, [connected, user, emit])

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!connected) {
      console.log("Socket not connected yet, waiting...")
      return
    }

    console.log("Setting up WebSocket event listeners for orders")

    // Listen for new orders
    const unsubscribeNewOrder = subscribe('new_order_created', (newOrderData) => {
      const newOrder = Array.isArray(newOrderData) ? newOrderData[0] : newOrderData;
      
      console.log("new_order_created event received:", newOrder)
      
      setOrders(prevOrders => {
        if (prevOrders.some(order => order.id === newOrder.id)) {
          return prevOrders
        }
        
        toast({
          title: "Nueva Orden",
          description: `Mesa #${newOrder.table?.number} - ${newOrder.items.length} productos`,
        })
        
        return [newOrder, ...prevOrders]
      })
    })

    // Listen for order updates
    const unsubscribeOrderUpdated = subscribe('order_updated', (updatedOrderData) => {
      const updatedOrder = Array.isArray(updatedOrderData) ? updatedOrderData[0] : updatedOrderData;
      
      console.log("order_updated event received:", updatedOrder)
      
      if (!updatedOrder) {
        console.warn("Received invalid order update")
        return;
      }
      
      setOrders(prevOrders => {
        return prevOrders.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        )
      })
    })

    // Listen for order item updates
    const unsubscribeOrderItemUpdated = subscribe('order_item_updated', (dataRaw) => {
      const data = Array.isArray(dataRaw) ? dataRaw[0] : dataRaw;
      
      console.log("order_item_updated event received:", data)
      
      if (!data || !data.item || !data.order) {
        console.warn("Received invalid order item update", data)
        return;
      }
      
      const { item, order } = data
      
      setOrders(prevOrders => {
        const orderIndex = prevOrders.findIndex(o => o.id === order.id)
        
        if (orderIndex === -1) {
          return [...prevOrders, order]
        }
        
        const updatedOrders = [...prevOrders]
        const updatedOrder = { ...updatedOrders[orderIndex] }
        
        updatedOrder.items = updatedOrder.items.map(i => 
          i.id === item.id ? { ...i, ...item } : i
        )
        
        updatedOrders[orderIndex] = updatedOrder
        return updatedOrders
      })
    })

    // Clean up subscriptions
    return () => {
      console.log("Cleaning up WebSocket event listeners")
      unsubscribeNewOrder()
      unsubscribeOrderUpdated()
      unsubscribeOrderItemUpdated()
    }
  }, [connected, subscribe, toast])

  // Create a connection status indicator
  const connectionStatus = connected ? (
    <div className="text-sm text-green-500 flex items-center justify-end mb-2">
      <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
      Conectado en tiempo real
    </div>
  ) : (
    <div className="text-sm text-yellow-500 flex items-center justify-end mb-2">
      <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2"></span>
      Reconectando...
    </div>
  )

  // Updated fetchOrders function to include the required kitchen=true query parameter
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders?kitchen=false`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar las órdenes');
      }

      const data = await response.json();
      setOrders(data);

      console.log('Orders fetched successfully:', data);
    } catch (err) {
      console.error('Error fetching orders:', err);

      if (
        err.message?.includes('No authentication token found') ||
        err.message?.includes('Authentication expired') ||
        err.message?.includes('Unauthorized')
      ) {
        setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      } else {
        setError('Error al cargar las órdenes. Por favor, intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        throw new Error('Error al actualizar el estado de la orden')
      }

      toast({
        title: "Éxito",
        description: `Estado de la orden actualizado a ${status}`,
      })
      
      fetchOrders()
    } catch (err: any) {
      console.error('Error updating order status:', err)
      toast({
        title: "Error",
        description: "Error al actualizar el estado de la orden",
        variant: "destructive",
      })
    }
  }

  const handleProcessPayment = async (orderId: string, paymentMethod: PaymentMethod) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ paymentMethod })
      })

      if (!response.ok) {
        throw new Error('Error al procesar el pago')
      }

      toast({
        title: "Éxito",
        description: "Pago procesado correctamente",
      })
      
      fetchOrders()
    } catch (err: any) {
      console.error('Error processing payment:', err)
      toast({
        title: "Error",
        description: "Error al procesar el pago",
        variant: "destructive",
      })
    }
  }

  const handlePrintReceipt = async (orderId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/receipt`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al imprimir el ticket')
      }

      toast({
        title: "Éxito",
        description: "Ticket enviado a la impresora",
      })
    } catch (err: any) {
      console.error('Error printing receipt:', err)
      toast({
        title: "Error",
        description: "Error al imprimir el ticket",
        variant: "destructive",
      })
    }
  }

  // Helper function to calculate order total
  const calculateOrderTotal = (order: Order) => {
    if (!order?.items?.length) return 0;
    return order.items.reduce((total, item) => {
      return total + (item.quantity * (item.product?.price || 0));
    }, 0);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      PENDING: { label: "Pendiente", variant: "warning" },
      IN_PROGRESS: { label: "En Progreso", variant: "info" },
      READY: { label: "Completada", variant: "success" },
      CANCELLED: { label: "Cancelada", variant: "destructive" },
      PAID: { label: "Pagada", variant: "default" }
    }

    const config = statusConfig[status]
    return (
      <Badge 
        variant={config.variant as any}
        className={status === "CANCELLED" ? "bg-red-100 text-red-700 hover:bg-red-200" : ""}
      >
        {config.label}
      </Badge>
    )
  }

  const getPaymentMethodIcon = (method?: PaymentMethod) => {
    if (!method) return null
    
    const icons = {
      CASH: <Receipt className="h-4 w-4" />,
      CARD: <CreditCard className="h-4 w-4" />,
      TRANSFER: <CreditCard className="h-4 w-4" />,
      OTHER: <AlertCircle className="h-4 w-4" />
    }

    return icons[method]
  }

  const filteredOrders = orders.filter(order => {
    switch (activeTab) {
      case "active":
        return order.status === "PENDING" || order.status === "IN_PROGRESS"
      case "completed":
        return order.status === "READY"
      case "paid":
        return order.status === "PAID"
      case "cancelled":
        return order.status === "CANCELLED"
      default:
        return true
    }
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Gestión de Órdenes</CardTitle>
            {connectionStatus}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {user?.locationId ? `Ubicación: ${user.locationId}` : 'Sin ubicación asignada'}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active">Activas</TabsTrigger>
              <TabsTrigger value="completed">Completadas</TabsTrigger>
              <TabsTrigger value="paid">Pagadas</TabsTrigger>
              <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="text-center py-8">Cargando órdenes...</div>
            ) : error ? (
              <div className="text-center text-red-500 py-8">
                {error}
                <div className="mt-4">
                  <Button onClick={fetchOrders}>Reintentar</Button>
                </div>
              </div>
            ) : (
              <TabsContent value={activeTab} className="space-y-4">
                {filteredOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No hay órdenes en esta categoría
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-muted p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-bold text-lg">Mesa #{order.table.number}</h3>
                              <p className="text-sm text-muted-foreground">
                                Orden #{order.id.substring(0, 8)} - {new Date(order.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(order.status)}
                              {order.paymentMethod && getPaymentMethodIcon(order.paymentMethod)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <div className="space-y-4">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium">{item.product.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.quantity} x ${item.product.price.toFixed(2)}
                                  </p>
                                  {item.notes && (
                                    <p className="text-sm text-muted-foreground">
                                      Notas: {item.notes}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline">
                                  ${(item.product.price * item.quantity).toFixed(2)}
                                </Badge>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 pt-4 border-t">
                            <div className="flex justify-between items-center">
                              <span className="font-bold">Total:</span>
                              <span className="font-bold">
                                ${calculateOrderTotal(order).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex justify-end gap-2">
                            {order.status === "PENDING" && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleUpdateOrderStatus(order.id, "IN_PROGRESS")}
                                >
                                  Iniciar Preparación
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => handleUpdateOrderStatus(order.id, "CANCELLED")}
                                >
                                  Cancelar Orden
                                </Button>
                              </>
                            )}
                            
                            {order.status === "IN_PROGRESS" && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleUpdateOrderStatus(order.id, "READY")}
                              >
                                Marcar como Completada
                              </Button>
                            )}

                            {order.status === "READY" && !order.paymentMethod && (
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleProcessPayment(order.id, "CASH")}
                                >
                                  Pago en Efectivo
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleProcessPayment(order.id, "CARD")}
                                >
                                  Pago con Tarjeta
                                </Button>
                              </div>
                            )}

                            {order.status === "PAID" && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handlePrintReceipt(order.id)}
                              >
                                Imprimir Ticket
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}