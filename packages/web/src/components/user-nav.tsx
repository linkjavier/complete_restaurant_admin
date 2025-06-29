"use client"

import { Bell, Brain, Send, Mic, Check } from "lucide-react"
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
import { toast } from "sonner"

// Custom hook for mobile viewport height
function useMobileViewportHeight() {
  const [vh, setVh] = useState('100vh');

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setVh(`${window.innerHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('scroll', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('scroll', updateHeight);
    };
  }, []);

  return vh;
}

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function UserNav() {
  const { user, isLoading } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoadingState, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mainSocket, setMainSocket] = useState<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const vh = useMobileViewportHeight()
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  useEffect(() => {
    if (isLoading || !user?.locationId) return

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

    socketInstance.on('transcription_result', ({ text }) => {
      setInput(text);
      inputRef.current?.focus();
      setIsTranscribing(false);
    })

    socketInstance.on('error', ({ message, details }) => {
      console.error('Socket error:', message, details)
      setIsLoading(false)
      setIsTranscribing(false)
      toast.error(message || 'Error en la transcripción');
    })

    setMainSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [user, isLoading])

  // Clean up on unmount
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

  const handleSendMessage = () => {
    if (!input.trim() || !mainSocket || !isConnected || isLoadingState) return

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
        <DialogContent 
          className={cn(
            "max-w-2xl flex flex-col",
            "h-[600px] md:h-[600px]",
            "h-[calc(var(--vh,1vh)*90)] md:h-[600px]",
            "w-[calc(100%-2rem)] md:w-auto",
            "mx-auto md:mx-0",
            "top-[50%] md:top-[50%]",
            "translate-y-[-50%] md:translate-y-[-50%]",
            "rounded-lg md:rounded-lg",
            "p-0 md:p-6"
          )}
          style={{ 
            maxHeight: 'calc(var(--vh, 1vh) * 90)',
            height: 'calc(var(--vh, 1vh) * 90)'
          }}
        >
          <DialogHeader className="p-4 md:p-0 border-b">
            <DialogTitle>Asistente Administrativo</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4 md:p-0">
            <div className="space-y-4">
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
                    <AvatarImage src="/bot-avatar.png" />
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
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder={isRecording ? "Escuchando..." : "Consulta reportes, métricas o análisis..."}
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
              disabled={(!input.trim() && !isRecording) || !isConnected || isLoadingState}
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