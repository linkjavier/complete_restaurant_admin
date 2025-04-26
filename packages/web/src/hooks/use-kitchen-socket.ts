"use client"

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useToast } from '@/components/ui/use-toast'

export function useKitchenSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Connect to the kitchen namespace
    const socketInstance = io(`${process.env.NEXT_PUBLIC_API_URL}/kitchen`, {
      transports: ['websocket'],
      autoConnect: true,
      withCredentials: true,
    })

    // Event handlers
    socketInstance.on('connect', () => {
      setConnected(true)
      console.log('Connected to kitchen socket')
    })

    socketInstance.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from kitchen socket')
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to kitchen updates',
        variant: 'destructive',
      })
    })

    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const subscribe = (
    event: string,
    callback: (data: any) => void
  ) => {
    if (!socket) return () => {}

    socket.on(event, callback)
    return () => {
      socket.off(event, callback)
    }
  }

  const emit = (
    event: string,
    data: any
  ) => {
    if (!socket || !connected) return false
    socket.emit(event, data)
    return true
  }

  return {
    socket,
    connected,
    subscribe,
    emit
  }
} 