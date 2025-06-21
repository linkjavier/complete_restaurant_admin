"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, QrCode, Users, Bot, Phone, Mic, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { io, Socket } from "socket.io-client"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  fromMe?: boolean
}

interface WhatsAppChat {
  id: string
  name: string
  lastMessage: string
  timestamp: number | null
  unreadCount: number
  aiEnabled?: boolean
}

export default function AIManagerPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)
  const selectedChatRef = useRef<string | null>(null);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [mainSocket, setMainSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [showChatView, setShowChatView] = useState(false)
  const [activeTab, setActiveTab] = useState("whatsapp")
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const scrollChatToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    scrollChatToBottom()
  }, [chatMessages, showChatView])

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

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

    // Initialize main socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      query: {
        locationId: user.locationId,
        chatType: 'ai',
        chatId: 'admin-chat',
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    let reconnectTimer: NodeJS.Timeout;
    let statusCheckTimer: NodeJS.Timeout;
    let initialConnectionAttempted = false;

    socketInstance.on('connect', () => {
      console.log('Connected to main WebSocket');
      setIsConnected(true);
      setIsLoadingChats(true);
      
      if (!initialConnectionAttempted) {
        console.log('Initial connection, requesting WhatsApp status...');
        socketInstance.emit('whatsapp:getStatus');
        initialConnectionAttempted = true;
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
      setIsLoadingChats(true);
      
      // Intentar reconectar después de un tiempo
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...');
        socketInstance.connect();
      }, 5000);
    });

    socketInstance.on('reconnect', () => {
      console.log('Reconnected to WebSocket');
      setIsConnected(true);
      setIsLoadingChats(true);
      // Solicitar estado de WhatsApp al reconectarse
      socketInstance.emit('whatsapp:getStatus');
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
    });

    socketInstance.on('ai_response', ({ content }) => {
      console.log('Received AI response:', content);
      const newMessage: Message = {
        id: Date.now().toString(),
        content,
        role: "assistant",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
      setIsLoading(false);
    });

    socketInstance.on('error', ({ message, details }) => {
      console.error('Socket error:', message, details);
      setIsLoading(false);
      toast.error(message || 'Error en la conexión');
    });

    socketInstance.on('whatsapp:status', ({ isConnected }) => {
      console.log('Received WhatsApp status:', isConnected);
      setIsWhatsAppConnected(isConnected);
      setIsAuthenticating(false);
      
      if (isConnected) {
        setShowQR(false);
        setQrCode(null);
      } else {
        setIsLoadingChats(false);
      }
    });

    // Configurar un timer para verificar el estado periódicamente
    statusCheckTimer = setInterval(() => {
      if (socketInstance.connected) {
        console.log('Periodic status check...');
        socketInstance.emit('whatsapp:getStatus');
      }
    }, 30000); // Verificar cada 30 segundos

    socketInstance.on('whatsapp:authenticating', () => {
      console.log('WhatsApp authenticating...');
      setIsAuthenticating(true);
      setShowQR(false);
      setQrCode(null);
    });

    socketInstance.on('whatsapp:auth_failure', (error) => {
      console.error('WhatsApp authentication failed:', error);
      setIsWhatsAppConnected(false);
      setShowQR(true);
      setIsLoadingChats(false);
    });

    socketInstance.on('whatsapp:disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason);
      setIsWhatsAppConnected(false);
      setIsLoadingChats(true);
    });

    socketInstance.on('whatsapp:ready', () => {
      console.log('Received WhatsApp ready event');
      setIsWhatsAppConnected(true);
      setShowQR(false);
      setQrCode(null);
      setIsAuthenticating(false);
      setIsLoadingChats(true);
      // Solicitar chats cuando WhatsApp esté listo
      console.log('Requesting chats after ready event');
      socketInstance.emit('whatsapp:getChats');
    });

    socketInstance.on('whatsapp:chats', ({ chats }) => {
      console.log('Received WhatsApp chats event');
      console.log('Chats data:', chats);
      if (!chats || chats.length === 0) {
        console.log('No chats received or empty array');
      }
      setWhatsappChats(chats || []);
      setIsLoadingChats(false);
      
      // Log some examples for debugging
      if (chats && chats.length > 0) {
        chats.slice(0, 3).forEach((chat, index) => {
          console.log(`Chat ${index + 1}: "${chat.name}" - Last message: "${chat.lastMessage}"`);
        });
      }
    });

    socketInstance.on('whatsapp:qr', ({ qrCode }) => {
      console.log('Received QR code');
      setQrCode(qrCode);
      setShowQR(true);
      setIsLoadingChats(false);
    });

    socketInstance.on('whatsapp:message', (message) => {
      console.log('Received WhatsApp message:', message);
      console.log('Current selectedChat:', selectedChatRef.current);
      console.log('Message from:', message.from);
      console.log('Message body:', message.body);
      console.log('Message fromMe:', message.fromMe);
      
      // Actualizar la lista de chats
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

      // Si estamos en el chat activo, agregar el mensaje a la conversación
      if (selectedChatRef.current === message.from) {
        console.log('✅ Chat matches! Adding message to selected chat');
        setChatMessages(prev => {
          console.log('Previous chat messages:', prev);
          
          // FIX: Usar el ID del mensaje del backend para evitar duplicados.
          const messageExists = prev.some(msg => msg.id === message.id);
          
          if (messageExists) {
            console.log(`❌ Message with ID ${message.id} already exists, skipping...`);
            return prev;
          }
          
          const newMessage: Message = {
            id: message.id, // Usar el ID del backend
            content: message.body,
            role: message.fromMe ? "assistant" : "user" as "user" | "assistant",
            timestamp: new Date(message.timestamp * 1000)
          };
          
          console.log('✅ Adding new message to chat:', newMessage);
          const updatedMessages = [...prev, newMessage];
          console.log('Updated chat messages:', updatedMessages);
          return updatedMessages;
        });
      } else {
        console.log('❌ Chat does not match. selectedChat:', selectedChatRef.current, 'message.from:', message.from);
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

    socketInstance.on('whatsapp:chatUpdated', (updatedChat: WhatsAppChat) => {
      console.log('EVENT: whatsapp:chatUpdated', updatedChat);
      setWhatsappChats(prevChats => {
        console.log('STATE UPDATE: Previous chats:', prevChats.map(c => ({id: c.id, aiEnabled: c.aiEnabled})));
        const chatToUpdate = prevChats.find(chat => chat.id === updatedChat.id);
        
        const newChats = prevChats.map(chat =>
          chat.id === updatedChat.id
            ? { ...chat, aiEnabled: updatedChat.aiEnabled }
            : chat
        );
    
        console.log('STATE UPDATE: New chats:', newChats.map(c => ({id: c.id, aiEnabled: c.aiEnabled})));
    
        if (chatToUpdate) {
          const toastMessage = `IA para ${chatToUpdate.name} ahora está ${updatedChat.aiEnabled ? 'activa' : 'inactiva'}.`;
          console.log('TOAST:', toastMessage);
          toast.info(toastMessage);
        }
        
        return newChats;
      });
    });

    setMainSocket(socketInstance)

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (statusCheckTimer) {
        clearInterval(statusCheckTimer);
      }
      socketInstance.disconnect()
      socketInstance.off('whatsapp:status');
      socketInstance.off('whatsapp:qr');
      socketInstance.off('whatsapp:ready');
      socketInstance.off('whatsapp:chats');
      socketInstance.off('whatsapp:message');
      socketInstance.off('whatsapp:chatMessages');
      socketInstance.off('whatsapp:error');
      socketInstance.off('whatsapp:authenticating');
      socketInstance.off('whatsapp:auth_failure');
      socketInstance.off('whatsapp:disconnected');
      socketInstance.off('ai_response');
      socketInstance.off('whatsapp:chatUpdated');
    }
  }, [user, isAuthLoading, router])

  useEffect(() => {
    if (mainSocket) {
      mainSocket.on('whatsapp:chatUpdated', (updatedChat) => {
        setWhatsappChats(prevChats =>
          prevChats.map(chat =>
            chat.id === updatedChat.id
              ? { ...chat, aiEnabled: updatedChat.aiEnabled }
              : chat
          )
        );
        toast.info(
          `IA para el chat con ${
            whatsappChats.find((c) => c.id === updatedChat.id)?.name ||
            'un usuario'
          } ha sido ${updatedChat.aiEnabled ? 'activada' : 'desactivada'}.`,
        );
      });

      return () => {
        mainSocket.off('whatsapp:chatUpdated');
      };
    }
  }, [mainSocket, whatsappChats]);

  // Modificar el efecto para la pestaña de WhatsApp
  useEffect(() => {
    if (mainSocket && isConnected) {
      console.log('Tab changed to WhatsApp, checking WhatsApp status...');
      setIsLoadingChats(true);
      // Primero verificar el estado de WhatsApp
      mainSocket.emit('whatsapp:getStatus');
    }
  }, [mainSocket, isConnected]);

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

    // Send message through WebSocket
    mainSocket.emit('input_text', { text: input })
  }

  const handleWhatsAppConnect = () => {
    if (!mainSocket) return;
    
    if (!isWhatsAppConnected) {
      mainSocket.emit('whatsapp:getQR');
      setShowQR(true);
    } else {
      // Si ya está conectado, podemos mostrar un mensaje o hacer algo más
      console.log('WhatsApp ya está conectado');
    }
  };

  const handleChatSelect = (chatId: string) => {
    setSelectedChat(chatId);
    setShowChatView(true);
    setChatMessages([]);
    setIsLoadingMessages(true);

    // Actualización optimista: marcar el chat como leído en la UI inmediatamente
    setWhatsappChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );

    // Usar el socket principal para obtener los mensajes y notificar que se leyó el chat
    if (mainSocket && isConnected) {
      console.log('Requesting chat messages for:', chatId);
      mainSocket.emit('whatsapp:getChatMessages', { chatId });

      console.log('Marking chat as read:', chatId);
      mainSocket.emit('whatsapp:markChatAsRead', { chatId });
    }
  }

  const handleBackToChats = () => {
    setShowChatView(false);
    setSelectedChat(null);
  }

  const handleSendWhatsAppMessage = (message: string) => {
    if (!mainSocket || !selectedChat || !isConnected) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      content: message,
      role: "assistant",
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, newMessage]);

    // Actualización optimista de la lista de chats
    setWhatsappChats(prevChats => {
      const updatedChats = prevChats.map(chat =>
        chat.id === selectedChat
          ? { ...chat, lastMessage: message, timestamp: Date.now() / 1000 }
          : chat
      );
      // Mover el chat actualizado al principio de la lista
      const currentChat = updatedChats.find(chat => chat.id === selectedChat);
      if (currentChat) {
        const otherChats = updatedChats.filter(chat => chat.id !== selectedChat);
        return [currentChat, ...otherChats];
      }
      return updatedChats;
    });
    
    mainSocket.emit('whatsapp:sendMessage', {
      to: selectedChat,
      message
    });
  }

  const handleToggleAIChat = (chatId: string) => {
    if (!mainSocket || !user?.locationId) return;
    mainSocket.emit('whatsapp:toggleAIChat', {
      chatId,
      locationId: user.locationId,
    });
  };

  const handleAIToggle = async (checked: boolean) => {
    setIsSavingSettings(true)
    try {
      const response = await fetch("/api/settings/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Sandra", // Mantener el nombre actual
          gender: "female", // Mantener el género actual
          enabled: checked,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      setAiEnabled(checked)
      toast.success(checked ? "IA activada" : "IA desactivada")
    } catch (error) {
      toast.error("Error al actualizar la configuración")
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Load AI settings on component mount
  useEffect(() => {
    const loadAISettings = async () => {
      try {
        const response = await fetch("/api/settings/ai")
        if (!response.ok) {
          throw new Error("Failed to load settings")
        }
        const data = await response.json()
        setAiEnabled(data.enabled)
      } catch (error) {
        console.error("Error loading AI settings:", error)
      }
    }

    loadAISettings()
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Start animation
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 128); // Normalize to 0-1
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
      
      // Check for supported MIME types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsTranscribing(true);
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mimeType 
          });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          if (mainSocket && isConnected) {
            mainSocket.emit('transcribe_audio', { 
              audio: buffer,
              mimeType
            });
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          toast.error('Error al procesar el audio');
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Error al acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      // Clean up audio analysis
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setAudioLevel(0);
    }
  };

  // Add cleanup effect for audio resources
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Add socket event listener for transcription
  useEffect(() => {
    if (!mainSocket) return;

    mainSocket.on('transcription_result', ({ text }) => {
      setInput(text);
      inputRef.current?.focus();
      setIsTranscribing(false);
    });

    return () => {
      mainSocket.off('transcription_result');
    };
  }, [mainSocket]);

  const currentChat = selectedChat
    ? whatsappChats.find(chat => chat.id === selectedChat)
    : null;
  // The backend defaults to true if settings don't exist, so `?? true` is correct.
  const isAIEnabled = currentChat?.aiEnabled ?? true;

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden p-4 md:p-8 w-full flex flex-col">
      <div className="flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Inteligencia Artificial v.3.0</h1>
          <Button
            variant={isWhatsAppConnected ? "default" : "outline"}
            onClick={handleWhatsAppConnect}
            className="flex flex-col items-center gap-0.5 px-1.5 py-1 h-auto min-h-0 md:flex-row md:gap-2 md:px-4 md:py-2 md:h-10 md:text-base md:hidden"
          >
            <Phone className="h-3 w-3 md:h-4 md:w-4" />
            <span className="text-[10px] leading-none md:text-base md:leading-normal">
              {isWhatsAppConnected ? "WhatsApp Conectado" : "Conectar"}
            </span>
          </Button>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="ai-enabled"
              checked={aiEnabled}
              onCheckedChange={handleAIToggle}
              disabled={isSavingSettings}
            />
            <Label htmlFor="ai-enabled">Activar Agente IA</Label>
          </div>
          <Button
            variant={isWhatsAppConnected ? "default" : "outline"}
            onClick={handleWhatsAppConnect}
            className="hidden md:flex items-center gap-2"
          >
            <Phone className="h-4 w-4" />
            {isWhatsAppConnected ? "WhatsApp Conectado" : "Conectar WhatsApp"}
          </Button>
        </div>
      </div>

      {isAuthLoading ? (
        <div className="flex-1 flex items-center justify-center">Cargando...</div>
      ) : !user ? (
        <div className="flex-1 flex items-center justify-center">Redirigiendo al inicio de sesión...</div>
      ) : !user.locationId ? (
        <Card className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-red-500">
            <p className="font-medium">No tienes una ubicación asignada</p>
            <p className="text-sm mt-2">Por favor, contacta al administrador para que te asigne una ubicación.</p>
          </div>
        </Card>
      ) : (
        <Tabs 
          defaultValue="whatsapp" 
          className="flex-1 flex flex-col min-h-0"
          onValueChange={(value) => setActiveTab(value)}
        >
          <div className="flex-none flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="chat">Chat IA</TabsTrigger>
            </TabsList>
          </div>
          
          {activeTab === "whatsapp" && (
            <TabsContent value="whatsapp" className="flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative h-full">
                <AnimatePresence mode="sync">
                  {(!showChatView || window.innerWidth >= 768) && (
                    <motion.div
                      key="chats"
                      initial={{ x: -300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -300, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="col-span-1 md:col-span-4 h-full"
                    >
                      <Card className="h-full flex flex-col">
                        <div className="flex-none p-4 border-b">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Chats</h2>
                          </div>

                          {isAuthenticating ? (
                            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg mt-4">
                              <p className="text-sm text-center">Conectando, por favor espera...</p>
                            </div>
                          ) : showQR && qrCode && (
                            <div className="flex flex-col items-center gap-4 p-4 border rounded-lg mt-4">
                              <p className="text-sm text-center">Escanea el código QR con WhatsApp</p>
                              <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                            </div>
                          )}
                        </div>

                        <div className="h-[calc(100vh-16rem)] md:h-[calc(100vh-20rem)] overflow-y-auto">
                          <div className="p-4 space-y-2">
                            {isLoadingChats ? (
                              <div className="flex items-center justify-center p-4">
                                <p className="text-muted-foreground">Cargando chats...</p>
                              </div>
                            ) : whatsappChats.length === 0 ? (
                              <div className="flex items-center justify-center p-4">
                                <p className="text-muted-foreground">No hay chats disponibles</p>
                              </div>
                            ) : (
                              whatsappChats.map((chat) => (
                                <div
                                  key={chat.id}
                                  onClick={() => handleChatSelect(chat.id)}
                                  className={cn(
                                    "p-4 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                                    selectedChat === chat.id && "bg-muted"
                                  )}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <Avatar className="flex-shrink-0">
                                      <AvatarFallback>{chat.name ? chat.name[0] : '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium truncate">{chat.name}</p>
                                        {chat.timestamp && (
                                          <span className="text-xs text-muted-foreground flex-shrink-0">
                                            {new Date(chat.timestamp * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <p className="text-sm text-muted-foreground truncate">
                                          {chat.lastMessage || 'Sin mensajes'}
                                        </p>
                                        {chat.unreadCount > 0 && (
                                          <Badge variant="secondary" className="flex-shrink-0 ml-2">
                                            {chat.unreadCount}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {(showChatView || window.innerWidth >= 768) && (
                    <motion.div
                      key="chat"
                      initial={{ x: 300, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 300, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="col-span-1 md:col-span-8 h-full"
                    >
                      <Card className="h-full flex flex-col">
                        {selectedChat && currentChat ? (
                          <div className="flex flex-col h-full">
                            <div className="flex-none flex items-center justify-between gap-2 p-4 border-b">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleBackToChats}
                                  className="md:hidden flex-shrink-0"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-5 w-5"
                                  >
                                    <path d="m15 18-6-6 6-6" />
                                  </svg>
                                </Button>
                                <h2 className="text-lg font-semibold truncate">
                                  {currentChat.name}
                                </h2>
                              </div>
                              <Button
                                variant="ghost"
                                onClick={() => handleToggleAIChat(selectedChat)}
                                className={cn(
                                  "transition-colors flex items-center gap-1 md:gap-2 flex-shrink-0",
                                  isAIEnabled
                                    ? "text-green-500 hover:text-green-600"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                title={
                                  isAIEnabled
                                    ? "Desactivar IA para este chat"
                                    : "Activar IA para este chat"
                                }
                              >
                                <Bot className="h-4 w-4 md:h-5 md:w-5" />
                                <span className="font-semibold text-xs md:text-sm hidden sm:inline">
                                  {isAIEnabled ? 'IA Activa' : 'IA Inactiva'}
                                </span>
                                <span className="font-semibold text-xs sm:hidden">
                                  {isAIEnabled ? 'ACTIVA' : 'INACTIVA'}
                                </span>
                              </Button>
                            </div>
                            <div className="h-[calc(100vh-16rem)] md:h-[calc(100vh-20rem)] overflow-y-auto">
                              <div className="p-4 space-y-4">
                                {isLoadingMessages ? (
                                  <div className="flex items-center justify-center h-full">
                                    <p className="text-muted-foreground">Cargando mensajes...</p>
                                  </div>
                                ) : chatMessages.length === 0 ? (
                                  <div className="flex items-center justify-center h-full">
                                    <p className="text-muted-foreground">No hay mensajes en este chat</p>
                                  </div>
                                ) : (
                                  <>
                                    {chatMessages.map((message) => (
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
                                              ? "/bot-avatar.png" 
                                              : user?.avatar || "/user-avatar.png"} 
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
                                    ))}
                                    <div ref={chatMessagesEndRef} />
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex-none p-4 border-t">
                              <div className="flex gap-2">
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
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground">
                            Selecciona un chat para comenzar
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
          )}

          {activeTab === "chat" && (
            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
              <Card className="h-full flex flex-col">
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
                              ? "/bot-avatar.png" 
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
                <div className="flex-none p-4 flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      placeholder={isRecording ? "Escuchando..." : "Escribe tu mensaje..."}
                      value={isRecording ? "" : input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      className={cn(
                        "text-base pr-8",
                        isRecording && "bg-muted"
                      )}
                      style={{ 
                        fontSize: '16px',
                        WebkitTextSizeAdjust: '100%'
                      }}
                      disabled={isRecording}
                    />
                    {isRecording && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-primary rounded-full"
                            style={{
                              height: `${Math.max(4, audioLevel * 20)}px`,
                              transition: 'height 0.1s ease-in-out',
                              animation: 'wave 1s ease-in-out infinite',
                              animationDelay: `${i * 0.1}s`
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {!isRecording && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={startRecording}
                      disabled={isTranscribing}
                      className={cn(
                        "transition-colors",
                        isTranscribing && "opacity-50"
                      )}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    onClick={isRecording ? stopRecording : handleSendMessage} 
                    disabled={(!input.trim() && !isRecording) || !isConnected || isLoading}
                    className={cn(
                      "transition-colors",
                      isRecording && "bg-primary text-primary-foreground"
                    )}
                  >
                    {isRecording ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}

// Add this to your global CSS or create a new style block
const styles = `
@keyframes wave {
  0%, 100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}
`; 