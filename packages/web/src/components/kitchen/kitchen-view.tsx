import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getOrders } from '@/lib/api';
import { useOrderSocket } from '@/hooks/use-order-socket';
import { updateOrderItemStatus } from '@/lib/api';

export function KitchenView({ locationId }: { locationId: string }) {
  useOrderSocket(locationId);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', locationId],
    queryFn: () => getOrders(locationId),
  });

  const handleStatusUpdate = async (orderId: string, itemId: string, status: 'IN_PROGRESS' | 'READY') => {
    await updateOrderItemStatus(orderId, itemId, status);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid gap-4 p-4">
      {orders?.map((order) => (
        <Card key={order.id}>
          <CardHeader>
            <CardTitle>Order #{order.id.slice(0, 8)} - Table {order.table.number}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <h4 className="font-medium">{item.product.name}</h4>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdate(order.id, item.id, 'IN_PROGRESS')}
                      >
                        Start
                      </Button>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <Button
                        variant="default"
                        onClick={() => handleStatusUpdate(order.id, item.id, 'READY')}
                      >
                        Ready
                      </Button>
                    )}
                    {item.status === 'READY' && (
                      <span className="px-2 py-1 text-sm font-medium text-green-600 bg-green-100 rounded">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 