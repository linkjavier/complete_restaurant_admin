import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AIGateway } from '../ai/ai.gateway';
import { STTService } from '../stt/stt.service';
import { WhatsappChat } from '@prisma/client';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private client: Client;
  private qrCode: string | null = null;
  private isConnected = false;
  private isAuthenticating = false;
  private locationId: string | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isRestarting = false;
  private cachedChats: any[] = [];
  private lastChatsUpdate: number = 0;
  private readonly CHATS_CACHE_DURATION = 30000; // 30 seconds
  private qrCodePromise: Promise<string> | null = null;
  private aiEnabled: boolean = false;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AIGateway))
    private aiGateway: AIGateway,
    private sttService: STTService,
    @Inject(forwardRef(() => CustomersService))
    private customersService: CustomersService,
  ) {
    // No inicializar en el constructor
  }

  async initializeWhatsApp() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // this.logger.log('Initializing WhatsApp client...');
        
        // Verificar si ya existe una sesión autenticada
        const authPath = '.wwebjs_auth';
        const sessionExists = await this.checkSessionExists(authPath);
        // this.logger.log(`Session exists: ${sessionExists}`);

        // Si el cliente ya existe y está conectado, no necesitamos reinicializarlo
        if (this.client) {
          try {
            const state = await this.client.getState();
            if (state === 'CONNECTED') {
              // this.logger.log('WhatsApp client is already connected');
              this.isConnected = true;
              return;
            }
          } catch (error) {
            // this.logger.error(`Error checking existing client state: ${error.message}`);
            // Si hay un error, destruir el cliente existente y crear uno nuevo
            try {
              await this.client.destroy();
            } catch (destroyError) {
              // this.logger.error(`Error destroying existing client: ${destroyError.message}`);
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
            // this.logger.log('Received QR code');
            try {
              this.qrCode = await qrcode.toDataURL(qr);
              this.eventEmitter.emit('whatsapp.qr', this.qrCode);
              resolve(this.qrCode);
            } catch (error) {
              // this.logger.error(`Error generating QR code: ${error.message}`);
              resolve(null);
            }
          });

          this.client.on('authenticated', () => {
            // this.logger.log('WhatsApp client is authenticated');
            this.isAuthenticating = true;
            this.isConnected = false;
            this.qrCode = null;
            this.qrCodePromise = null;
            
            // Add a small delay to allow the client to stabilize
            setTimeout(() => {
            this.eventEmitter.emit('whatsapp.authenticated');
            }, 1000);
          });

          this.client.on('ready', async () => {
            // this.logger.log('WhatsApp client is ready!');
            this.isConnected = true;
            this.isAuthenticating = false;
            this.qrCode = null;
            this.qrCodePromise = null;
            
            // Get the first location ID when WhatsApp is ready
            if (!this.locationId) {
              const firstLocation = await this.prisma.location.findFirst();
              if (firstLocation) {
                this.locationId = firstLocation.id;
                // this.logger.log(`Using location ID: ${this.locationId}`);
              } else {
                // this.logger.error('No location found in the database');
              }
            }
            
            this.eventEmitter.emit('whatsapp.ready');
          });

          this.client.on('auth_failure', (error) => {
            // this.logger.error('WhatsApp authentication failed:', error);
            this.isConnected = false;
            this.isAuthenticating = false;
            this.initializationPromise = null;
            this.qrCodePromise = null;
            this.eventEmitter.emit('whatsapp.auth_failure', error);
          });

          this.client.on('disconnected', (reason) => {
            // this.logger.log(`WhatsApp client disconnected: ${reason}`);
            this.isConnected = false;
            this.isAuthenticating = false;
            this.initializationPromise = null;
            this.qrCodePromise = null;
            this.eventEmitter.emit('whatsapp.disconnected', reason);
          });

          this.client.on('error', (error) => {
            // this.logger.error(`WhatsApp client error: ${error.message}`);
            this.isConnected = false;
            this.initializationPromise = null;
            this.qrCodePromise = null;
            if (!this.isRestarting) {
              this.isRestarting = true;
              // this.logger.log('Attempting to restart WhatsApp client in 5 seconds...');
              setTimeout(() => {
                this.isRestarting = false;
                this.initializeWhatsApp().catch(err => {
                  // this.logger.error(`Failed to restart WhatsApp client: ${err.message}`);
                });
              }, 5000);
            }
          });

          // Agregar manejador de mensajes entrantes
          this.client.on('message', async (message) => {
            try {
              // Ignorar mensajes propios
              if (message.fromMe) return;

              // --- NUEVO: Obtener información del contacto ---
              let contactName = '';
              let contactPushname = '';
              let contactDisplayName = '';
              
              try {
                // Obtener el contacto del mensaje
                const contact: any = await message.getContact();
                
                // Log para verificar acceso correcto a los campos
                // console.log(`[CONTACT DEBUG] Contact info for ${message.from}:`);
                // console.log(`  - pushname: "${contact.pushname}"`);
                // console.log(`  - name: "${contact.name}"`);
                // console.log(`  - shortName: "${contact.shortName}"`);
                // console.log(`  - number: "${contact.number}"`);
                
                contactPushname = contact.pushname || '';
                contactName = contact.name || '';
                
                // Usar pushname si existe, si no usar name
                contactDisplayName = contactPushname || contactName || '';
                
                // console.log(`[CONTACT DEBUG] Selected display name: "${contactDisplayName}"`);
                
              } catch (contactError) {
                // console.error(`[CONTACT DEBUG] Error getting contact info: ${contactError.message}`);
                contactDisplayName = '';
              }
              // --- FIN NUEVO ---

              // this.logger.log(`Received message from ${message.from} (${contactDisplayName}): ${message.body}`);

              // Verificar si tenemos un locationId
              if (!this.locationId) {
                const firstLocation = await this.prisma.location.findFirst();
                if (firstLocation) {
                  this.locationId = firstLocation.id;
                  // this.logger.log(`Using location ID: ${this.locationId}`);
                } else {
                  // this.logger.error('No location found in the database');
                  return;
                }
              }

              // Check if the message is a voice note
              if (message.hasMedia && message.type === 'ptt') {
                try {
                  // Download the voice note
                  const media = await message.downloadMedia();
                  if (media && media.data) {
                    // Convert base64 to buffer
                    const audioBuffer = Buffer.from(media.data, 'base64');
                    
                    // Transcribe the audio
                    const transcribedText = await this.sttService.transcribeAudio(audioBuffer);
                    // this.logger.log(`Transcribed voice note: ${transcribedText}`);

                    // Save the transcribed message in the database
                    await this.prisma.whatsappMessage.create({
                      data: {
                        from: message.from,
                        body: transcribedText,
                        timestamp: new Date(message.timestamp * 1000),
                        location: {
                          connect: {
                            id: this.locationId
                          }
                        },
                        isFromAI: false,
                        isVoiceNote: true,
                      }
                    });

                    // Emitir evento para el mensaje recibido del usuario
                    this.eventEmitter.emit('whatsapp.message', {
                      from: message.from,
                      body: transcribedText,
                      timestamp: message.timestamp,
                      fromMe: false,
                    });

                    // Process the transcribed text with AI
                    const aiResponse = await this.aiGateway.handleTextInput({
                      text: transcribedText,
                      locationId: this.locationId,
                      chatType: 'whatsapp',
                      chatId: message.from,
                    });

                    // Solo procesar si hay una respuesta de IA
                    if (aiResponse && aiResponse.trim()) {
                      // Save the AI response
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
                        }
                      });

                      // Send the AI response
                      await this.client.sendMessage(message.from, aiResponse);

                      // Emit events for frontend updates
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
                          this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                          // this.logger.log(`Updated chat cache for ${message.from} with message: "${message.body.substring(0, 30)}..."`);
                        }
                      }
                    } else {
                      // Si no hay respuesta de IA (switch apagado), solo actualizar la caché de chats
                      if (this.cachedChats.length > 0) {
                        const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                        if (chatIndex !== -1) {
                          this.cachedChats[chatIndex] = {
                            ...this.cachedChats[chatIndex],
                            lastMessage: message.body,
                            timestamp: message.timestamp,
                          };
                          this.lastChatsUpdate = Date.now();
                          this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                          // this.logger.log(`Updated chat cache for ${message.from} with message: "${message.body.substring(0, 30)}..."`);
                        }
                      }
                    }

                    return;
                  }
                } catch (error) {
                  // this.logger.error(`Error processing voice note: ${error.message}`);
                  // Solo enviar mensaje de error si la IA está habilitada para WhatsApp
                  const aiSettings = await this.prisma.settings.findFirst();
                  if (aiSettings?.aiEnabled) {
                    try {
                      await this.client.sendMessage(
                        message.from,
                        'Lo siento, hubo un error al procesar tu nota de voz. Por favor, intenta de nuevo o envía un mensaje de texto.'
                      );
                    } catch (sendError) {
                      // this.logger.error(`Error sending error message: ${sendError.message}`);
                    }
                  }
                  
                  // Actualizar la caché de chats con el mensaje de error
                  if (this.cachedChats.length > 0) {
                    const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                    if (chatIndex !== -1) {
                      this.cachedChats[chatIndex] = {
                        ...this.cachedChats[chatIndex],
                        lastMessage: 'Error al procesar nota de voz',
                        timestamp: Date.now() / 1000,
                      };
                      this.lastChatsUpdate = Date.now();
                      this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                      // this.logger.log(`Updated chat cache for ${message.from} with message: "${'Error al procesar nota de voz'.substring(0, 30)}..."`);
                    }
                  }
                  
                  return;
                }
              }

              // Handle regular text messages
              const existingMessage = await this.prisma.whatsappMessage.findUnique({
                where: { id: message.id._serialized },
              });

              if (existingMessage) {
                // this.logger.log(
                //   `Message ${message.id._serialized} already exists, skipping...`,
                // );
                return;
              }

              // Find or create chat settings
              let chatSettings = await this.prisma.whatsappChat.findUnique({
                where: { id: message.from },
              });

              if (!chatSettings) {
                chatSettings = await this.prisma.whatsappChat.create({
                  data: {
                    id: message.from,
                    locationId: this.locationId,
                    aiEnabled: true, // Default to true
                  },
                });
                // this.logger.log(`Created new chat settings for ${message.from}`);
              }

              // Save the message in the database
              await this.prisma.whatsappMessage.create({
                data: {
                  from: message.from,
                  body: message.body,
                  timestamp: new Date(message.timestamp * 1000),
                  location: {
                    connect: {
                      id: this.locationId
                    }
                  },
                  isFromAI: false,
                }
              });

              // Emitir evento para el mensaje recibido del usuario
              this.eventEmitter.emit('whatsapp.message', {
                from: message.from,
                body: message.body,
                timestamp: message.timestamp,
                fromMe: false,
              });

              // Check if AI is enabled for this chat
              if (!chatSettings.aiEnabled) {
                // this.logger.log(
                //   `AI is disabled for chat ${message.from}, not processing with AI`,
                // );
                return;
              }

              // --- NUEVO: Verificar también el switch global de AI ---
              const aiSettings = await this.prisma.settings.findFirst();
              if (!aiSettings?.aiEnabled) {
                // this.logger.log(
                //   `Global AI is disabled, not processing message from ${message.from}`,
                // );
                return;
              }
              // --- FIN NUEVO ---

              // --- NUEVO: Detectar si es un saludo inicial ---
              const isInitialGreeting = this.isInitialGreeting(message.body);
              if (isInitialGreeting) {
                try {
                  const phone = this.normalizePhone(message.from);
                  const customer = await this.customersService.findByPhone(phone, this.locationId);
                  const cleanName = customer && customer.name ? customer.name.trim() : '';
                  
                  let welcomeMessage = '';
                  if (cleanName.length > 0) {
                    welcomeMessage = `👋 ¡Hola, *${cleanName}*! Soy tu asistente personal. 😊\n\n🍽️ ¿En qué puedo ayudarte hoy? ¿Te gustaría ver el menú o tienes un antojo especial?`;
                  } else {
                    welcomeMessage = `👋 ¡Hola! Soy tu asistente personal. 😊\n\n🍽️ ¿En qué puedo ayudarte hoy? ¿Te gustaría ver el menú o tienes un antojo especial?`;
                  }

                  // Enviar el saludo personalizado
                  await this.client.sendMessage(message.from, welcomeMessage);

                  // Guardar el mensaje de saludo en la base de datos
                  await this.prisma.whatsappMessage.create({
                    data: {
                      from: message.from,
                      body: welcomeMessage,
                      timestamp: new Date(),
                      location: {
                        connect: {
                          id: this.locationId
                        }
                      },
                      isFromAI: true,
                    }
                  });

                  // Emitir eventos para actualizar el frontend
                  this.eventEmitter.emit('whatsapp.message', {
                    from: message.from,
                    body: welcomeMessage,
                    timestamp: Date.now() / 1000,
                    fromMe: true,
                  });

                  // Actualizar la caché de chats
                  if (this.cachedChats.length > 0) {
                    const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                    if (chatIndex !== -1) {
                      this.cachedChats[chatIndex] = {
                        ...this.cachedChats[chatIndex],
                        lastMessage: welcomeMessage,
                        timestamp: Date.now() / 1000,
                      };
                      this.lastChatsUpdate = Date.now();
                      this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                    }
                  }

                  // No procesar más con AI para saludos iniciales
                  return;
                } catch (error) {
                  // this.logger.error(`Error sending personalized greeting: ${error.message}`);
                  // Si falla el saludo personalizado, continuar con el procesamiento normal
                }
              }
              // --- FIN NUEVO ---

              // Procesar el mensaje con la IA
              const aiResponse = await this.aiGateway.handleTextInput({
                text: message.body,
                locationId: this.locationId,
                chatType: 'whatsapp',
                chatId: message.from,
              });

              // Actualizar la caché de chats con el mensaje recibido
              if (this.cachedChats.length > 0) {
                const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                if (chatIndex !== -1) {
                  this.cachedChats[chatIndex] = {
                    ...this.cachedChats[chatIndex],
                    lastMessage: message.body,
                    timestamp: message.timestamp,
                  };
                  this.lastChatsUpdate = Date.now();
                  this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                  // this.logger.log(`Updated chat cache for ${message.from} with message: "${message.body.substring(0, 30)}..."`);
                }
              }

              // Solo procesar si hay una respuesta de IA
              if (aiResponse && aiResponse.trim()) {
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
                  }
                });

                // Enviar la respuesta de la IA
                await this.client.sendMessage(message.from, aiResponse);

                // Emitir eventos para actualizar el frontend
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
                    this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                    // this.logger.log(`Updated chat cache for ${message.from} with message: "${message.body.substring(0, 30)}..."`);
                  }
                }
              } else {
                // Si no hay respuesta de IA (switch apagado), solo actualizar la caché de chats
                if (this.cachedChats.length > 0) {
                  const chatIndex = this.cachedChats.findIndex(chat => chat.id === message.from);
                  if (chatIndex !== -1) {
                    this.cachedChats[chatIndex] = {
                      ...this.cachedChats[chatIndex],
                      lastMessage: message.body,
                      timestamp: message.timestamp,
                    };
                    this.lastChatsUpdate = Date.now();
                    this.eventEmitter.emit('whatsapp.chats', { chats: this.cachedChats });
                    // this.logger.log(`Updated chat cache for ${message.from} with message: "${message.body.substring(0, 30)}..."`);
                  }
                }
              }

            } catch (error) {
              // this.logger.error(`Error processing message with AI: ${error.message}`);
              // Solo enviar mensaje de error si la IA está habilitada para WhatsApp
              const aiSettings = await this.prisma.settings.findFirst();
              if (aiSettings?.aiEnabled) {
                try {
                  await this.client.sendMessage(
                    message.from,
                    'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.'
                  );
                } catch (sendError) {
                  // this.logger.error(`Error sending error message: ${sendError.message}`);
                }
              }
            }
          });

          // Inicializar el cliente de manera asíncrona
          setTimeout(() => {
            this.client.initialize().catch(error => {
              // this.logger.error(`Error initializing WhatsApp client: ${error.message}`);
              this.initializationPromise = null;
              this.qrCodePromise = null;
              // No relanzar el error para evitar que la aplicación se bloquee
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

        // this.logger.log('WhatsApp client initialization completed');

        // Verificar el estado después de la inicialización
        const state = await this.client.getState();
        this.isConnected = state === 'CONNECTED';
        // this.logger.log(`Initial WhatsApp state: ${state}, isConnected: ${this.isConnected}`);
        
        if (this.isConnected) {
          this.eventEmitter.emit('whatsapp.ready');
        }
      } catch (error) {
        // this.logger.error(`Error initializing WhatsApp: ${error.message}`);
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
      // this.logger.log(`Session path ${sessionPath} exists: ${exists}`);
      return exists;
    } catch (error) {
      // this.logger.error(`Error checking session: ${error.message}`);
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
        // this.logger.log('WhatsApp is already connected, no QR code needed');
        return null;
      }

      if (this.qrCode) {
        // this.logger.log('Returning existing QR code');
        return this.qrCode;
      }

      if (this.qrCodePromise) {
        // this.logger.log('Waiting for QR code from existing promise');
        return await this.qrCodePromise;
      }

      // this.logger.log('No QR code available, waiting for initialization');
      return null;
    } catch (error) {
      // this.logger.error(`Error getting QR code: ${error.message}`);
      return null;
    }
  }

  async isWhatsAppAuthenticating(): Promise<boolean> {
    return this.isAuthenticating;
  }

  async isWhatsAppConnected(): Promise<boolean> {
    try {
      await this.initializeWhatsApp();
      
      if (!this.client) {
        // this.logger.log('WhatsApp client not initialized');
        return false;
      }

      try {
        const state = await this.client.getState();
        this.isConnected = state === 'CONNECTED';
        // this.logger.log(`WhatsApp state: ${state}, isConnected: ${this.isConnected}`);
        
        if (this.isConnected) {
          // Verificar que podemos obtener los chats
          try {
            const chats = await this.client.getChats();
            // this.logger.log(`Successfully retrieved ${chats.length} chats`);
            return true;
          } catch (error) {
            // this.logger.error(`Error getting chats: ${error.message}`);
            // Si hay un error al obtener los chats, intentar reinicializar
            this.initializationPromise = null;
            await this.initializeWhatsApp();
            return false;
          }
        }
        
        return false;
      } catch (error) {
        // this.logger.error(`Error getting WhatsApp state: ${error.message}`);
        this.isConnected = false;
        // Intentar reinicializar si hay un error
        this.initializationPromise = null;
        await this.initializeWhatsApp();
        return false;
      }
    } catch (error) {
      // this.logger.error(`Error checking WhatsApp connection: ${error.message}`);
      return false;
    }
  }

  async getChats(locationId?: string): Promise<any[]> {
    try {
      await this.initializeWhatsApp();
      
      if (!this.client) {
        throw new Error('WhatsApp client not initialized');
      }

      const state = await this.client.getState();
      if (state !== 'CONNECTED') {
        throw new Error('WhatsApp is not connected');
      }

      // Usar locationId explícito si se pasa, si no, usar el de la instancia
      const effectiveLocationId = locationId || this.locationId;
      if (!effectiveLocationId) {
        throw new Error('No locationId provided or set in WhatsappService');
      }

      // Check if we have cached chats that are still valid
      const now = Date.now();
      if (this.cachedChats.length > 0 && (now - this.lastChatsUpdate) < this.CHATS_CACHE_DURATION) {
        // this.logger.log('Returning cached chats');
        return this.cachedChats;
      }

      // this.logger.log('Fetching WhatsApp chats...');
      const chats = await this.client.getChats();
      // this.logger.log(`Found ${chats.length} chats`);
      
      // Log pushname de cada chat individual
      // chats.forEach((chat: any) => {
      //   if (chat.id && chat.id._serialized && chat.id._serialized.endsWith('@c.us')) {
      //     this.logger.log(`[SYNC DEBUG] Chat: ${chat.id._serialized} | name: ${chat.name} | pushname: ${chat.pushname}`);
      //   }
      // });

      const chatSettings = await this.prisma.whatsappChat.findMany({
        where: {
          locationId: effectiveLocationId,
          id: { in: chats.map((c) => c.id._serialized) },
        },
      });

      const chatSettingsMap = new Map(
        chatSettings.map((cs) => [cs.id, cs]),
      );

      const formattedChats = chats.map((chat) => {
        const settings = chatSettingsMap.get(chat.id._serialized);
        const formatted = {
          id: chat.id._serialized,
          name: chat.name,
          lastMessage: chat.lastMessage?.body || '',
          timestamp: chat.lastMessage?.timestamp || null,
          unreadCount: chat.unreadCount,
          aiEnabled: settings ? settings.aiEnabled : true, // Default to true if no settings found
        };
        // this.logger.debug(`Formatted chat: ${JSON.stringify(formatted)}`);
        return formatted;
      });

      // this.logger.log(
      //   `Formatted ${formattedChats.length} chats with last messages`,
      // );
      // Log a few examples for debugging
      // formattedChats.slice(0, 3).forEach((chat, index) => {
      //   this.logger.log(`Chat ${index + 1}: "${chat.name}" - Last message: "${chat.lastMessage.substring(0, 50)}${chat.lastMessage.length > 50 ? '...' : ''}"`);
      // });

      // Capturar información de clientes de chats individuales
      await this.captureCustomerInfo(formattedChats, effectiveLocationId);

      // Update cache
      this.cachedChats = formattedChats;
      this.lastChatsUpdate = now;

      return formattedChats;
    } catch (error) {
      // this.logger.error(`Error getting WhatsApp chats: ${error.message}`);
      // If we have cached chats, return them even if they're expired
      if (this.cachedChats.length > 0) {
        // this.logger.log('Returning expired cached chats due to error');
        return this.cachedChats;
      }
      throw error;
    }
  }

  private normalizePhone(phone: string): string {
    // Quita todo lo que no sea dígito
    return phone.replace(/[^0-9]/g, '');
  }

  private async captureCustomerInfo(chats: any[], locationId: string) {
    try {
      // Filtrar solo chats individuales (no grupos)
      const individualChats = chats.filter(chat => 
        chat.id.endsWith('@c.us') && 
        !chat.id.includes('-') && 
        !chat.id.includes('@g.us') &&
        !chat.id.includes('@broadcast')
      );

      // this.logger.log(`Processing ${individualChats.length} individual chats for customer info`);

      for (const chat of individualChats) {
        try {
          // Extraer información del cliente desde el nombre del chat y mensajes
          const customerInfo = await this.extractCustomerInfoFromChat(chat);
          if (customerInfo) {
            // Normalizar el teléfono
            const normalizedPhone = this.normalizePhone(customerInfo.phone);
            
            // Verificar si ya existe un cliente con este teléfono
            const existingCustomer = await this.customersService.findByPhone(normalizedPhone, locationId);
            
            if (!existingCustomer) {
              try {
                // Crear nuevo cliente usando el servicio
                const newCustomer = await this.customersService.create({
                  name: customerInfo.name,
                  phone: normalizedPhone,
                  address: customerInfo.address,
                  neighborhood: customerInfo.neighborhood,
                  whatsappId: chat.id,
                  locationId: locationId
                });
                // this.logger.log(`Cliente creado automáticamente: ${newCustomer.name} (${newCustomer.phone})`);
              } catch (createError) {
                // Si hay un error de restricción única, significa que el cliente ya existe
                if (createError.message.includes('Unique constraint failed')) {
                  // this.logger.log(`Cliente ya existe para teléfono ${normalizedPhone}, saltando creación`);
                  
                  // Intentar actualizar el whatsappId si no lo tiene
                  const existingCustomer = await this.customersService.findByPhone(normalizedPhone, locationId);
                  if (existingCustomer && !existingCustomer.whatsappId) {
                    await this.customersService.update(existingCustomer.id, { whatsappId: chat.id });
                    // this.logger.log(`Cliente actualizado con WhatsApp: ${existingCustomer.name} (${existingCustomer.phone})`);
                  }
                } else {
                  // Si es otro tipo de error, registrarlo
                  // this.logger.error(`Error creando cliente para ${normalizedPhone}: ${createError.message}`);
                }
              }
            } else if (!existingCustomer.whatsappId) {
              // Actualizar cliente existente con whatsappId
              await this.customersService.update(existingCustomer.id, { whatsappId: chat.id });
              // this.logger.log(`Cliente actualizado con WhatsApp: ${existingCustomer.name} (${existingCustomer.phone})`);
            } else {
              // this.logger.debug(`Cliente ya existe y tiene WhatsApp ID: ${existingCustomer.name} (${existingCustomer.phone})`);
            }
          }
        } catch (error) {
          // this.logger.error(`Error procesando chat ${chat.id}: ${error.message}`);
        }
      }
    } catch (error) {
      // this.logger.error(`Error capturando información de clientes: ${error.message}`);
    }
  }

  private async extractCustomerInfoFromChat(chat: any) {
    try {
      const phone = chat.id.replace('@c.us', '');
      let name = '';
      let address = '';
      let neighborhood = '';

      // --- NUEVO: Usar pushname si está disponible ---
      if (chat.pushname && chat.pushname.trim()) {
        name = chat.pushname.trim();
        // console.log(`[CONTACT DEBUG] Using pushname for chat ${chat.id}: "${name}"`);
      } else if (chat.name && chat.name !== phone && !chat.name.startsWith('+57')) {
        // --- PARSING FLEXIBLE DEL NOMBRE DEL CHAT ---
        // Separar por comas, guiones o espacios dobles
        const partes = chat.name.split(/[,\-]/).map(p => p.trim()).filter(Boolean);
        const clavesDireccion = ['cra', 'calle', 'carrera', 'cll', 'av', 'avenida', '#', 'apto', 'casa', 'torre', 'piso', 'apartamento', 'unidad', 'edificio', 'manzana', 'mz', 'bloque', 'bq', 'sector', 'conjunto'];
        partes.forEach(parte => {
          const lower = parte.toLowerCase();
          if (clavesDireccion.some(clave => lower.includes(clave))) {
            address = address ? address + ' ' + parte : parte;
          } else if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+( [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*$/.test(parte)) {
            // Si parece nombre propio (una o dos palabras con mayúscula)
            name = name ? name + ' ' + parte : parte;
          } else if (!neighborhood) {
            neighborhood = parte;
          }
        });
        // console.log(`[CONTACT DEBUG] Using parsed name for chat ${chat.id}: "${name}"`);
      }
      // --- FIN NUEVO ---

      // Si no se detectó nombre, usar "Cliente [últimos 4 del teléfono]"
      if (!name) {
        name = `Cliente ${phone.slice(-4)}`;
        // console.log(`[CONTACT DEBUG] Using default name for chat ${chat.id}: "${name}"`);
      }
      // Si no se detectó dirección, usar todo el chatName
      if (!address && chat.name) {
        address = chat.name;
      }

      // --- PARSING DE MENSAJE (mantener lógica anterior) ---
      if (chat.lastMessage) {
        const text = chat.lastMessage.toLowerCase();
        // Buscar patrones de dirección
        if (text.includes('dirección') || text.includes('direccion') || text.includes('vivo en') || text.includes('mi dirección')) {
          const addressMatch = chat.lastMessage.match(/(?:dirección|direccion|vivo en|mi dirección es?)\s*:? 0*([^,.\n]+)/i);
          if (addressMatch) {
            address = addressMatch[1].trim();
          }
        }
        // Buscar patrones de barrio
        if (text.includes('barrio') || text.includes('sector') || text.includes('zona')) {
          const neighborhoodMatch = chat.lastMessage.match(/(?:barrio|sector|zona)\s*:? *([^,.\n]+)/i);
          if (neighborhoodMatch) {
            neighborhood = neighborhoodMatch[1].trim();
          }
        }
      }
      return {
        name,
        phone: this.normalizePhone(phone),
        address: address || null,
        neighborhood: neighborhood || null
      };
    } catch (error) {
      // this.logger.error(`Error extrayendo información del chat ${chat.id}: ${error.message}`);
      return null;
    }
  }

  async getChatMessages(chatId: string) {
    try {
      if (!this.client) {
        throw new Error('WhatsApp client not initialized');
      }

      // Verificar si el chat existe
      const chat = await this.client.getChatById(chatId);
      if (!chat) {
        throw new Error(`Chat not found for ${chatId}`);
      }

      // Obtener los mensajes del chat
      const messages = await chat.fetchMessages({ limit: 50 });
      
      // Obtener los mensajes de la base de datos
      const dbMessages = await this.prisma.whatsappMessage.findMany({
        where: {
          from: chatId,
          locationId: this.locationId
        },
        orderBy: {
          timestamp: 'asc'
        }
      });

      // Convertir los mensajes de WhatsApp a un formato simple
      const whatsappMessages = messages.map(msg => ({
        id: msg.id._serialized,
        body: msg.body,
        from: msg.from,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe
      }));

      // Convertir los mensajes de la base de datos al mismo formato
      const formattedDbMessages = dbMessages.map(msg => ({
        id: msg.id,
        body: msg.body,
        from: msg.from,
        timestamp: new Date(msg.timestamp).getTime() / 1000,
        fromMe: msg.isFromAI
      }));

      // Combinar y ordenar todos los mensajes
      const allMessages = [...whatsappMessages, ...formattedDbMessages]
        .filter((msg, index, self) => 
          index === self.findIndex(m => m.id === msg.id)
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      return allMessages;
    } catch (error) {
      // this.logger.error(`Error getting chat messages: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('WhatsApp client not initialized');
      }

      // Verificar si el chat existe
      const chat = await this.client.getChatById(to);
      if (!chat) {
        throw new Error(`Chat not found for ${to}`);
      }

      // Enviar el mensaje
      await chat.sendMessage(message);
      // this.logger.log(`Message sent to ${to}: ${message}`);
    } catch (error) {
      // this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }

  private updateChatCache(chatId: string, lastMessage: string, timestamp: number) {
    const chatIndex = this.cachedChats.findIndex(chat => chat.id === chatId);
    if (chatIndex !== -1) {
      this.cachedChats[chatIndex] = {
        ...this.cachedChats[chatIndex],
        lastMessage,
        timestamp,
      };
      this.lastChatsUpdate = Date.now();
      // this.logger.debug(`Updated chat cache for ${chatId} with message: "${lastMessage.substring(0, 30)}..."`);
    }
  }

  async toggleAIChat(
    chatId: string,
    locationId: string,
  ): Promise<WhatsappChat> {
    // this.logger.log(`Toggling AI for chat ${chatId} in location ${locationId}`);
    const chat = await this.prisma.whatsappChat.findUnique({
      where: { id: chatId },
    });

    if (chat) {
      const updatedChat = await this.prisma.whatsappChat.update({
        where: { id: chatId },
        data: { aiEnabled: !chat.aiEnabled },
      });
      // this.logger.log(
      //   `AI for chat ${chatId} is now ${updatedChat.aiEnabled ? 'enabled' : 'disabled'}`,
      // );
      return updatedChat;
    } else {
      const newChat = await this.prisma.whatsappChat.create({
        data: {
          id: chatId,
          locationId: locationId,
          aiEnabled: false, // If it doesn't exist, the first toggle disables it
        },
      });
      // this.logger.log(`Created new chat settings for ${chatId}, AI disabled`);
      return newChat;
    }
  }

  private isInitialGreeting(message: string): boolean {
    const initialGreetings = [
      'hola', 'buenos días', 'buenas tardes', 'buenas noches', '¿qué tal?', '¿qué pasa?', '¿qué hay?', '¿qué tal estás?', '¿qué tal estás?'
    ];
    return initialGreetings.some(greeting => message.toLowerCase().includes(greeting));
  }
} 