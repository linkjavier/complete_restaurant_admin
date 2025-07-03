import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { API_URL } from '@/lib/api';

interface UseOrderSocketReturn {
  socket: Socket | null;
  connected: boolean;
  subscribe: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => boolean;
}

export function useOrderSocket(): UseOrderSocketReturn {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 2000;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || API_URL;

    const initSocket = () => {
      console.log('Initializing orders socket connection to', SOCKET_URL);

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found, socket operations may fail');
      }

      localStorage.setItem('debug', 'socket.io-client:*');

      console.log(`Connecting to Socket.IO namespace: ${SOCKET_URL}/orders`);
      
      const socket = io(`${SOCKET_URL}/orders`, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        autoConnect: true,
        auth: {
          token
        },
        extraHeaders: {
          Authorization: token ? `Bearer ${token}` : '',
        }
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Orders socket connected!', socket.id);
        setConnected(true);
        reconnectAttemptsRef.current = 0;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        socket.emit('ping', null, (response: any) => {
          console.log('Received ping acknowledgment from server:', response);
        });
      });

      socket.onAny((eventName, ...args) => {
        console.log(`🔔 RECEIVED ORDER EVENT: ${eventName}`, args);
      });

      socket.on('connect_error', (error) => {
        console.error('Orders socket connection error:', error.message);
        scheduleReconnect();
      });

      socket.on('disconnect', (reason) => {
        console.log('Orders socket disconnected:', reason);
        setConnected(false);

        if (reason === 'io server disconnect' || reason === 'transport close') {
          scheduleReconnect();
        }
      });

      socket.io.on('reconnect', (attempt) => {
        console.log(`Orders socket reconnected on attempt ${attempt}`);
      });

      socket.io.on('reconnect_attempt', (attempt) => {
        console.log(`Orders socket reconnect attempt ${attempt}`);
      });

      socket.io.on('reconnect_error', (error) => {
        console.error('Orders socket reconnect error:', error);
      });

      socket.io.on('reconnect_failed', () => {
        console.error('Orders socket reconnection failed after all attempts');
      });

      socket.on('error', (error) => {
        console.error('Orders socket error:', error);
        scheduleReconnect();
      });

      return socket;
    };

    const scheduleReconnect = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log('Max reconnect attempts reached');
        toast({
          title: "Error de conexión",
          description: "No se pudo establecer conexión con el servidor. Los datos no se actualizarán en tiempo real.",
          variant: "destructive",
        });
        return;
      }

      const delay = baseReconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current);
      console.log(`Scheduling orders socket reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Attempting to reconnect orders socket (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`);
        reconnectAttemptsRef.current++;
        initSocket();
      }, delay);
    };

    const socket = initSocket();

    return () => {
      console.log('Cleaning up orders socket connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners();
          if (socketRef.current.connected) {
            socketRef.current.disconnect();
          }
          socketRef.current = null;
        } catch (error) {
          console.error('Error during orders socket cleanup:', error);
        }
      }
    };
  }, []);

  const subscribe = useCallback((event: string, callback: (...args: any[]) => void): (() => void) => {
    if (!subscribersRef.current.has(event)) {
      subscribersRef.current.set(event, new Set());
    }

    const subscribers = subscribersRef.current.get(event)!;
    subscribers.add(callback);

    if (subscribers.size === 1 && socketRef.current) {
      console.log(`Setting up listener for orders ${event} event`);

      socketRef.current.on(event, (...args: any[]) => {
        console.log(`Received orders ${event} event:`, args.length > 0 ? JSON.stringify(args[0]).substring(0, 200) + '...' : 'no data');

        subscribers.forEach(cb => {
          try {
            cb(...args);
          } catch (error) {
            console.error(`Error in orders ${event} event handler:`, error);
          }
        });
      });
    }

    return () => {
      console.log(`Unsubscribing from orders ${event} event`);
      const subscribers = subscribersRef.current.get(event);
      if (subscribers) {
        subscribers.delete(callback);

        if (subscribers.size === 0 && socketRef.current) {
          console.log(`Removing listener for orders ${event} event - no more subscribers`);
          socketRef.current.off(event);
          subscribersRef.current.delete(event);
        }
      }
    };
  }, []);

  const emit = useCallback((event: string, ...args: any[]): boolean => {
    if (socketRef.current && connected) {
      console.log(`Emitting orders ${event} event:`, args);
      socketRef.current.emit(event, ...args);
      return true;
    }
    console.warn(`Cannot emit orders ${event} event: socket not connected`);
    return false;
  }, [connected]);

  return {
    socket: socketRef.current,
    connected,
    subscribe,
    emit,
  };
}