"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, Volume2, VolumeX } from "lucide-react"
import { getKitchenOrders, updateKitchenOrderItemStatus, printKitchenTicket } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useOrderSocket } from "@/hooks/use-order-socket"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { getLocations, Location } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin } from "lucide-react"

export function KitchenManager() {
  const [orders, setOrders] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemToCancel, setItemToCancel] = useState<{ id: string, name: string } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()
  const { subscribe, connected, socket, emit } = useOrderSocket()
  const { user } = useAuth()
  const router = useRouter()
  const [orderJustCompleted, setOrderJustCompleted] = useState<string | null>(null)

  const playSound = async () => {
    if (!soundEnabled || !audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (err) {
      console.warn('No se pudo reproducir el sonido:', err);
      // Si el error es por falta de interacción, mostramos un toast
      if (!hasInteracted) {
        toast({
          title: "Atención",
          description: "Interactúa con la página para habilitar las notificaciones de sonido",
          duration: 3000
        });
      }
    }
  };

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/sounds/new-order.mp3')
    if (audioRef.current) {
      audioRef.current.volume = 0.5
    }
  }, [])

  // Detect user interaction
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      // Pre-load audio after interaction
      if (audioRef.current) {
        audioRef.current.load();
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Initial fetch of orders
  useEffect(() => {
    fetchOrders()

    // Set up polling as a fallback (every 2 minutes)
    const interval = setInterval(fetchOrders, 120000)
    return () => clearInterval(interval)
  }, [selectedLocationId]) // Recarga cuando cambia la sede

  // Fetch locations for labels and selector
  useEffect(() => {
    const fetchLocationsData = async () => {
      try {
        const data = await getLocations();
        setLocations(data);
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    };
    fetchLocationsData();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching orders...")

      const locationId = (user?.role === 'SUPER_ADMIN')
        ? selectedLocationId
        : (user?.locationId || undefined);

      const data = await getKitchenOrders(locationId)

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
          if (status === "READY" && updatedItems.every(i => i.status === "READY" || i.status === "CANCELLED")) {
            setOrderJustCompleted(order.id)
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
        description: (
          <span>
            Estado del item actualizado a{' '}
            <span className="font-bold uppercase">
              {status === "PENDING" ? "Pendiente" :
                status === "IN_PROGRESS" ? "En preparación" :
                  status === "READY" ? "Completado" :
                    status === "CANCELLED" ? "Cancelado" :
                      status}
            </span>
          </span>
        ),
        duration: 3000
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
          duration: 3000
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
          duration: 3000
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
        duration: 3000
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
          duration: 3000
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
          duration: 3000
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
        duration: 3000
      });
    } catch (err: any) {
      console.error('Error starting order:', err);
      toast({
        title: "Error",
        description: "Error al iniciar la orden",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // Join the kitchen-specific channel when socket is connected and user has a locationId
  useEffect(() => {
    if (connected) {
      // Si es SUPER_ADMIN y tiene una ubicación seleccionada que no sea "todas"
      // o si es un usuario normal con ubicación asignada.
      const locationToJoin = (user?.role === 'SUPER_ADMIN' && selectedLocationId !== 'all')
        ? selectedLocationId
        : user?.locationId;

      if (locationToJoin) {
        try {
          console.log(`Trying to join kitchen-${locationToJoin} channel...`);

          // Add a delay to ensure connection is fully established
          setTimeout(() => {
            // Emit event to join the kitchen channel for this location
            const joined = emit('join-kitchen', locationToJoin);
            console.log(`Emit join-kitchen for location: ${locationToJoin}. Success: ${joined}`);
          }, 500);
        } catch (error) {
          console.error("Error joining kitchen channel:", error);
        }
      }
    }
  }, [connected, user, selectedLocationId, emit])

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

      // Play sound alert for new order
      playSound();

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
        if (updatedOrder.items.every(i => i.status === "READY" || i.status === "CANCELLED")) {
          setOrderJustCompleted(order.id)
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
  }, [connected, subscribe, toast, soundEnabled])

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

  // Efecto secundario para mostrar el toast y eliminar la orden después de 5 segundos
  useEffect(() => {
    if (orderJustCompleted) {
      toast({
        title: "Orden Completada",
        description: "La orden se eliminará en 5 segundos",
        duration: 3000
      })
      const timeout = setTimeout(() => {
        setOrders(currentOrders =>
          currentOrders.filter(o => o.id !== orderJustCompleted)
        )
        setOrderJustCompleted(null)
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [orderJustCompleted, toast])

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <Card className="rounded-none sm:rounded-lg">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Órdenes Activas</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {user?.role === 'SUPER_ADMIN' ? (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-medium whitespace-nowrap text-primary">Sede:</span>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Seleccionar sede" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las sedes</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-3 w-3 text-emerald-600" />
                    <span className="font-semibold text-emerald-700 uppercase">
                      {locations.find(l => l.id === user?.locationId)?.name || user?.locationId || 'Sin sede asignada'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {soundEnabled ? "Sonido On" : "Sonido Off"}
              </Button>
              {connectionStatus}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
              {orders.length === 0 ? (
                <div className="text-center text-muted-foreground col-span-full">
                  No hay órdenes activas
                </div>
              ) : (
                orders.map((order) => (
                  <Card key={order.id} className="overflow-hidden border-0 sm:border">
                    <CardContent className="p-0">
                      <div className="bg-muted p-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                          <div>
                            <h3 className="font-bold text-base">
                              {order.type === "DELIVERY" ? (
                                <div>
                                  <span>Domicilio</span>
                                  {order.customerName && (
                                    <p className="text-xs font-medium text-primary">
                                      Cliente: {order.customerName}
                                    </p>
                                  )}
                                </div>
                              ) : order.table?.number ? (
                                `Mesa #${order.table.number}`
                              ) : (
                                'Para Llevar'
                              )}
                            </h3>
                            {order.type !== "DELIVERY" && order.customerName && (
                              <p className="text-xs font-medium text-primary">
                                Cliente: {order.customerName}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Orden #{order.id.substring(0, 8)} - {new Date(order.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintTicket(order.id)}
                              className="h-7 text-xs px-2"
                            >
                              Imprimir Ticket
                            </Button>
                            {order.items.some(item => item.status === "PENDING") && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleStartOrder(order.id, order.items)}
                                className="h-7 text-xs px-2"
                              >
                                Recibido
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-2">
                        <h4 className="font-medium text-sm mb-1">Items:</h4>
                        <ul className="space-y-1">
                          {order.items
                            .filter(item => item.status !== "COMPLETED")
                            .map((item) => (
                              <li key={item.id} className="border-b pb-1">
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1">
                                        <p className="font-medium text-sm">{item.product.name}</p>
                                        {item.productVariant && (
                                          <>
                                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{item.productVariant.name}</span>
                                            {item.productVariant.image && (
                                              <img src={item.productVariant.image} alt={item.productVariant.name} className="w-6 h-6 object-cover rounded" />
                                            )}
                                            {typeof item.productVariant.price === 'number' && !isNaN(item.productVariant.price) && (
                                              <span className="text-xs text-muted-foreground">${item.productVariant.price.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                                            )}
                                          </>
                                        )}
                                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">x{item.quantity}</span>
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        {item.status === "PENDING" ? "Pendiente" :
                                          item.status === "IN_PROGRESS" ? "En preparación" :
                                            item.status === "READY" ? "Completado" :
                                              item.status === "CANCELLED" ? "Cancelado" :
                                                item.status}
                                      </p>
                                      {item.notes && (
                                        <p className="text-xs text-muted-foreground">
                                          Notas: {item.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {item.status === "PENDING" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUpdateItemStatus(item.id, "IN_PROGRESS")}
                                        className="h-7 text-xs px-2"
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
                                          className="h-7 text-xs px-2"
                                        >
                                          Volver a Pendiente
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => handleUpdateItemStatus(item.id, "READY")}
                                          className="h-7 text-xs px-2"
                                        >
                                          Marcar Completado
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => setItemToCancel({ id: item.id, name: item.product.name })}
                                      className="h-7 text-xs px-2"
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