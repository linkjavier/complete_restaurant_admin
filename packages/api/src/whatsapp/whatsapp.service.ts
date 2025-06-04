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

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {
    this.initializeWhatsApp();
  }

  private async initializeWhatsApp() {
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
          timestamp: new Date(message.timestamp * 1000), // Convert Unix timestamp to Date
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
  }

  async getQRCode(): Promise<string | null> {
    return this.qrCode;
  }

  async isWhatsAppConnected(): Promise<boolean> {
    return this.isConnected;
  }

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      await this.client.sendMessage(to, message);
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error.message}`);
      throw error;
    }
  }

  async getChats(): Promise<any[]> {
    if (!this.isConnected) {
      this.logger.error('WhatsApp client is not connected');
      throw new Error('WhatsApp client is not connected');
    }

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
    if (!this.isConnected) {
      this.logger.error('WhatsApp client is not connected');
      throw new Error('WhatsApp client is not connected');
    }

    try {
      this.logger.log(`Fetching messages for chat ${chatId}...`);
      const chat = await this.client.getChatById(chatId);
      if (!chat) {
        this.logger.error(`Chat ${chatId} not found`);
        throw new Error(`Chat ${chatId} not found`);
      }

      const messages = await chat.fetchMessages({ limit: 50 });
      this.logger.log(`Found ${messages.length} messages for chat ${chatId}`);
      
      const formattedMessages = messages.map(message => {
        const formatted = {
          id: message.id._serialized,
          from: message.from,
          body: message.body,
          timestamp: message.timestamp,
          fromMe: message.fromMe,
        };
        this.logger.debug(`Formatted message: ${JSON.stringify(formatted)}`);
        return formatted;
      });

      return formattedMessages;
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chat messages: ${error.message}`);
      throw error;
    }
  }
} 