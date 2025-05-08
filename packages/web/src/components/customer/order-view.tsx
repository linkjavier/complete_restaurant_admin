import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrders } from '@/lib/api';
import { useOrderSocket } from '@/hooks/use-order-socket';

export function OrderView({ tableId }: { tableId: string }) {
  useOrderSocket();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', 'table', tableId],
    queryFn: () => getOrders(),
  });

  const tableOrders = orders?.filter((order) => order.tableId === tableId);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!tableOrders?.length) {
    return <div>No orders found for this table</div>;
  }

  return (
    <div className="grid gap-4 p-4">
      {tableOrders.map((order) => (
        <Card key={order.id}>
          <CardHeader>
            <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <h4 className="font-medium">{item.product.name}</h4>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  </div>
                  <div>
                    {item.status === 'PENDING' && (
                      <span className="px-2 py-1 text-sm font-medium text-yellow-600 bg-yellow-100 rounded">
                        Pending
                      </span>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <span className="px-2 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded">
                        In Progress
                      </span>
                    )}
                    {item.status === 'READY' && (
                      <span className="px-2 py-1 text-sm font-medium text-green-600 bg-green-100 rounded">
                        Ready
                      </span>
                    )}
                    {item.status === 'DELIVERED' && (
                      <span className="px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded">
                        Delivered
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