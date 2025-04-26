"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil } from "lucide-react"
import { getKitchenOrders, updateKitchenOrderItemStatus, printKitchenTicket } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useKitchenSocket } from "@/hooks/use-kitchen-socket"
import { useAuth } from "@/hooks/use-auth"

export function KitchenManager() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { subscribe, connected, socket, emit } = useKitchenSocket()
  const { user } = useAuth()

  useEffect(() => {
    fetchOrders()
    
    // Set up polling as a fallback (every 30 seconds)
    const interval = setInterval(fetchOrders, 15000)
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
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError("Error al cargar las órdenes de cocina. Por favor, asegúrate de estar autenticado.")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateItemStatus = async (itemId: string, status: "PENDING" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED") => {
    try {
      await updateKitchenOrderItemStatus(itemId, status)
      toast({
        title: "Éxito",
        description: `Estado del item actualizado a ${status}`,
      })
      // No es necesario refrescar órdenes inmediatamente porque el socket lo hará
    } catch (err) {
      console.error('Error updating item status:', err)
      toast({
        title: "Error",
        description: "Error al actualizar el estado del item. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  const handlePrintTicket = async (orderId: string) => {
    try {
      await printKitchenTicket(orderId)
      toast({
        title: "Éxito",
        description: "Ticket enviado a la impresora",
      })
    } catch (err) {
      console.error('Error printing ticket:', err)
      toast({
        title: "Error",
        description: "Error al imprimir el ticket. Por favor, asegúrate de estar autenticado.",
        variant: "destructive",
      })
    }
  }

  // Unirse al canal de kitchen cuando el socket esté conectado y el usuario tenga locationId
  useEffect(() => {
    if (connected && user?.locationId) {
      console.log(`Trying to join kitchen-${user.locationId} channel...`)
      // Emitir evento para unirse al canal de la ubicación
      const joined = emit('join-kitchen', user.locationId)
      console.log(`Emit join-kitchen for location: ${user.locationId}. Success: ${joined}`)
    }
  }, [connected, user, emit])

  // Configurar suscripciones a eventos de socket
  useEffect(() => {
    if (!connected) {
      console.log("Socket not connected yet, waiting...")
      return
    }

    console.log("Setting up socket listeners")

    // Evento para cuando se actualiza un item de orden
    const unsubscribeOrderItemUpdated = subscribe('orderItemUpdated', (updatedItem) => {
      console.log("orderItemUpdated event received:", updatedItem)
      
      setOrders(prevOrders => {
        // Actualizar la orden que contiene el item actualizado
        return prevOrders.map(order => {
          if (order.id === updatedItem.order.id) {
            // Reemplazar la orden con la orden actualizada del socket
            return updatedItem.order
          }
          return order
        }).filter(order => 
          order.items.some(item => 
            item.status === "PENDING" || item.status === "IN_PROGRESS"
          )
        )
      })
    })

    // Evento para cuando se actualiza una orden completa
    const unsubscribeOrderUpdated = subscribe('orderUpdated', (updatedOrder) => {
      console.log("orderUpdated event received:", updatedOrder)
      
      setOrders(prevOrders => {
        // Si la orden no tiene items PENDING o IN_PROGRESS, eliminarla
        if (!updatedOrder.items.some(item => 
          item.status === "PENDING" || item.status === "IN_PROGRESS"
        )) {
          return prevOrders.filter(order => order.id !== updatedOrder.id)
        }
        
        // Si la orden ya existe, actualizarla
        if (prevOrders.some(order => order.id === updatedOrder.id)) {
          return prevOrders.map(order => 
            order.id === updatedOrder.id ? updatedOrder : order
          )
        }
        
        // Si es una nueva orden con items pendientes, agregarla
        return [...prevOrders, updatedOrder]
      })
    })

    // Evento para cuando se crea una nueva orden - desde OrderGateway
    const unsubscribeOrderCreated = subscribe('order-updated', (newOrder) => {
      console.log("order-updated (new order) event received:", newOrder)
      
      // Verificar si la orden tiene items pendientes o en progreso
      if (newOrder.items && newOrder.items.some(item => 
        item.status === "PENDING" || item.status === "IN_PROGRESS"
      )) {
        setOrders(prevOrders => {
          // Verificar si la orden ya existe
          if (prevOrders.some(order => order.id === newOrder.id)) {
            // Actualizar la orden existente
            return prevOrders.map(order => 
              order.id === newOrder.id ? newOrder : order
            )
          }
          // Agregar la nueva orden
          return [...prevOrders, newOrder]
        })
      }
    })

    // Limpiar suscripciones cuando el componente se desmonte
    return () => {
      unsubscribeOrderItemUpdated()
      unsubscribeOrderUpdated()
      unsubscribeOrderCreated()
    }
  }, [connected, subscribe])

  // Mostrar un indicador de estado de conexión
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
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePrintTicket(order.id)}
                          >
                            Imprimir Ticket
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <h4 className="font-medium mb-2">Items:</h4>
                        <ul className="space-y-4">
                          {order.items
                            .filter(item => item.status === "PENDING" || item.status === "IN_PROGRESS")
                            .map((item) => (
                              <li key={item.id} className="border-b pb-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium">{item.product.name}</p>
                                    <p className="text-sm text-gray-500">
                                      {item.status === "PENDING" ? "Pendiente" : "En preparación"}
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    {item.status === "PENDING" && (
                                      <Button 
                                        size="sm" 
                                        onClick={() => handleUpdateItemStatus(item.id, "IN_PROGRESS")}
                                      >
                                        Iniciar
                                      </Button>
                                    )}
                                    {item.status === "IN_PROGRESS" && (
                                      <Button 
                                        size="sm" 
                                        onClick={() => handleUpdateItemStatus(item.id, "READY")}
                                      >
                                        Completar
                                      </Button>
                                    )}
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
    </div>
  )
} 