import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
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
    // Suscribirse a eventos de WhatsApp
    this.eventEmitter.on('whatsapp.qr', (qrCode: string) => {
      this.logger.log('Received QR code event');
      this.broadcastToAll('whatsapp:qr', { qrCode });
    });

    this.eventEmitter.on('whatsapp.ready', () => {
      this.logger.log('Received ready event');
      this.broadcastToAll('whatsapp:status', { isConnected: true });
    });

    this.eventEmitter.on('whatsapp.authenticated', () => {
      this.logger.log('Received authenticated event');
      this.broadcastToAll('whatsapp:authenticating', {});
    });

    this.eventEmitter.on('whatsapp.auth_failure', (error: any) => {
      this.logger.error('Received auth failure event:', error);
      this.broadcastToAll('whatsapp:status', { isConnected: false });
    });

    this.eventEmitter.on('whatsapp.disconnected', (reason: string) => {
      this.logger.log(`Received disconnected event: ${reason}`);
      this.broadcastToAll('whatsapp:status', { isConnected: false });
    });

    this.eventEmitter.on('whatsapp.chats', (data: { chats: any[] }) => {
      this.logger.log(`Received chats update event with ${data.chats.length} chats`);
      this.broadcastToAll('whatsapp:chats', data);
    });

    this.eventEmitter.on('whatsapp.message', (message: any) => {
      this.logger.log('Received message event');
      this.broadcastToAll('whatsapp:message', message);
    });
  }

  private broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
    await this.sendStatus(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('whatsapp:getStatus')
  async handleGetStatus(@ConnectedSocket() client: Socket) {
    await this.sendStatus(client);
  }

  private async sendStatus(client: Socket) {
    try {
      await this.whatsappService.initializeWhatsApp();
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      const isAuthenticating = await this.whatsappService.isWhatsAppAuthenticating();

      this.logger.log(`Sending status - Connected: ${isConnected}, Authenticating: ${isAuthenticating}`);

      if (isConnected) {
        client.emit('whatsapp:status', { isConnected: true });
        this.logger.log('WhatsApp is connected, sending initial chats');
        try {
          const chats = await this.whatsappService.getChats();
          this.logger.log(`Sending ${chats.length} initial chats`);
          client.emit('whatsapp:chats', { chats });
        } catch (error) {
          this.logger.error(`Error getting initial chats: ${error.message}`);
          client.emit('whatsapp:error', { message: 'Error getting initial chats' });
        }
      } else if (isAuthenticating) {
        this.logger.log('WhatsApp is authenticating');
        client.emit('whatsapp:authenticating');
      } else {
        this.logger.log('WhatsApp is not connected, requesting QR code');
        client.emit('whatsapp:status', { isConnected: false });
        const qrCode = await this.whatsappService.getQRCode();
        if (qrCode) {
          client.emit('whatsapp:qr', { qrCode });
        } else {
          this.logger.log('No QR code available, client will wait.');
        }
      }
    } catch (error) {
      this.logger.error(`Error sending WhatsApp status: ${error.message}`);
      client.emit('whatsapp:status', { isConnected: false });
      client.emit('whatsapp:error', { message: 'Error getting WhatsApp status' });
    }
  }

  @SubscribeMessage('whatsapp:getChats')
  async handleGetChats(@ConnectedSocket() client: Socket) {
    try {
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      if (!isConnected) {
        this.logger.error('Cannot get chats: WhatsApp is not connected');
        throw new Error('WhatsApp is not connected');
      }

      const chats = await this.whatsappService.getChats();
      this.logger.log(`Sending ${chats.length} chats to client`);
      client.emit('whatsapp:chats', { chats });
    } catch (error) {
      this.logger.error(`Error getting chats: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }

  @SubscribeMessage('whatsapp:getQR')
  async handleGetQR(@ConnectedSocket() client: Socket) {
    try {
      this.logger.log('Client requested QR code');
      const qrCode = await this.whatsappService.getQRCode();
      if (qrCode) {
        client.emit('whatsapp:qr', { qrCode });
      } else {
        client.emit('whatsapp:error', { message: 'No QR code available' });
      }
    } catch (error) {
      this.logger.error(`Error getting QR code: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }

  @SubscribeMessage('whatsapp:getChatMessages')
  async handleGetChatMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    try {
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      if (!isConnected) {
        throw new Error('WhatsApp is not connected');
      }

      const messages = await this.whatsappService.getChatMessages(data.chatId);
      client.emit('whatsapp:chatMessages', { messages });
    } catch (error) {
      this.logger.error(`Error getting chat messages: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }

  @SubscribeMessage('whatsapp:toggleAIChat')
  async handleToggleAIChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; locationId: string },
  ) {
    try {
      this.logger.log(
        `Received toggle AI request for chat ${data.chatId} in location ${data.locationId}`,
      );
      const updatedChat = await this.whatsappService.toggleAIChat(
        data.chatId,
        data.locationId,
      );
      // Emit back to the calling client
      client.emit('whatsapp:chatUpdated', updatedChat);
      // Broadcast to all clients to update the chat list
      this.broadcastToAll('whatsapp:chatUpdated', updatedChat);
    } catch (error) {
      this.logger.error(`Error toggling AI for chat: ${error.message}`);
      client.emit('whatsapp:error', {
        message: 'Error toggling AI for chat',
        details: error.message,
      });
    }
  }

  @SubscribeMessage('whatsapp:sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; message: string },
  ) {
    try {
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      if (!isConnected) {
        throw new Error('WhatsApp is not connected');
      }

      await this.whatsappService.sendMessage(data.to, data.message);
      client.emit('whatsapp:message', {
        from: data.to,
        body: data.message,
        timestamp: Date.now() / 1000,
        fromMe: true,
      });
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('whatsapp:error', { message: error.message });
    }
  }
} 