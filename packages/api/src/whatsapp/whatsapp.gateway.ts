import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
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
      // Obtener y enviar chats cuando WhatsApp está listo
      this.whatsappService.getChats().then(chats => {
        this.logger.log(`Sending ${chats.length} chats after ready event`);
        this.broadcastToAll('whatsapp:chats', { chats });
      }).catch(error => {
        this.logger.error(`Error getting chats after ready: ${error.message}`);
      });
    });

    this.eventEmitter.on('whatsapp.authenticated', () => {
      this.logger.log('Received authenticated event');
      this.broadcastToAll('whatsapp:status', { isConnected: true });
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
      this.logger.log(`Received chats event with ${data.chats.length} chats`);
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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Enviar estado actual de WhatsApp al cliente que se conecta
    this.whatsappService.isWhatsAppConnected().then(isConnected => {
      this.logger.log(`Sending initial WhatsApp status: ${isConnected}`);
      client.emit('whatsapp:status', { isConnected });
      
      if (isConnected) {
        this.logger.log('WhatsApp is connected, sending initial chats');
        this.whatsappService.getChats().then(chats => {
          this.logger.log(`Sending ${chats.length} initial chats`);
          client.emit('whatsapp:chats', { chats });
        }).catch(error => {
          this.logger.error(`Error getting initial chats: ${error.message}`);
        });
      } else {
        // Si no está conectado, intentar inicializar WhatsApp
        this.logger.log('WhatsApp is not connected, attempting to initialize...');
        this.whatsappService.initializeWhatsApp().then(() => {
          this.logger.log('WhatsApp initialization completed, checking status again...');
          return this.whatsappService.isWhatsAppConnected();
        }).then(isConnected => {
          this.logger.log(`WhatsApp status after initialization: ${isConnected}`);
          client.emit('whatsapp:status', { isConnected });
          
          if (isConnected) {
            return this.whatsappService.getChats();
          }
          return [];
        }).then(chats => {
          if (chats.length > 0) {
            this.logger.log(`Sending ${chats.length} chats after initialization`);
            client.emit('whatsapp:chats', { chats });
          }
        }).catch(error => {
          this.logger.error(`Error during WhatsApp initialization: ${error.message}`);
          client.emit('whatsapp:status', { isConnected: false });
        });
      }
    }).catch(error => {
      this.logger.error(`Error checking WhatsApp status: ${error.message}`);
      client.emit('whatsapp:status', { isConnected: false });
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('whatsapp:getStatus')
  async handleGetStatus(@ConnectedSocket() client: Socket) {
    this.logger.log('Client requested WhatsApp status');
    try {
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      this.logger.log(`Sending WhatsApp status: ${isConnected}`);
      client.emit('whatsapp:status', { isConnected });
      
      // Si está conectado, enviar los chats inmediatamente
      if (isConnected) {
        this.logger.log('WhatsApp is connected, sending chats...');
        const chats = await this.whatsappService.getChats();
        client.emit('whatsapp:chats', { chats });
      }
    } catch (error) {
      this.logger.error(`Error getting WhatsApp status: ${error.message}`);
      client.emit('whatsapp:status', { isConnected: false });
    }
  }

  @SubscribeMessage('whatsapp:getChats')
  async handleGetChats(@ConnectedSocket() client: Socket) {
    this.logger.log('Client requested WhatsApp chats');
    try {
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      if (!isConnected) {
        this.logger.error('Cannot get chats: WhatsApp is not connected');
        client.emit('whatsapp:error', { message: 'WhatsApp is not connected' });
        return;
      }

      const chats = await this.whatsappService.getChats();
      this.logger.log(`Sending ${chats.length} chats to client`);
      client.emit('whatsapp:chats', { chats });
    } catch (error) {
      this.logger.error(`Error getting WhatsApp chats: ${error.message}`);
      client.emit('whatsapp:error', { message: 'Error getting chats' });
    }
  }

  @SubscribeMessage('whatsapp:getQR')
  async handleGetQR(@ConnectedSocket() client: Socket) {
    this.logger.log('Client requested QR code');
    try {
      const qrCode = await this.whatsappService.getQRCode();
      if (qrCode) {
        client.emit('whatsapp:qr', { qrCode });
      } else {
        client.emit('whatsapp:error', { message: 'No QR code available' });
      }
    } catch (error) {
      this.logger.error(`Error getting QR code: ${error.message}`);
      client.emit('whatsapp:error', { message: 'Error getting QR code' });
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