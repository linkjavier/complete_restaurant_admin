"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { getKitchenOrders, updateKitchenOrderItemStatus, printKitchenTicket } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Printer, AlertTriangle } from "lucide-react"
import { useKitchenSocket } from "@/hooks/use-kitchen-socket"

// Debug component to help troubleshoot WebSocket issues
function WebSocketDebugPanel({ connected, events }: { connected: boolean; events: any[] }) {
  const [expanded, setExpanded] = useState(true); // Start expanded by default

  return (
    <div className="mb-4 p-2 bg-gray-100 border rounded-md">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
          <span className="text-sm font-medium">WebSocket Debug</span>
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {connected ? "Connected" : "Disconnected"}
          </span>
          {events.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              {`Last event: ${new Date(events[0]?.time).toLocaleTimeString()}`}
            </span>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : 'Show'} Details
        </Button>
      </div>
      
      {expanded && (
        <div className="mt-2">
          <div className="text-xs mb-1 flex justify-between">
            <span>
              Status: <span className={connected ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </span>
            <span className="text-xs text-gray-500">
              {events.length === 0 ? (
                <span className="text-amber-500">No events recorded yet</span>
              ) : (
                `Events recorded: ${events.length}`
              )}
            </span>
          </div>
          
          <div className="bg-gray-800 text-gray-200 p-2 rounded max-h-60 overflow-y-auto text-xs font-mono">
            {events.length === 0 ? (
              <div className="py-2 text-center text-amber-300">Waiting for WebSocket events...</div>
            ) : (
              events.map((event, i) => (
                <div key={i} className={`mb-1 ${i === 0 ? 'border-l-2 border-yellow-400 pl-2' : ''}`}>
                  <span className="text-blue-400">[{new Date(event.time).toLocaleTimeString()}]</span>
                  <span className={`${
                    event.type === 'EVENT' ? 'text-green-400' : 
                    event.type === 'ERROR' ? 'text-red-400' : 
                    event.type === 'TEST' ? 'text-purple-400' : 
                    event.type === 'JOIN' ? 'text-yellow-400' :
                    event.type === 'CONNECTION' ? 'text-cyan-400' :
                    'text-gray-400'
                  } font-medium`}> {event.type}</span>: {event.data}
                  {i === 0 && <span className="ml-2 text-yellow-400 text-xs"> ← LATEST</span>}
                </div>
              ))
            )}
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            WebSocket events will appear here in real-time. If you're not seeing order updates, check your connection.
          </div>
        </div>
      )}
    </div>
  );
}

interface KitchenViewProps {
  locationId: string
}

export function KitchenView({ locationId }: KitchenViewProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { subscribe, connected, emit } = useKitchenSocket()
  const [wsEvents, setWsEvents] = useState<Array<{type: string; data: string; time: Date}>>([]);

  // Helper to log WebSocket events
  const logWsEvent = (type: string, data: any) => {
    setWsEvents(prev => {
      const newEvents = [
        { type, data: typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : String(data), time: new Date() },
        ...prev
      ];
      // Keep only the last 10 events
      return newEvents.slice(0, 10);
    });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const data = await getKitchenOrders()
      logWsEvent('API', `Fetched ${data.length} orders via REST API`);
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
      logWsEvent('STATUS_UPDATE', `Updated item ${itemId} to ${status}`);
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
      logWsEvent('PRINT', `Printed ticket for order ${orderId}`);
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
    if (!connected) {
      logWsEvent('CONNECTION', 'Socket not connected yet, waiting...');
      console.log('Socket not connected yet, waiting...');
      return;
    }

    logWsEvent('CONNECTION', `Socket connected, joining kitchen for location: ${locationId}`);
    console.log('Socket connected, joining kitchen for location:', locationId);
    
    if (locationId) {
      // Explicitly emit join-kitchen event to the socket
      emit('join-kitchen', locationId);
      logWsEvent('JOIN', `Emitted join-kitchen event with locationId: ${locationId}`);
      console.log('Emitted join-kitchen event with locationId:', locationId);
      
      // Subscribe to events
      const unsubscribeOrderItemUpdated = subscribe('order_item_updated', (updatedItem) => {
        logWsEvent('EVENT', `Received order_item_updated event for order ${updatedItem?.order?.id || 'unknown'}`);
        console.log('order_item_updated event received:', updatedItem);
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

      const unsubscribeOrderUpdated = subscribe('order_updated', (updatedOrder) => {
        logWsEvent('EVENT', `Received order_updated event for order ${updatedOrder?.id || 'unknown'}`);
        console.log('order_updated event received:', updatedOrder);
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

      const unsubscribeNewOrder = subscribe('new_order_created', (newOrderData) => {
        // Handle various formats the data might come in
        let newOrder = newOrderData;
        
        // Handle array-wrapped data (Socket.io can sometimes wrap data in an array)
        if (Array.isArray(newOrderData)) {
          console.log('🔄 new_order_created data is an array, unwrapping first element');
          newOrder = newOrderData[0];
        }
        
        logWsEvent('EVENT', `Received new_order_created event for order ${newOrder?.id || 'unknown'}`);
        console.log('new_order_created event received:', newOrder);
        
        if (!newOrder) {
          console.warn('Received invalid order data:', newOrderData);
          return;
        }
        
        // Add the new order to the list if it has PENDING or IN_PROGRESS items
        setOrders(prevOrders => {
          // Skip if already in the list
          if (prevOrders.some(order => order.id === newOrder.id)) {
            console.log(`Order ${newOrder.id} already in the list, skipping`);
            return prevOrders;
          }
          
          // Skip if no items or no pending/in-progress items
          if (!newOrder.items || !Array.isArray(newOrder.items)) {
            console.warn(`Order ${newOrder.id} has no items array, skipping`);
            return prevOrders;
          }
          
          if (!newOrder.items.some(item => 
            item.status === "PENDING" || item.status === "IN_PROGRESS"
          )) {
            console.log(`Order ${newOrder.id} has no PENDING or IN_PROGRESS items, skipping`);
            return prevOrders;
          }
          
          // Show notification toast
          toast({
            title: "Nueva Orden",
            description: `Mesa #${newOrder.table?.number} - ${newOrder.items.length} productos`
          });
          
          // Add to beginning of list
          console.log(`Adding new order ${newOrder.id} to the list`);
          return [newOrder, ...prevOrders];
        });
      });

      // Subscribe to test broadcasts
      const unsubscribeTestBroadcast = subscribe('test_broadcast', (data) => {
        console.log('⭐ TEST BROADCAST RECEIVED:', data);
        logWsEvent('TEST', `Received test broadcast: ${JSON.stringify(data)}`);
        toast({
          title: "Test Broadcast",
          description: "Received test broadcast from server",
        });
      });
      
      const unsubscribeTestRoomBroadcast = subscribe('test_room_broadcast', (data) => {
        console.log('⭐ TEST ROOM BROADCAST RECEIVED:', data);
        logWsEvent('TEST_ROOM', `Received test room broadcast: ${JSON.stringify(data)}`);
        toast({
          title: "Test Room Broadcast",
          description: `Room broadcast for order: ${data?.orderId || 'unknown'}`,
        });
      });

      // Subscribe to pong responses for debug
      const unsubscribePong = subscribe('pong', (data) => {
        logWsEvent('PONG', `Received pong response: ${JSON.stringify(data)}`);
        console.log('pong response received:', data);
      });

      // Test ping after joining
      setTimeout(() => {
        emit('ping', { test: true });
        logWsEvent('PING', 'Sent test ping to server');
      }, 1000);

      return () => {
        unsubscribeOrderItemUpdated();
        unsubscribeOrderUpdated();
        unsubscribeNewOrder();
        unsubscribeTestBroadcast();
        unsubscribeTestRoomBroadcast();
        unsubscribePong();
      };
    }
  }, [subscribe, locationId, connected, emit, toast]);

  // Add a manual test function
  const testSocketConnection = () => {
    if (!connected) {
      logWsEvent('TEST', 'Socket not connected, cannot test');
      toast({
        title: "Not Connected",
        description: "Socket is not connected, cannot test",
        variant: "destructive"
      });
      return;
    }
    
    try {
      emit('ping', { manual: true, time: new Date().toISOString() });
      logWsEvent('TEST', 'Sent manual ping to server');
      
      toast({
        title: "Test Sent",
        description: "Manual ping test sent to server",
      });
    } catch (error) {
      console.error('Error testing socket:', error);
      logWsEvent('ERROR', `Error testing socket: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <WebSocketDebugPanel connected={connected} events={wsEvents} />
        <div className="flex justify-center p-6">
          <div className="text-center">
            <div className="mb-4">Loading orders...</div>
            <Button onClick={testSocketConnection}>Test Socket</Button>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <WebSocketDebugPanel connected={connected} events={wsEvents} />
        <div className="flex justify-center p-6">No pending orders at this time</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <WebSocketDebugPanel connected={connected} events={wsEvents} />
      
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
    </div>
  )
} 