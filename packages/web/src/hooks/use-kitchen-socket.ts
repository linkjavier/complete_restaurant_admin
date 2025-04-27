"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useToast } from '@/components/ui/use-toast'

interface UseKitchenSocketReturn {
  socket: Socket | null;
  connected: boolean;
  subscribe: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => boolean;
}

export function useKitchenSocket(): UseKitchenSocketReturn {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const subscribersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 2000 // 2 seconds
  const { toast } = useToast()

  // Initialize socket connection
  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    
    const initSocket = () => {
      console.log('Initializing socket connection to', SOCKET_URL)
      
      // Clean up any existing socket
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      
      // Get authentication token - use consistent token key
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No authentication token found, socket operations may fail');
      }
      
      // Enable detailed debug logs
      localStorage.setItem('debug', 'socket.io-client:*');
      
      // Create new socket connection - explicitly target the /orders namespace
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
          token: token
        },
        extraHeaders: {
          Authorization: token ? `Bearer ${token}` : '',
        }
      })
      
      socketRef.current = socket
      
      // Setup socket event handlers
      socket.on('connect', () => {
        console.log('Socket connected to orders namespace!', socket.id);
        console.log('Socket connected:', {
          id: socket.id,
          connected: socket.connected,
          disconnected: socket.disconnected
        });
        setConnected(true)
        reconnectAttemptsRef.current = 0
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        
        // Verify connection by requesting an acknowledgment from the server
        socket.emit('ping', null, (response: any) => {
          console.log('Received ping acknowledgment from server:', response);
        });
      })
      
      // Debug: Listen for ANY event for debugging
      socket.onAny((eventName, ...args) => {
        console.log(`🔔 RECEIVED EVENT: ${eventName}`, args);
      });
      
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        scheduleReconnect()
      })
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
        setConnected(false)
        
        // Handle reconnection for certain disconnect reasons
        if (reason === 'io server disconnect' || reason === 'transport close') {
          scheduleReconnect()
        }
      })
      
      socket.io.on('reconnect', (attempt) => {
        console.log(`Socket reconnected on attempt ${attempt}`);
      });

      socket.io.on('reconnect_attempt', (attempt) => {
        console.log(`Socket reconnect attempt ${attempt}`);
      });

      socket.io.on('reconnect_error', (error) => {
        console.error('Socket reconnect error:', error);
      });

      socket.io.on('reconnect_failed', () => {
        console.error('Socket reconnection failed after all attempts');
      });
      
      socket.on('error', (error) => {
        console.error('Socket error:', error)
        scheduleReconnect()
      })
      
      return socket
    }
    
    const scheduleReconnect = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log('Max reconnect attempts reached')
        toast({
          title: "Error de conexión",
          description: "No se pudo establecer conexión con el servidor. Los datos no se actualizarán en tiempo real.",
          variant: "destructive",
        });
        return
      }
      
      const delay = baseReconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current)
      console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`)
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`)
        reconnectAttemptsRef.current++
        initSocket()
      }, delay)
    }
    
    const socket = initSocket()
    
    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection')
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      if (socketRef.current) {
        try {
          // First remove all listeners to avoid callbacks
          socketRef.current.removeAllListeners()
          
          // Then disconnect the socket
          if (socketRef.current.connected) {
            socketRef.current.disconnect()
          }
          
          // Set to null to avoid any further operations
          socketRef.current = null
        } catch (error) {
          console.error('Error during socket cleanup:', error)
        }
      }
    }
  }, [])
  
  // Subscribe to socket events
  const subscribe = useCallback((event: string, callback: (...args: any[]) => void): (() => void) => {
    if (!subscribersRef.current.has(event)) {
      subscribersRef.current.set(event, new Set())
    }
    
    const subscribers = subscribersRef.current.get(event)!
    subscribers.add(callback)
    
    // Set up the socket listener if this is the first subscriber
    if (subscribers.size === 1 && socketRef.current) {
      console.log(`Setting up listener for ${event} event`)
      
      socketRef.current.on(event, (...args: any[]) => {
        console.log(`Received ${event} event with ${args.length} arguments:`, 
          args.length > 0 ? JSON.stringify(args[0]).substring(0, 200) + '...' : 'no data')
        
        // Call all subscribers with the event data
        subscribers.forEach(cb => {
          try {
            cb(...args)
          } catch (error) {
            console.error(`Error in ${event} event handler:`, error)
          }
        })
      })
    }
    
    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribing from ${event} event`)
      const subscribers = subscribersRef.current.get(event)
      if (subscribers) {
        subscribers.delete(callback)
        
        // Remove the socket listener if there are no more subscribers
        if (subscribers.size === 0 && socketRef.current) {
          console.log(`Removing listener for ${event} event - no more subscribers`)
          socketRef.current.off(event)
          subscribersRef.current.delete(event)
        }
      }
    }
  }, [])
  
  // Emit events to the server
  const emit = useCallback((event: string, ...args: any[]): boolean => {
    if (socketRef.current && connected) {
      console.log(`Emitting ${event} event:`, args)
      socketRef.current.emit(event, ...args)
      return true
    }
    console.warn(`Cannot emit ${event} event: socket not connected`)
    return false
  }, [connected])
  
  return {
    socket: socketRef.current,
    connected,
    subscribe,
    emit,
  }
} 