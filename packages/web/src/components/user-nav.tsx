"use client"

import { Bell, Brain, Send } from "lucide-react"
import { UserMenu } from "./user-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { io, Socket } from "socket.io-client"
import { cn } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function UserNav() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [mainSocket, setMainSocket] = useState<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!user?.locationId) return

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      query: {
        locationId: user.locationId,
        chatType: 'admin',
        chatId: 'admin-chat',
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    })

    socketInstance.on('connect', () => {
      console.log('Connected to Admin Assistant WebSocket')
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from Admin Assistant WebSocket')
      setIsConnected(false)
    })

    socketInstance.on('ai_response', ({ content }) => {
      console.log('Received Admin Assistant response:', content)
      const newMessage: Message = {
        id: Date.now().toString(),
        content,
        role: "assistant",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, newMessage])
      setIsLoading(false)
    })

    socketInstance.on('error', ({ message, details }) => {
      console.error('Socket error:', message, details)
      setIsLoading(false)
    })

    setMainSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [user])

  const handleSendMessage = () => {
    if (!input.trim() || !mainSocket || !isConnected || isLoading) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInput("")
    setIsLoading(true)
    inputRef.current?.focus()

    mainSocket.emit('input_text', { text: input })
  }

  return (
    <div className="flex items-center gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Brain className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Asistente Administrativo</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={`${message.role === "assistant" ? 'ai' : 'user'}_${message.id}`}
                  className={cn(
                    "flex items-start gap-4",
                    message.role === "assistant" ? "flex-row" : "flex-row-reverse"
                  )}
                >
                  <Avatar>
                    <AvatarImage 
                      src={message.role === "assistant" 
                        ? "/admin-bot-avatar.png" 
                        : user?.avatar || "/user-avatar.png"} 
                    />
                    <AvatarFallback>{message.role === "assistant" ? "AI" : "U"}</AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "rounded-lg p-4 max-w-[80%]",
                    message.role === "assistant" ? "bg-muted" : "bg-primary text-primary-foreground"
                  )}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-md font-semibold mt-3 mb-1" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                          table: ({node, ...props}) => <table className="border-collapse border border-gray-300 my-4" {...props} />,
                          th: ({node, ...props}) => <th className="border border-gray-300 px-4 py-2 bg-gray-100" {...props} />,
                          td: ({node, ...props}) => <td className="border border-gray-300 px-4 py-2" {...props} />
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarImage src="/admin-bot-avatar.png" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-4 bg-muted">
                    <p>Analizando...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <div className="flex-none p-4 flex gap-2 border-t">
            <Input
              ref={inputRef}
              placeholder="Consulta reportes, métricas o análisis..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!input.trim() || !isConnected || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificaciones</DialogTitle>
          </DialogHeader>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No hay notificaciones
          </div>
        </DialogContent>
      </Dialog>
      <UserMenu />
    </div>
  )
}