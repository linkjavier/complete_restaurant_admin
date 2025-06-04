import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AIGateway } from '../ai/ai.gateway';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private client: Client;
  private qrCode: string | null = null;
  private isConnected = false;
  private locationId: string | null = null;
  private initializationPromise: Promise<void> | null = null;
  private cachedChats: any[] = [];
  private lastChatsUpdate: number = 0;
  private readonly CHATS_CACHE_DURATION = 30000; // 30 seconds
  private qrCodePromise: Promise<string> | null = null;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AIGateway))
    private aiGateway: AIGateway,
  ) {
    // No inicializar en el constructor
  }

  async initializeWhatsApp() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        this.logger.log('Initializing WhatsApp client...');
        
        // Verificar si ya existe una sesión autenticada
        const authPath = '.wwebjs_auth';
        const sessionExists = await this.checkSessionExists(authPath);
        this.logger.log(`Session exists: ${sessionExists}`);

        // Si el cliente ya existe y está conectado, no necesitamos reinicializarlo
        if (this.client) {
          try {
            const state = await this.client.getState();
            if (state === 'CONNECTED') {
              this.logger.log('WhatsApp client is already connected');
              this.isConnected = true;
              return;
            }
          } catch (error) {
            this.logger.error(`Error checking existing client state: ${error.message}`);
            // Si hay un error, destruir el cliente existente y crear uno nuevo
            try {
              await this.client.destroy();
            } catch (destroyError) {
              this.logger.error(`Error destroying existing client: ${destroyError.message}`);
            }
            this.client = null;
          }
        }

        // Crear una nueva promesa para el código QR
        this.qrCodePromise = new Promise((resolve) => {
          const puppeteerOptions = {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu',
              '--disable-extensions',
              '--disable-component-extensions-with-background-pages',
              '--disable-default-apps',
              '--mute-audio',
              '--no-default-browser-check',
              '--no-experiments',
              '--disable-features=site-per-process',
              '--disable-features=TranslateUI',
              '--disable-features=IsolateOrigins',
              '--disable-site-isolation-trials',
            ],
            ignoreHTTPSErrors: true,
          };

          this.client = new Client({
            authStrategy: new LocalAuth({
              clientId: 'restaurant-admin',
              dataPath: authPath,
            }),
            puppeteer: puppeteerOptions,
            qrMaxRetries: 5,
            authTimeoutMs: 60000,
            restartOnAuthFail: true,
            takeoverOnConflict: true,
            takeoverTimeoutMs: 10000,
          });

          this.client.on('qr', async (qr) => {
            this.logger.log('Received QR code');
            try {
              this.qrCode = await qrcode.toDataURL(qr);
              this.eventEmitter.emit('whatsapp.qr', this.qrCode);
              resolve(this.qrCode);
            } catch (error) {
              this.logger.error(`Error generating QR code: ${error.message}`);
              resolve(null);
            }
          });

          this.client.on('authenticated', () => {
            this.logger.log('WhatsApp client is authenticated');
            this.isConnected = true;
            this.qrCode = null;
            this.qrCodePromise = null;
            this.eventEmitter.emit('whatsapp.authenticated');
          });

          this.client.on('ready', async () => {
            this.logger.log('WhatsApp client is ready!');
            this.isConnected = true;
            this.qrCode = null;
            this.qrCodePromise = null;
            
            // Get the first location ID when WhatsApp is ready
            if (!this.locationId) {
              const firstLocation = await this.prisma.location.findFirst();
              if (firstLocation) {
                this.locationId = firstLocation.id;
                this.logger.log(`Using location ID: ${this.locationId}`);
              } else {
                this.logger.error('No location found in the database');
              }
            }
            
            this.eventEmitter.emit('whatsapp.ready');
            
            // Automatically fetch and emit chats when ready
            try {
              const chats = await this.getChats();
              this.logger.log(`Emitting ${chats.length} chats after ready event`);
              this.eventEmitter.emit('whatsapp.chats', { chats });
            } catch (error) {
              this.logger.error(`Error fetching chats after ready: ${error.message}`);
            }
          });

          this.client.on('auth_failure', (error) => {
            this.logger.error('WhatsApp authentication failed:', error);
            this.isConnected = false;
            this.initializationPromise = null;
            this.qrCodePromise = null;
            this.eventEmitter.emit('whatsapp.auth_failure', error);
          });

          this.client.on('disconnected', (reason) => {
            this.logger.log(`WhatsApp client disconnected: ${reason}`);
            this.isConnected = false;
            this.initializationPromise = null;
            this.qrCodePromise = null;
            this.eventEmitter.emit('whatsapp.disconnected', reason);
          });

          // Agregar manejador de mensajes entrantes
          this.client.on('message', async (message) => {
            try {
              // Ignorar mensajes propios
              if (message.fromMe) return;

              this.logger.log(`Received message from ${message.from}: ${message.body}`);

              // Verificar si tenemos un locationId
              if (!this.locationId) {
                const firstLocation = await this.prisma.location.findFirst();
                if (firstLocation) {
                  this.locationId = firstLocation.id;
                  this.logger.log(`Using location ID: ${this.locationId}`);
                } else {
                  this.logger.error('No location found in the database');
                  return;
                }
              }

              // Guardar el mensaje entrante en la base de datos
              await this.prisma.whatsappMessage.create({
                data: {
                  id: message.id._serialized,
                  from: message.from,
                  body: message.body,
                  timestamp: new Date(message.timestamp * 1000),
                  location: {
                    connect: {
                      id: this.locationId
                    }
                  }
                },
              });

              // Verificar si la IA está habilitada
              const aiSettings = await this.prisma.settings.findFirst();
              if (!aiSettings?.aiEnabled) {
                // Si la IA está deshabilitada, solo actualizar la caché de chats y salir
                if (this.cachedChats.length > 0) {
                  const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                  if (chatIndex !== -1) {
                    this.cachedChats[chatIndex] = {
                      ...this.cachedChats[chatIndex],
                      lastMessage: message.body,
                      timestamp: message.timestamp,
                    };
                    this.lastChatsUpdate = Date.now();
                    this.eventEmitter.emit('whatsapp:chats', { chats: this.cachedChats });
                  }
                }
                return;
              }

              // Procesar el mensaje con la IA
              const aiResponse = await this.aiGateway.handleTextInput({
                text: message.body,
                locationId: this.locationId,
              });

              // Guardar la respuesta de la IA en la base de datos
              await this.prisma.whatsappMessage.create({
                data: {
                  from: message.from,
                  body: aiResponse,
                  timestamp: new Date(),
                  location: {
                    connect: {
                      id: this.locationId
                    }
                  },
                  isFromAI: true,
                },
              });

              // Enviar la respuesta de la IA
              await this.client.sendMessage(message.from, aiResponse);

              // Emitir eventos para actualizar el frontend
              this.eventEmitter.emit('whatsapp.message', {
                from: message.from,
                body: message.body,
                timestamp: message.timestamp,
              });

              this.eventEmitter.emit('whatsapp.message', {
                from: message.from,
                body: aiResponse,
                timestamp: Date.now() / 1000,
                fromMe: true,
              });

              // Actualizar la caché de chats
              if (this.cachedChats.length > 0) {
                const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                if (chatIndex !== -1) {
                  this.cachedChats[chatIndex] = {
                    ...this.cachedChats[chatIndex],
                    lastMessage: aiResponse,
                    timestamp: Date.now() / 1000,
                  };
                  this.lastChatsUpdate = Date.now();
                  this.eventEmitter.emit('whatsapp:chats', { chats: this.cachedChats });
                }
              }

            } catch (error) {
              this.logger.error(`Error processing message with AI: ${error.message}`);
              // Enviar mensaje de error al usuario
              try {
                await this.client.sendMessage(
                  message.from,
                  'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.'
                );
              } catch (sendError) {
                this.logger.error(`Error sending error message: ${sendError.message}`);
              }
            }
          });

          // Inicializar el cliente de manera asíncrona
          setTimeout(() => {
            this.client.initialize().catch(error => {
              this.logger.error(`Error initializing WhatsApp client: ${error.message}`);
              this.initializationPromise = null;
              this.qrCodePromise = null;
              throw error;
            });
          }, 1000);
        });

        // Esperar a que el cliente se inicialice
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('WhatsApp initialization timeout'));
          }, 30000);

          const readyHandler = () => {
            clearTimeout(timeout);
            this.eventEmitter.off('whatsapp.ready', readyHandler);
            resolve(true);
          };

          this.eventEmitter.on('whatsapp.ready', readyHandler);
        });

        this.logger.log('WhatsApp client initialization completed');

        // Verificar el estado después de la inicialización
        const state = await this.client.getState();
        this.isConnected = state === 'CONNECTED';
        this.logger.log(`Initial WhatsApp state: ${state}, isConnected: ${this.isConnected}`);
        
        if (this.isConnected) {
          this.eventEmitter.emit('whatsapp.ready');
        }
      } catch (error) {
        this.logger.error(`Error initializing WhatsApp: ${error.message}`);
        this.initializationPromise = null;
        this.qrCodePromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private async checkSessionExists(authPath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join(process.cwd(), authPath, 'restaurant-admin');
      const exists = fs.existsSync(sessionPath);
      this.logger.log(`Session path ${sessionPath} exists: ${exists}`);
      return exists;
    } catch (error) {
      this.logger.error(`Error checking session: ${error.message}`);
      return false;
    }
  }

  async waitForConnection(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    return new Promise((resolve) => {
      const readyHandler = () => {
        this.eventEmitter.off('whatsapp.ready', readyHandler);
        resolve();
      };
      this.eventEmitter.on('whatsapp.ready', readyHandler);
    });
  }

  async getQRCode(): Promise<string | null> {
    try {
      await this.initializeWhatsApp();
      
      if (this.isConnected) {
        this.logger.log('WhatsApp is already connected, no QR code needed');
        return null;
      }

      if (this.qrCode) {
        this.logger.log('Returning existing QR code');
        return this.qrCode;
      }

      if (this.qrCodePromise) {
        this.logger.log('Waiting for QR code from existing promise');
        return await this.qrCodePromise;
      }

      this.logger.log('No QR code available, waiting for initialization');
      return null;
    } catch (error) {
      this.logger.error(`Error getting QR code: ${error.message}`);
      return null;
    }
  }

  async isWhatsAppConnected(): Promise<boolean> {
    try {
      await this.initializeWhatsApp();
      
      if (!this.client) {
        this.logger.log('WhatsApp client not initialized');
        return false;
      }

      try {
        const state = await this.client.getState();
        this.isConnected = state === 'CONNECTED';
        this.logger.log(`WhatsApp state: ${state}, isConnected: ${this.isConnected}`);
        
        if (this.isConnected) {
          // Verificar que podemos obtener los chats
          try {
            const chats = await this.client.getChats();
            this.logger.log(`Successfully retrieved ${chats.length} chats`);
            return true;
          } catch (error) {
            this.logger.error(`Error getting chats: ${error.message}`);
            // Si hay un error al obtener los chats, intentar reinicializar
            this.initializationPromise = null;
            await this.initializeWhatsApp();
            return false;
          }
        }
        
        return false;
      } catch (error) {
        this.logger.error(`Error getting WhatsApp state: ${error.message}`);
        this.isConnected = false;
        // Intentar reinicializar si hay un error
        this.initializationPromise = null;
        await this.initializeWhatsApp();
        return false;
      }
    } catch (error) {
      this.logger.error(`Error checking WhatsApp connection: ${error.message}`);
      return false;
    }
  }

  async getChats(): Promise<any[]> {
    try {
      await this.initializeWhatsApp();
      
      if (!this.client) {
        throw new Error('WhatsApp client not initialized');
      }

      const state = await this.client.getState();
      if (state !== 'CONNECTED') {
        throw new Error('WhatsApp is not connected');
      }

      // Check if we have cached chats that are still valid
      const now = Date.now();
      if (this.cachedChats.length > 0 && (now - this.lastChatsUpdate) < this.CHATS_CACHE_DURATION) {
        this.logger.log('Returning cached chats');
        return this.cachedChats;
      }

      this.logger.log('Fetching WhatsApp chats...');
      const chats = await this.client.getChats();
      this.logger.log(`Found ${chats.length} chats`);
      
      const formattedChats = chats.map(chat => {
        const formatted = {
          id: chat.id._serialized,
          name: chat.name,
          lastMessage: chat.lastMessage?.body || '',
          timestamp: chat.lastMessage?.timestamp || null,
          unreadCount: chat.unreadCount,
        };
        this.logger.debug(`Formatted chat: ${JSON.stringify(formatted)}`);
        return formatted;
      });

      // Update cache
      this.cachedChats = formattedChats;
      this.lastChatsUpdate = now;

      this.logger.log('Emitting whatsapp:chats event with formatted chats');
      this.eventEmitter.emit('whatsapp:chats', { chats: formattedChats });

      return formattedChats;
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chats: ${error.message}`);
      // If we have cached chats, return them even if they're expired
      if (this.cachedChats.length > 0) {
        this.logger.log('Returning expired cached chats due to error');
        return this.cachedChats;
      }
      throw error;
    }
  }

  async getChatMessages(chatId: string): Promise<any[]> {
    await this.initializeWhatsApp();
    await this.waitForConnection();

    try {
      this.logger.log(`Fetching messages for chat ${chatId}...`);
      
      // Primero, obtener los mensajes históricos de la base de datos
      const dbMessages = await this.prisma.whatsappMessage.findMany({
        where: {
          from: chatId,
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      this.logger.log(`Found ${dbMessages.length} messages in database`);

      // Luego, obtener los mensajes más recientes de WhatsApp
      const chat = await this.client.getChatById(chatId);
      if (!chat) {
        this.logger.error(`Chat ${chatId} not found`);
        throw new Error(`Chat ${chatId} not found`);
      }

      const whatsappMessages = await chat.fetchMessages({ limit: 50 });
      this.logger.log(`Found ${whatsappMessages.length} messages from WhatsApp`);

      // Crear un Set para rastrear IDs únicos de mensajes
      const processedIds = new Set<string>();
      const uniqueMessages: any[] = [];

      // Función para agregar mensaje si es único
      const addUniqueMessage = (message: any) => {
        const messageId = message.id || message.id._serialized;
        if (!processedIds.has(messageId)) {
          processedIds.add(messageId);
          uniqueMessages.push(message);
        }
      };

      // Procesar mensajes de la base de datos
      dbMessages.forEach(msg => {
        addUniqueMessage({
          id: msg.id,
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp.getTime() / 1000,
          fromMe: msg.isFromAI || false,
        });
      });

      // Procesar mensajes de WhatsApp
      whatsappMessages.forEach(message => {
        if (message.from === chatId || message.to === chatId) {
          addUniqueMessage({
            id: message.id._serialized,
            from: message.from,
            body: message.body,
            timestamp: message.timestamp,
            fromMe: message.fromMe,
          });
        }
      });

      // Ordenar mensajes por timestamp
      return uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chat messages: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    await this.initializeWhatsApp();
    await this.waitForConnection();

    try {
      await this.client.sendMessage(to, message);
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error.message}`);
      throw error;
    }
  }

  async handleIncomingMessage(message: any) {
    try {
      if (!this.locationId) {
        throw new Error('No location ID available for saving message');
      }

      // Store message in database
      await this.prisma.whatsappMessage.create({
        data: {
          id: message.id._serialized,
          from: message.from,
          body: message.body,
          timestamp: new Date(message.timestamp * 1000),
          location: {
            connect: {
              id: this.locationId
            }
          }
        },
      });

      // Update cached chats if they exist
      if (this.cachedChats.length > 0) {
        const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
        if (chatIndex !== -1) {
          this.cachedChats[chatIndex] = {
            ...this.cachedChats[chatIndex],
            lastMessage: message.body,
            timestamp: message.timestamp,
          };
          this.lastChatsUpdate = Date.now();
          this.eventEmitter.emit('whatsapp:chats', { chats: this.cachedChats });
        }
      }

      // Check if AI is enabled before processing
      const aiSettings = await this.prisma.settings.findFirst();
      if (!aiSettings?.aiEnabled) {
        // If AI is disabled, just return without processing
        return;
      }

      // Get AI response
      const aiResponse = await this.aiGateway.handleTextInput({
        text: message.body,
        locationId: this.locationId,
      });

      // Send response back to WhatsApp
      await this.client.sendMessage(message.from, aiResponse);

      return aiResponse;
    } catch (error) {
      this.logger.error(`Error handling incoming message: ${error.message}`);
      throw error;
    }
  }
} 