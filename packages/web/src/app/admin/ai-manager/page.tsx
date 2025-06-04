"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, QrCode, Users, Bot, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { io, Socket } from "socket.io-client"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface WhatsAppChat {
  id: string
  phoneNumber: string
  name: string
  lastMessage: string
  unread: number
  status: "online" | "offline" | "away"
}

export default function AIManagerPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Mock WhatsApp chats
  const [whatsappChats] = useState<WhatsAppChat[]>([
    {
      id: "1",
      phoneNumber: "+1234567890",
      name: "Juan Pérez",
      lastMessage: "Quisiera hacer un pedido",
      unread: 2,
      status: "online"
    },
    {
      id: "2",
      phoneNumber: "+0987654321",
      name: "María García",
      lastMessage: "¿Tienen delivery?",
      unread: 0,
      status: "away"
    }
  ])

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
    })

    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket')
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket')
      setIsConnected(false)
    })

    socketInstance.on('ai_response', (response) => {
      const aiMessage: Message = {
        id: Date.now().toString(),
        content: response.content,
        role: "assistant",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
      setIsLoading(false)
    })

    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.",
        role: "assistant",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const handleSendMessage = () => {
    if (!input.trim() || !socket || !isConnected || isLoading) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date()
    }

    setMessages([...messages, newMessage])
    setInput("")
    setIsLoading(true)

    // Send message through WebSocket
    socket.emit('input_text', { text: input })
  }

  const handleWhatsAppConnect = () => {
    setShowQR(true)
    // Simulate connection after 3 seconds
    setTimeout(() => {
      setIsWhatsAppConnected(true)
      setShowQR(false)
    }, 3000)
  }

  return (
    <div className="h-full p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inteligencia Artificial</h1>
        <div className="flex items-center gap-4">
          <Button
            variant={isWhatsAppConnected ? "default" : "outline"}
            onClick={handleWhatsAppConnect}
            className="flex items-center gap-2"
          >
            <Phone className="h-4 w-4" />
            {isWhatsAppConnected ? "WhatsApp Conectado" : "Conectar WhatsApp"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="chat">Chat IA</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <Card className="p-4">
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex items-start gap-4",
                      message.role === "assistant" ? "flex-row" : "flex-row-reverse"
                    )}
                  >
                    <Avatar>
                      <AvatarImage src={message.role === "assistant" ? "/bot-avatar.png" : "/user-avatar.png"} />
                      <AvatarFallback>{message.role === "assistant" ? "AI" : "U"}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "rounded-lg p-4 max-w-[80%]",
                      message.role === "assistant" ? "bg-muted" : "bg-primary text-primary-foreground"
                    )}>
                      <p>{message.content}</p>
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarImage src="/bot-avatar.png" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg p-4 bg-muted">
                      <p>Escribiendo...</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex gap-2 mt-4">
              <Input
                placeholder="Escribe tu mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isLoading || !isConnected}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={isLoading || !isConnected}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          {showQR ? (
            <Card className="p-8 flex flex-col items-center justify-center space-y-4">
              <QrCode className="h-32 w-32" />
              <p>Escanea el código QR con WhatsApp para conectar</p>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Chats de WhatsApp</h2>
                <Button className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Mensaje Masivo
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {whatsappChats.map((chat) => (
                  <Card key={chat.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{chat.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{chat.name}</p>
                          <p className="text-sm text-muted-foreground">{chat.phoneNumber}</p>
                        </div>
                      </div>
                      <Badge variant={chat.status === "online" ? "default" : "secondary"}>
                        {chat.status}
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">{chat.lastMessage}</p>
                      {chat.unread > 0 && (
                        <Badge variant="destructive" className="mt-2">
                          {chat.unread} mensajes nuevos
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ver Chat
                      </Button>
                      <Button className="flex-1">
                        <Bot className="h-4 w-4 mr-2" />
                        Asistente IA
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 