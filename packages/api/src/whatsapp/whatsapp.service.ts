import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
  ) {
    this.initializeWhatsApp();
  }

  private async initializeWhatsApp() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        this.client = new Client({
          authStrategy: new LocalAuth(),
          puppeteer: {
            args: ['--no-sandbox'],
          },
        });

        this.client.on('qr', async (qr) => {
          this.qrCode = await qrcode.toDataURL(qr);
          this.eventEmitter.emit('whatsapp.qr', this.qrCode);
        });

        this.client.on('ready', async () => {
          this.isConnected = true;
          this.qrCode = null;
          
          // Get the first location ID when WhatsApp is ready
          if (!this.locationId) {
            const firstLocation = await this.prisma.location.findFirst();
            if (firstLocation) {
              this.locationId = firstLocation.id;
            } else {
              this.logger.error('No location found in the database');
            }
          }
          
          this.eventEmitter.emit('whatsapp.ready');
          this.logger.log('WhatsApp client is ready!');
        });

        this.client.on('message', async (message) => {
          if (message.fromMe) return;

          if (!this.locationId) {
            this.logger.error('No location ID available for saving message');
            return;
          }

          // Save message to database
          await this.prisma.whatsappMessage.create({
            data: {
              from: message.from,
              body: message.body,
              timestamp: new Date(message.timestamp * 1000),
              locationId: this.locationId,
            },
          });

          // Emit message event for AI processing
          this.eventEmitter.emit('whatsapp.message', {
            from: message.from,
            body: message.body,
            timestamp: message.timestamp,
          });
        });

        await this.client.initialize();
      } catch (error) {
        this.logger.error(`Error initializing WhatsApp: ${error.message}`);
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
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
    await this.initializeWhatsApp();
    return this.isConnected;
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
} 