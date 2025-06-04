"use client"

import { useState, useEffect, useRef } from "react"
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
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface WhatsAppChat {
  id: string
  name: string
  lastMessage: string
  timestamp: number | null
  unreadCount: number
}

export default function AIManagerPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (!user.locationId) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "No tienes una ubicación asignada. Por favor, contacta al administrador para que te asigne una ubicación.",
        role: "assistant",
        timestamp: new Date()
      };
      setMessages([errorMessage]);
      return;
    }

    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      query: {
        locationId: user.locationId,
      },
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

    socketInstance.on('whatsapp:status', ({ isConnected }) => {
      setIsWhatsAppConnected(isConnected);
    });

    socketInstance.on('whatsapp:qr', ({ qrCode }) => {
      setQrCode(qrCode);
      setShowQR(true);
    });

    socketInstance.on('whatsapp:ready', () => {
      console.log('WhatsApp is ready, requesting chats...');
      setIsWhatsAppConnected(true);
      setShowQR(false);
      setQrCode(null);
      socketInstance.emit('whatsapp:getChats');
    });

    socketInstance.on('whatsapp:chats', ({ chats }) => {
      console.log('Received WhatsApp chats:', chats);
      if (!chats || chats.length === 0) {
        console.log('No chats received or empty array');
      }
      setWhatsappChats(chats || []);
    });

    socketInstance.on('whatsapp:message', (message) => {
      console.log('Received WhatsApp message:', message);
      setWhatsappChats(prevChats => {
        console.log('Previous chats:', prevChats);
        const updatedChats = prevChats.map(chat => 
          chat.id === message.from 
            ? { ...chat, lastMessage: message.body, timestamp: message.timestamp }
            : chat
        );
        console.log('Updated chats:', updatedChats);
        return updatedChats;
      });

      if (selectedChat === message.from) {
        console.log('Adding message to selected chat:', message);
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: message.body,
          role: "user",
          timestamp: new Date(message.timestamp * 1000)
        }]);
      }
    });

    socketInstance.on('whatsapp:chatMessages', ({ messages }) => {
      console.log('Received chat messages:', messages);
      if (!messages || messages.length === 0) {
        console.log('No messages received or empty array');
      }
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        content: msg.body,
        role: msg.fromMe ? "assistant" : "user",
        timestamp: new Date(msg.timestamp * 1000)
      }));
      console.log('Formatted messages:', formattedMessages);
      setChatMessages(formattedMessages);
      setIsLoadingMessages(false);
    });

    socketInstance.on('whatsapp:error', ({ message }) => {
      console.error('WhatsApp error:', message);
    });

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
      socketInstance.off('whatsapp:status');
      socketInstance.off('whatsapp:qr');
      socketInstance.off('whatsapp:ready');
      socketInstance.off('whatsapp:chats');
      socketInstance.off('whatsapp:message');
      socketInstance.off('whatsapp:chatMessages');
      socketInstance.off('whatsapp:error');
    }
  }, [user, isAuthLoading, router])

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
    inputRef.current?.focus()

    // Send message through WebSocket
    socket.emit('input_text', { text: input })
  }

  const handleWhatsAppConnect = () => {
    if (!socket) return;
    
    if (!isWhatsAppConnected) {
      socket.emit('whatsapp:getQR');
      setShowQR(true);
    } else {
      // Si ya está conectado, podemos mostrar un mensaje o hacer algo más
      console.log('WhatsApp ya está conectado');
    }
  };

  const handleChatSelect = (chatId: string) => {
    console.log('Selecting chat:', chatId);
    setSelectedChat(chatId);
    setChatMessages([]);
    setIsLoadingMessages(true);
    
    if (socket) {
      console.log('Requesting messages for chat:', chatId);
      socket.emit('whatsapp:getChatMessages', { chatId });
    }
  }

  const handleSendWhatsAppMessage = (message: string) => {
    if (!socket || !selectedChat) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: "assistant",
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, newMessage]);
    
    socket.emit('whatsapp:sendMessage', {
      to: selectedChat,
      message
    });
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

      {isAuthLoading ? (
        <div className="text-center">Cargando...</div>
      ) : !user ? (
        <div className="text-center">Redirigiendo al inicio de sesión...</div>
      ) : !user.locationId ? (
        <Card className="p-4">
          <div className="text-center text-red-500">
            <p className="font-medium">No tienes una ubicación asignada</p>
            <p className="text-sm mt-2">Por favor, contacta al administrador para que te asigne una ubicación.</p>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="whatsapp" className="space-y-4">
          <TabsList>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="chat">Chat IA</TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-4 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Chats</h2>
                  </div>

                  {showQR && qrCode && (
                    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
                      <p className="text-sm text-center">Escanea el código QR con WhatsApp</p>
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                    </div>
                  )}

                  <ScrollArea className="h-[600px]">
                    <div className="space-y-2">
                      {whatsappChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => handleChatSelect(chat.id)}
                          className={cn(
                            "p-4 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                            selectedChat === chat.id && "bg-muted"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>{chat.name[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{chat.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {chat.lastMessage}
                                </p>
                              </div>
                            </div>
                            {chat.unreadCount > 0 && (
                              <Badge variant="secondary">{chat.unreadCount}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </Card>

              <Card className="col-span-8 p-4">
                {selectedChat ? (
                  <div className="flex flex-col h-[600px]">
                    <ScrollArea className="flex-1 pr-4">
                      <div className="space-y-4">
                        {isLoadingMessages ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">Cargando mensajes...</p>
                          </div>
                        ) : chatMessages.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">No hay mensajes en este chat</p>
                          </div>
                        ) : (
                          chatMessages.map((message) => (
                            <div
                              key={message.id}
                              className={cn(
                                "flex items-start gap-4",
                                message.role === "assistant" ? "flex-row" : "flex-row-reverse"
                              )}
                            >
                              <Avatar>
                                <AvatarImage
                                  src={message.role === "assistant" ? "/bot-avatar.png" : "/user-avatar.png"}
                                />
                                <AvatarFallback>
                                  {message.role === "assistant" ? "AI" : "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div
                                className={cn(
                                  "rounded-lg p-4 max-w-[80%]",
                                  message.role === "assistant"
                                    ? "bg-muted"
                                    : "bg-primary text-primary-foreground"
                                )}
                              >
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                                <span className="text-xs opacity-70">
                                  {message.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>

                    <div className="mt-4 flex gap-2">
                      <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendWhatsAppMessage(input);
                            setInput("");
                          }
                        }}
                        placeholder="Escribe un mensaje..."
                        className="flex-1"
                      />
                      <Button
                        onClick={() => {
                          handleSendWhatsAppMessage(input);
                          setInput("");
                        }}
                        disabled={!input.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                    Selecciona un chat para comenzar
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

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
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-4" {...props} />,
                              li: ({node, ...props}) => <li className="mb-1" {...props} />
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
                        <AvatarImage src="/bot-avatar.png" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="rounded-lg p-4 bg-muted">
                        <p>Escribiendo...</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4">
                <Input
                  ref={inputRef}
                  placeholder="Escribe tu mensaje..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button onClick={handleSendMessage} disabled={!input.trim() || !isConnected || isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
} 