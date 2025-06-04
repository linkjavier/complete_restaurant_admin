import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WhatsappService } from './whatsapp.service';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsappGateway.name);
  private connectedClients: Map<string, Socket> = new Map();

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Subscribe to WhatsApp events
    this.eventEmitter.on('whatsapp.qr', (qrCode: string) => {
      this.server.emit('whatsapp:qr', { qrCode });
    });

    this.eventEmitter.on('whatsapp.ready', () => {
      this.server.emit('whatsapp:ready');
    });

    this.eventEmitter.on('whatsapp.message', (message: any) => {
      this.server.emit('whatsapp:message', message);
    });
  }

  async handleConnection(client: Socket) {
    this.connectedClients.set(client.id, client);
    this.logger.log(`Client connected: ${client.id}`);

    // Send initial state
    const isConnected = await this.whatsappService.isWhatsAppConnected();
    client.emit('whatsapp:status', { isConnected });

    if (!isConnected) {
      const qrCode = await this.whatsappService.getQRCode();
      if (qrCode) {
        client.emit('whatsapp:qr', { qrCode });
      }
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('whatsapp:getQR')
  async handleGetQR(client: Socket) {
    const qrCode = await this.whatsappService.getQRCode();
    if (qrCode) {
      client.emit('whatsapp:qr', { qrCode });
    }
  }

  @SubscribeMessage('whatsapp:getChats')
  async handleGetChats(client: Socket) {
    this.logger.log('Client requested WhatsApp chats');
    try {
      const chats = await this.whatsappService.getChats();
      this.logger.log(`Sending ${chats.length} chats to client`);
      client.emit('whatsapp:chats', { chats });
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chats: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }

  @SubscribeMessage('whatsapp:getChatMessages')
  async handleGetChatMessages(client: Socket, payload: { chatId: string }) {
    this.logger.log(`Client requested messages for chat ${payload.chatId}`);
    try {
      const messages = await this.whatsappService.getChatMessages(payload.chatId);
      this.logger.log(`Sending ${messages.length} messages to client`);
      client.emit('whatsapp:chatMessages', { messages });
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chat messages: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }

  @SubscribeMessage('whatsapp:sendMessage')
  async handleSendMessage(client: Socket, payload: { to: string; message: string }) {
    this.logger.log(`Client sending message to ${payload.to}`);
    try {
      await this.whatsappService.sendMessage(payload.to, payload.message);
      this.logger.log('Message sent successfully');
      client.emit('whatsapp:messageSent', { success: true });
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }
} 