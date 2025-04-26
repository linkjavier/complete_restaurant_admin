"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { getKitchenOrders, updateKitchenOrderItemStatus, printKitchenTicket } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { useKitchenSocket } from "@/hooks/use-kitchen-socket"

interface KitchenViewProps {
  locationId: string
}

export function KitchenView({ locationId }: KitchenViewProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { subscribe, connected } = useKitchenSocket()

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const data = await getKitchenOrders()
      // Filter orders that have items with status PENDING or IN_PROGRESS
      const activeOrders = data.filter(order => 
        order.items.some(item => 
          item.status === "PENDING" || item.status === "IN_PROGRESS"
        )
      )
      setOrders(activeOrders)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateItemStatus = async (itemId: string, status: "PENDING" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED") => {
    try {
      await updateKitchenOrderItemStatus(itemId, status)
      toast({
        title: "Success",
        description: `Item status updated to ${status}`,
      })
      // Orders will be updated via socket
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item status",
        variant: "destructive",
      })
    }
  }

  const handlePrintTicket = async (orderId: string) => {
    try {
      await printKitchenTicket(orderId)
      toast({
        title: "Success",
        description: "Ticket sent to printer",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to print ticket",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchOrders()
    
    // Set up polling as a fallback - reduced frequency since we have sockets
    const interval = setInterval(fetchOrders, 60000)
    return () => clearInterval(interval)
  }, [locationId])

  // Set up socket listeners
  useEffect(() => {
    const unsubscribeOrderItemUpdated = subscribe('orderItemUpdated', (updatedItem) => {
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === updatedItem.order.id) {
            // Replace the order with the updated order from the socket
            return updatedItem.order;
          }
          return order;
        }).filter(order => 
          order.items.some(item => 
            item.status === "PENDING" || item.status === "IN_PROGRESS"
          )
        );
      });
    });

    const unsubscribeOrderUpdated = subscribe('orderUpdated', (updatedOrder) => {
      setOrders(prevOrders => {
        // If the order doesn't have any PENDING or IN_PROGRESS items, filter it out
        if (!updatedOrder.items.some(item => 
          item.status === "PENDING" || item.status === "IN_PROGRESS"
        )) {
          return prevOrders.filter(order => order.id !== updatedOrder.id);
        }
        
        // Otherwise, update it
        return prevOrders.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        );
      });
    });

    return () => {
      unsubscribeOrderItemUpdated();
      unsubscribeOrderUpdated();
    };
  }, [subscribe]);

  if (loading) {
    return <div className="flex justify-center p-6">Loading orders...</div>
  }

  if (orders.length === 0) {
    return <div className="flex justify-center p-6">No pending orders at this time</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {!connected && (
        <div className="col-span-full mb-4 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm text-center">
          Offline mode - real-time updates not available
        </div>
      )}
      {orders.map((order) => (
        <Card key={order.id} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-primary p-3 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold">Order #{order.id.substring(0, 8)}</h3>
                <p className="text-white text-sm">Table: {order.table?.number || "N/A"}</p>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-white text-primary hover:bg-gray-100"
                onClick={() => handlePrintTicket(order.id)}
              >
                <Printer className="h-4 w-4" />
              </Button>
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
                          <p className="text-sm text-gray-500">Status: {item.status}</p>
                        </div>
                        <div className="flex space-x-2">
                          {item.status === "PENDING" && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateItemStatus(item.id, "IN_PROGRESS")}
                            >
                              Start
                            </Button>
                          )}
                          {item.status === "IN_PROGRESS" && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateItemStatus(item.id, "READY")}
                            >
                              Complete
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
      ))}
    </div>
  )
} 