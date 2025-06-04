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
    // Suscribirse a eventos de WhatsApp
    this.eventEmitter.on('whatsapp.qr', (qrCode: string) => {
      this.broadcastToAll('whatsapp:qr', { qrCode });
    });

    this.eventEmitter.on('whatsapp.ready', () => {
      this.broadcastToAll('whatsapp:status', { isConnected: true });
    });

    this.eventEmitter.on('whatsapp.message', (message: any) => {
      this.broadcastToAll('whatsapp:message', message);
    });
  }

  private broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Enviar estado actual de WhatsApp al cliente que se conecta
    this.whatsappService.isWhatsAppConnected().then(isConnected => {
      client.emit('whatsapp:status', { isConnected });
      if (isConnected) {
        this.handleGetChats(client);
      }
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('whatsapp:getQR')
  async handleGetQR(client: Socket) {
    try {
      const qrCode = await this.whatsappService.getQRCode();
      client.emit('whatsapp:qr', { qrCode });
    } catch (error) {
      this.logger.error(`Error getting QR code: ${error.message}`);
      client.emit('whatsapp:error', { message: 'Error getting QR code' });
    }
  }

  @SubscribeMessage('whatsapp:getChats')
  async handleGetChats(client: Socket) {
    try {
      this.logger.log('Client requested WhatsApp chats');
      const chats = await this.whatsappService.getChats();
      client.emit('whatsapp:chats', { chats });
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chats: ${error.message}`);
      client.emit('whatsapp:error', { message: 'Error getting WhatsApp chats' });
    }
  }

  @SubscribeMessage('whatsapp:getChatMessages')
  async handleGetChatMessages(client: Socket, { chatId }: { chatId: string }) {
    try {
      this.logger.log(`Client requested messages for chat ${chatId}`);
      const messages = await this.whatsappService.getChatMessages(chatId);
      client.emit('whatsapp:chatMessages', { messages });
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chat messages: ${error.message}`);
      client.emit('whatsapp:error', { message: 'Error getting WhatsApp chat messages' });
    }
  }

  @SubscribeMessage('whatsapp:sendMessage')
  async handleSendMessage(client: Socket, { to, message }: { to: string; message: string }) {
    try {
      await this.whatsappService.sendMessage(to, message);
      client.emit('whatsapp:messageSent', { success: true });
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error.message}`);
      client.emit('whatsapp:error', { message: 'Error sending WhatsApp message' });
    }
  }
} 