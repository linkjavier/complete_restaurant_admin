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
  Timer,
  Nfc,
  HandCoins
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
  productVariant?: {
    name: string
    image?: string
    price: number
  }
  // Permitir variantes múltiples por compatibilidad con backend
  variants?: Array<{
    groupName?: string
    productVariant?: {
      name: string
      image?: string
      price?: number
    }
  }>
}

interface Order {
  id: string
  table?: {
    number: number
  }
  items: OrderItem[]
  status: OrderStatus
  paymentMethod?: PaymentMethod
  total: number
  createdAt: string
  updatedAt: string
  customerName?: string
  isPaid: boolean
  type: "TABLE" | "TAKEOUT" | "DELIVERY"
  deliveryAddress?: string
  neighborhood?: string
  phone?: string
  source?: string
  deliveryFee?: number
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
    const initialFetch = async () => {
      setLoading(true);
      try {
        await fetchOrders();
      } finally {
        setLoading(false);
      }
    };
    
    initialFetch();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

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
        
        return [newOrder, ...prevOrders]
      })

      // Move toast outside of setState
      if (!orders.some(order => order.id === newOrder.id)) {
        toast({
          title: "Nueva Orden",
          description: `Mesa #${newOrder.table?.number} - ${newOrder.items.length} productos`,
        })
      }
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders?kitchen=false`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar las órdenes');
      }

      const data = await response.json();
      
      // Silently update orders without affecting UI state
      setOrders(prevOrders => {
        // Only update if there are actual changes
        const hasChanges = JSON.stringify(prevOrders) !== JSON.stringify(data);
        return hasChanges ? data : prevOrders;
      });

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          orderId,
          method: paymentMethod,
          amount: calculateOrderTotal(orders.find(o => o.id === orderId)!)
        })
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

  // Helper function to calculate order total (productos + deliveryFee si aplica)
  const calculateOrderTotal = (order: Order) => {
    if (!order?.items?.length) return 0;
    const itemsTotal = order.items.reduce((total, item) => {
      if (item.status === "CANCELLED") return total;
      return total + (item.quantity * (item.product?.price || 0));
    }, 0);
    return itemsTotal + (order.deliveryFee || 0);
  };

  // Helper function to calculate solo el subtotal de productos
  const calculateOrderSubtotal = (order: Order) => {
    if (!order?.items?.length) return 0;
    return order.items.reduce((total, item) => {
      if (item.status === "CANCELLED") return total;
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

  const getItemStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      PENDING: { label: "Pendiente", variant: "warning", icon: <Clock className="h-3 w-3 mr-1" /> },
      IN_PROGRESS: { label: "En Progreso", variant: "info", icon: <Timer className="h-3 w-3 mr-1" /> },
      READY: { label: "Listo", variant: "success", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
      CANCELLED: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
      PAID: { label: "Pagado", variant: "default", icon: <CreditCard className="h-3 w-3 mr-1" /> }
    }

    const config = statusConfig[status]
    return (
      <Badge 
        variant={config.variant as any}
        className="flex items-center"
      >
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const getPaymentMethodIcon = (method?: PaymentMethod) => {
    if (!method) return null
    
    const icons = {
      CASH: <Receipt className="h-4 w-4" />,
      CARD: <CreditCard className="h-4 w-4" />,
      TRANSFER: <Nfc className="h-4 w-4" />,
      OTHER: <HandCoins className="h-4 w-4" />
    }

    // Si method es null, undefined o 'OTHER', muestra el ícono de OTHER
    return icons[method as PaymentMethod] || icons.OTHER
  }

  const filteredOrders = orders.filter(order => {
    switch (activeTab) {
      case "active":
        return order.status === "PENDING" || order.status === "IN_PROGRESS"
      case "completed":
        return order.status === "READY"
      case "paid":
        return order.isPaid
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
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2">
                <TabsTrigger 
                  value="active" 
                  className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <Clock className="h-4 w-4" />
                  <span>Activas</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="completed" 
                  className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Completadas</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="paid" 
                  className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Pagadas</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="cancelled" 
                  className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Canceladas</span>
                </TabsTrigger>
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
                <TabsContent value={activeTab} className="mt-16 md:mt-8">
                  <div className="space-y-4">
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
                                  <h3 className="font-bold text-lg">
                                    {order.type === "DELIVERY" ? (
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span>Domicilio</span>
                                          {getStatusBadge(order.status)}
                                        </div>
                                        <div className="text-sm space-y-1 mt-1">
                                          <p className="font-medium text-primary">
                                            Cliente: {order.customerName}
                                          </p>
                                          <p className="text-muted-foreground">
                                            Dirección: {order.deliveryAddress}
                                          </p>
                                          {order.neighborhood && (
                                            <p className="text-muted-foreground">
                                              Barrio: {order.neighborhood}
                                            </p>
                                          )}
                                          <p className="text-muted-foreground">
                                            Teléfono: {order.phone}
                                          </p>
                                        </div>
                                      </div>
                                    ) : order.table?.number ? (
                                      `Mesa #${order.table.number}`
                                    ) : (
                                      'Para Llevar'
                                    )}
                                  </h3>
                                  {order.type !== "DELIVERY" && order.customerName && (
                                    <p className="text-sm font-medium text-primary">
                                      Cliente: {order.customerName}
                                    </p>
                                  )}
                                  <p className="text-sm text-muted-foreground">
                                    Orden #{order.id.substring(0, 8)} - {new Date(order.createdAt).toLocaleTimeString()}
                                  </p>
                                  {order.paymentMethod && (
                                    <p className="text-sm font-medium text-primary mt-1">
                                      Método de pago: {
                                        order.paymentMethod === "CASH" ? "Efectivo" :
                                        order.paymentMethod === "CARD" ? "Tarjeta" :
                                        order.paymentMethod === "TRANSFER" ? "Transferencia" :
                                        "Otro"
                                      }
                                    </p>
                                  )}
                                  {order.source && (
                                    <p className="text-xs mt-1">
                                      <span className="font-semibold">Origen:</span> <span className={`inline-block px-2 py-0.5 rounded text-xs uppercase tracking-wide ${
                                        order.source === 'WHATSAPP' 
                                          ? 'bg-green-200 text-green-700' 
                                          : 'bg-gray-200 text-gray-700'
                                      }`}>{order.source}</span>
                                    </p>
                                  )}
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
                                  <div key={item.id} className="flex justify-between items-start gap-2 py-2 border-b last:border-b-0">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-base">{item.product.name}</p>
                                        {getItemStatusBadge(item.status)}
                                      </div>
                                      {/* Mostrar variantes múltiples si existen */}
                                      {Array.isArray(item.variants) && item.variants.length > 0 && (
                                        <div className="ml-4 mt-1 flex flex-col gap-1">
                                          {item.variants.map((variant, vIdx) => (
                                            <div key={vIdx} className="flex items-center gap-2 bg-primary/10 rounded px-2 py-1">
                                              <span className="text-xs font-semibold text-primary">
                                                {variant.groupName}:
                                              </span>
                                              {variant.productVariant?.image && (
                                                <img src={variant.productVariant.image} alt={variant.productVariant.name} className="w-6 h-6 object-cover rounded border" />
                                              )}
                                              <span className="text-xs font-medium">
                                                {variant.productVariant?.name}
                                              </span>
                                              {typeof variant.productVariant?.price === 'number' && !isNaN(variant.productVariant.price) && (
                                                <span className="text-xs text-muted-foreground">
                                                  ${variant.productVariant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {/* Si solo hay una variante simple */}
                                      {!item.variants && item.productVariant && (
                                        <div className="ml-4 mt-1 flex items-center gap-2 bg-primary/5 rounded px-2 py-1">
                                          {item.productVariant.image && (
                                            <img src={item.productVariant.image} alt={item.productVariant.name} className="w-7 h-7 object-cover rounded border" />
                                          )}
                                          <span className="text-xs font-semibold text-primary">
                                            Variante: {item.productVariant.name}
                                          </span>
                                          {typeof item.productVariant.price === 'number' && !isNaN(item.productVariant.price) && (
                                            <span className="text-xs text-muted-foreground">
                                              ${item.productVariant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <div className="ml-4 text-xs text-muted-foreground mt-1">
                                        {item.quantity} x $
                                        {item.productVariant?.price
                                          ? item.productVariant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })
                                          : item.product.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                      </div>
                                      {item.notes && (
                                        <div className="ml-4 mt-1 text-xs text-yellow-800 bg-yellow-50 rounded px-2 py-1">
                                          <span className="font-semibold">Notas:</span> {item.notes}
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="mt-2">
                                      ${((item.productVariant?.price ?? item.product.price) * item.quantity).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                    </Badge>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 pt-4 border-t">
                                {order.type === "DELIVERY" ? (
                                  <>
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="font-medium">Subtotal:</span>
                                      <span className="font-medium">
                                        ${calculateOrderSubtotal(order).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mt-1">
                                      <span className="font-medium">Domicilio:</span>
                                      <span className="font-medium">
                                        ${order.deliveryFee ? order.deliveryFee.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : '0'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="font-bold">Total:</span>
                                      <span className="font-bold">
                                        ${calculateOrderTotal(order).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex justify-between items-center mt-2">
                                    <span className="font-bold">Total:</span>
                                    <span className="font-bold">
                                      ${calculateOrderTotal(order).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                )}
                                {order.status === "READY" && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Badge variant={order.isPaid ? "success" : "warning"}>
                                      {order.isPaid ? (
                                        <div className="flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Pagada
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3" />
                                          Pendiente de Pago
                                        </div>
                                      )}
                                    </Badge>
                                  </div>
                                )}
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
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}