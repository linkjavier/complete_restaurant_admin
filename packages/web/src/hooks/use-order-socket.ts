import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth';

export function useOrderSocket(locationId?: string, tableId?: string) {
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      auth: {
        token: getAuthToken(),
      },
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      
      if (locationId) {
        socket.emit('join-kitchen', locationId);
      }
      
      if (tableId) {
        socket.emit('join-table', tableId);
      }
    });

    socket.on('order-updated', (order) => {
      queryClient.setQueryData(['orders', order.id], order);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    socket.on('item-status-updated', ({ orderId, itemId, status }) => {
      queryClient.setQueryData(['orders', orderId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item: any) =>
            item.id === itemId ? { ...item, status } : item,
          ),
        };
      });
    });

    return socket;
  }, [locationId, tableId, queryClient]);

  useEffect(() => {
    const socket = connect();

    return () => {
      socket.disconnect();
    };
  }, [connect]);
} 