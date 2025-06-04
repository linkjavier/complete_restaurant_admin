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

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AIGateway))
    private aiGateway: AIGateway,
  ) {
    this.initializeWhatsApp();
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
          }
        }

        this.client = new Client({
          authStrategy: new LocalAuth({
            clientId: 'restaurant-admin',
            dataPath: authPath,
          }),
          puppeteer: {
            args: ['--no-sandbox'],
            headless: true,
          },
          qrMaxRetries: 5,
          authTimeoutMs: 60000,
        });

        this.client.on('qr', async (qr) => {
          this.logger.log('Received QR code');
          this.qrCode = await qrcode.toDataURL(qr);
          this.eventEmitter.emit('whatsapp.qr', this.qrCode);
        });

        this.client.on('authenticated', () => {
          this.logger.log('WhatsApp client is authenticated');
          this.isConnected = true;
          this.eventEmitter.emit('whatsapp.authenticated');
        });

        this.client.on('ready', async () => {
          this.logger.log('WhatsApp client is ready!');
          this.isConnected = true;
          this.qrCode = null;
          
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
          this.eventEmitter.emit('whatsapp.auth_failure', error);
        });

        this.client.on('disconnected', (reason) => {
          this.logger.log(`WhatsApp client disconnected: ${reason}`);
          this.isConnected = false;
          this.initializationPromise = null;
          this.eventEmitter.emit('whatsapp.disconnected', reason);
        });

        this.client.on('message', async (message) => {
          if (message.fromMe) return;

          if (!this.locationId) {
            this.logger.error('No location ID available for saving message');
            return;
          }

          try {
            // Save incoming message to database
            await this.prisma.whatsappMessage.create({
              data: {
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

            // Process message with AI
            const aiResponse = await this.aiGateway.handleTextInput({
              text: message.body,
              locationId: this.locationId,
            });
            
            // Save AI response to database
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

            // Send AI response back to WhatsApp
            await this.client.sendMessage(message.from, aiResponse);

            // Emit events for frontend updates
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

          } catch (error) {
            this.logger.error(`Error processing WhatsApp message: ${error.message}`);
            // Send error message to user
            await this.client.sendMessage(
              message.from,
              'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.'
            );
          }
        });

        await this.client.initialize();
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
    await this.initializeWhatsApp();
    return this.qrCode;
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
          const chats = await this.client.getChats();
          this.logger.log(`Successfully retrieved ${chats.length} chats`);
          return true;
        }
        
        return false;
      } catch (error) {
        this.logger.error(`Error getting WhatsApp state: ${error.message}`);
        this.isConnected = false;
        return false;
      }
    } catch (error) {
      this.logger.error(`Error checking WhatsApp connection: ${error.message}`);
      return false;
    }
  }

  async getChats(): Promise<any[]> {
    await this.initializeWhatsApp();
    await this.waitForConnection();

    try {
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

      this.logger.log('Emitting whatsapp:chats event with formatted chats');
      this.eventEmitter.emit('whatsapp:chats', { chats: formattedChats });

      return formattedChats;
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chats: ${error.message}`);
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

      // Combinar y formatear los mensajes
      const allMessages = [
        ...dbMessages.map(msg => ({
          id: msg.id,
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp.getTime() / 1000,
          fromMe: false,
        })),
        ...whatsappMessages.map(message => ({
          id: message.id._serialized,
          from: message.from,
          body: message.body,
          timestamp: message.timestamp,
          fromMe: message.fromMe,
        })),
      ];

      // Ordenar por timestamp
      allMessages.sort((a, b) => a.timestamp - b.timestamp);

      return allMessages;
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