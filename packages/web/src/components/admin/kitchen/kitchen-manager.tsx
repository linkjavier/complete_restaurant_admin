"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getKitchenOrders, updateKitchenOrderItemStatus, printKitchenTicket } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useOrderSocket } from "@/hooks/use-order-socket"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export function KitchenManager() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemToCancel, setItemToCancel] = useState<{ id: string, name: string } | null>(null)
  const { toast } = useToast()
  const { subscribe, connected, socket, emit } = useOrderSocket()
  const { user } = useAuth()
  const router = useRouter()

  // Initial fetch of orders
  useEffect(() => {
    fetchOrders()
    
    // Set up polling as a fallback (every 2 minutes)
    const interval = setInterval(fetchOrders, 120000)
    return () => clearInterval(interval)
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching orders...")
      const data = await getKitchenOrders()

      console.log("Received orders:", data)
      // Filter orders that have items with status PENDING or IN_PROGRESS
      const activeOrders = data.filter(order => 
        order.items.some(item => 
          item.status === "PENDING" || item.status === "IN_PROGRESS"
        )
      )
      setOrders(activeOrders)
    } catch (err: any) {
      console.error('Error fetching orders:', err)
      
      // Check if the error is authentication related
      if (err.message?.includes('No authentication token found') || 
          err.message?.includes('Authentication expired') ||
          err.message?.includes('Unauthorized')) {
        setError("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.")
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      } else {
        setError("Error al cargar las órdenes de cocina. Por favor, intenta de nuevo.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateItemStatus = async (itemId: string, status: "PENDING" | "IN_PROGRESS" | "READY" | "CANCELLED") => {
    try {
      await updateKitchenOrderItemStatus(itemId, status)
      
      // Update local state immediately
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          const updatedItems = order.items.map(item => 
            item.id === itemId ? { ...item, status } : item
          )
          
          // If status is READY and all items are ready, keep the order for 5 seconds
          if (status === "READY" && updatedItems.every(i => i.status === "READY")) {
            toast({
              title: "Orden Completada",
              description: "La orden se eliminará en 5 segundos",
            })
            
            setTimeout(() => {
              setOrders(currentOrders => 
                currentOrders.filter(o => o.id !== order.id)
              )
            }, 5000)
          }
          
          return {
            ...order,
            items: updatedItems
          }
        }).filter(order => 
          order.items.some(i => i.status === "PENDING" || i.status === "IN_PROGRESS")
        )
      })

      toast({
        title: "Éxito",
        description: `Estado del item actualizado a ${status}`,
      })
    } catch (err: any) {
      console.error('Error updating item status:', err)
      
      // Check if the error is authentication related
      if (err.message?.includes('No authentication token found') || 
          err.message?.includes('Authentication expired') ||
          err.message?.includes('Unauthorized')) {
        toast({
          title: "Error de autenticación",
          description: "Tu sesión ha expirado. Redirigiendo al inicio de sesión...",
          variant: "destructive",
        })
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      } else {
        toast({
          title: "Error",
          description: "Error al actualizar el estado del item. Por favor, intenta de nuevo.",
          variant: "destructive",
        })
      }
    }
  }

  const handlePrintTicket = async (orderId: string) => {
    try {
      await printKitchenTicket(orderId)
      toast({
        title: "Éxito",
        description: "Ticket enviado a la impresora",
      })
    } catch (err: any) {
      console.error('Error printing ticket:', err)
      
      // Check if the error is authentication related
      if (err.message?.includes('No authentication token found') || 
          err.message?.includes('Authentication expired') ||
          err.message?.includes('Unauthorized')) {
        toast({
          title: "Error de autenticación",
          description: "Tu sesión ha expirado. Redirigiendo al inicio de sesión...",
          variant: "destructive",
        })
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      } else {
        toast({
          title: "Error",
          description: "Error al imprimir el ticket. Por favor, intenta de nuevo.",
          variant: "destructive",
        })
      }
    }
  }

  const handleStartOrder = async (orderId: string, items: any[]) => {
    try {
      const pendingItems = items.filter(item => item.status === "PENDING");
      
      // Update all pending items to IN_PROGRESS
      for (const item of pendingItems) {
        await updateKitchenOrderItemStatus(item.id, "IN_PROGRESS");
      }

      // Update local state immediately
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              items: order.items.map(item => 
                item.status === "PENDING" ? { ...item, status: "IN_PROGRESS" } : item
              )
            }
          }
          return order
        })
      })

      toast({
        title: "Éxito",
        description: "Orden iniciada correctamente",
      });
    } catch (err: any) {
      console.error('Error starting order:', err);
      toast({
        title: "Error",
        description: "Error al iniciar la orden",
        variant: "destructive",
      });
    }
  };

  // Join the kitchen-specific channel when socket is connected and user has a locationId
  useEffect(() => {
    if (connected && user?.locationId) {
      try {
        console.log(`Trying to join kitchen-${user.locationId} channel...`);
        
        // Add a delay to ensure connection is fully established
        setTimeout(() => {
          // Emit event to join the kitchen channel for this location
          const joined = emit('join-kitchen', user.locationId);
          console.log(`Emit join-kitchen for location: ${user.locationId}. Success: ${joined}`);
        }, 500);
      } catch (error) {
        console.error("Error joining kitchen channel:", error);
      }
    }
  }, [connected, user, emit])

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!connected) {
      console.log("Socket not connected yet, waiting...")
      return
    }

    console.log("Setting up WebSocket event listeners for kitchen")

    // Listen for new orders
    const unsubscribeNewOrder = subscribe('new_order_created', (newOrderData) => {
      const newOrder = Array.isArray(newOrderData) ? newOrderData[0] : newOrderData;
      console.log("new_order_created event received:", newOrder);

      // Solo agregar si tiene items pendientes o en progreso
      if (
        newOrder.items &&
        newOrder.items.some(item => item.status === "PENDING" || item.status === "IN_PROGRESS")
      ) {
        setOrders(prevOrders => {
          // Evitar duplicados
          if (prevOrders.some(order => order.id === newOrder.id)) {
            return prevOrders;
          }
          // Agregar al inicio para que la orden más reciente esté arriba
          return [newOrder, ...prevOrders];
        });
      }
    });

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
          if (order.items.some(i => i.status === "PENDING" || i.status === "IN_PROGRESS")) {
            return [...prevOrders, order]
          }
          return prevOrders
        }
        
        const updatedOrders = [...prevOrders]
        const updatedOrder = { ...order }
        updatedOrders[orderIndex] = updatedOrder

        // Si todos los ítems están en estado READY, esperar 5 segundos antes de filtrar
        if (updatedOrder.items.every(i => i.status === "READY")) {
          toast({
            title: "Orden Completada",
            description: "La orden se eliminará en 5 segundos",
          })
          
          setTimeout(() => {
            setOrders(currentOrders => 
              currentOrders.filter(o => o.id !== updatedOrder.id)
            )
          }, 5000)
          
          return updatedOrders
        }
        
        return updatedOrders.filter(order => 
          order.items.some(i => i.status === "PENDING" || i.status === "IN_PROGRESS")
        )
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
        ).filter(order => 
          order.items.some(item => item.status === "PENDING" || item.status === "IN_PROGRESS")
        )
      })
    })

    // Clean up subscriptions when component unmounts
    return () => {
      console.log("Cleaning up WebSocket event listeners")
      unsubscribeNewOrder();
      unsubscribeOrderUpdated();
      unsubscribeOrderItemUpdated();
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Órdenes Activas</CardTitle>
            {connectionStatus}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {user?.locationId ? `Ubicación: ${user.locationId}` : 'Sin ubicación asignada'}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center">Cargando órdenes...</div>
          ) : error ? (
            <div className="text-center text-red-500">
              {error}
              <div className="mt-4">
                <Button onClick={fetchOrders}>Reintentar</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {orders.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No hay órdenes activas
                </div>
              ) : (
                orders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="bg-muted p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-lg">Mesa #{order.table?.number}</h3>
                            <p className="text-sm text-muted-foreground">
                              Orden #{order.id.substring(0, 8)} - {new Date(order.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handlePrintTicket(order.id)}
                            >
                              Imprimir Ticket
                            </Button>
                            {order.items.some(item => item.status === "PENDING") && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleStartOrder(order.id, order.items)}
                              >
                                Recibido
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <h4 className="font-medium mb-2">Items:</h4>
                        <ul className="space-y-4">
                          {order.items
                            .filter(item => item.status !== "COMPLETED")
                            .map((item) => (
                              <li key={item.id} className="border-b pb-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{item.product.name}</p>
                                      <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        x{item.quantity}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                      {item.status === "PENDING" ? "Pendiente" : 
                                       item.status === "IN_PROGRESS" ? "En preparación" : 
                                       item.status === "READY" ? "Completado" : 
                                       item.status === "CANCELLED" ? "Cancelado" : 
                                       item.status}
                                    </p>
                                    {item.notes && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        Notas: {item.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex space-x-2">
                                    {item.status === "PENDING" && (
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUpdateItemStatus(item.id, "IN_PROGRESS")}
                                      >
                                        Iniciar Preparación
                                      </Button>
                                    )}
                                    {item.status === "IN_PROGRESS" && (
                                      <>
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleUpdateItemStatus(item.id, "PENDING")}
                                        >
                                          Volver a Pendiente
                                        </Button>
                                        <Button 
                                          size="sm"
                                          variant="default"
                                          onClick={() => handleUpdateItemStatus(item.id, "READY")}
                                        >
                                          Marcar Completado
                                        </Button>
                                      </>
                                    )}
                                    <Button 
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => setItemToCancel({ id: item.id, name: item.product.name })}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!itemToCancel} onOpenChange={(open) => !open && setItemToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cancelación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas cancelar el pedido de {itemToCancel?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemToCancel(null)}
            >
              No, mantener
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (itemToCancel) {
                  handleUpdateItemStatus(itemToCancel.id, "CANCELLED")
                  setItemToCancel(null)
                }
              }}
            >
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}