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
    this.whatsappService.isWhatsAppConnected().then(async (isConnected) => {
      this.logger.log(`Sending initial WhatsApp status: ${isConnected}`);
      client.emit('whatsapp:status', { isConnected });
      
      if (isConnected) {
        this.logger.log('WhatsApp is connected, sending initial chats');
        try {
          const chats = await this.whatsappService.getChats();
          this.logger.log(`Sending ${chats.length} initial chats`);
          client.emit('whatsapp:chats', { chats });
        } catch (error) {
          this.logger.error(`Error getting initial chats: ${error.message}`);
          client.emit('whatsapp:error', { message: 'Error getting initial chats' });
        }
      } else {
        // Si no está conectado, intentar inicializar WhatsApp
        this.logger.log('WhatsApp is not connected, attempting to initialize...');
        try {
          await this.whatsappService.initializeWhatsApp();
          // Verificar el estado después de la inicialización
          const newStatus = await this.whatsappService.isWhatsAppConnected();
          this.logger.log(`WhatsApp status after initialization: ${newStatus}`);
          client.emit('whatsapp:status', { isConnected: newStatus });
          
          if (newStatus) {
            const chats = await this.whatsappService.getChats();
            this.logger.log(`Sending ${chats.length} chats after initialization`);
            client.emit('whatsapp:chats', { chats });
          } else {
            // Si aún no está conectado, solicitar código QR
            const qrCode = await this.whatsappService.getQRCode();
            if (qrCode) {
              client.emit('whatsapp:qr', { qrCode });
            } else {
              client.emit('whatsapp:error', { message: 'No QR code available' });
            }
          }
        } catch (error) {
          this.logger.error(`Error during WhatsApp initialization: ${error.message}`);
          client.emit('whatsapp:status', { isConnected: false });
          client.emit('whatsapp:error', { message: 'Error initializing WhatsApp' });
        }
      }
    }).catch(error => {
      this.logger.error(`Error checking WhatsApp status: ${error.message}`);
      client.emit('whatsapp:status', { isConnected: false });
      client.emit('whatsapp:error', { message: 'Error checking WhatsApp status' });
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('whatsapp:getStatus')
  async handleGetStatus(@ConnectedSocket() client: Socket) {
    try {
      const isConnected = await this.whatsappService.isWhatsAppConnected();
      this.logger.log(`Sending WhatsApp status: ${isConnected}`);
      client.emit('whatsapp:status', { isConnected });

      if (isConnected) {
        // Si WhatsApp está conectado, enviar los chats inmediatamente
        const chats = await this.whatsappService.getChats();
        this.logger.log(`Sending ${chats.length} chats after status check`);
        client.emit('whatsapp:chats', { chats });
      } else {
        // Si no está conectado, intentar inicializar
        try {
          await this.whatsappService.initializeWhatsApp();
          const newStatus = await this.whatsappService.isWhatsAppConnected();
          this.logger.log(`WhatsApp status after initialization: ${newStatus}`);
          client.emit('whatsapp:status', { isConnected: newStatus });
          
          if (newStatus) {
            const chats = await this.whatsappService.getChats();
            this.logger.log(`Sending ${chats.length} chats after initialization`);
            client.emit('whatsapp:chats', { chats });
          } else {
            // Si aún no está conectado, solicitar código QR
            const qrCode = await this.whatsappService.getQRCode();
            if (qrCode) {
              client.emit('whatsapp:qr', { qrCode });
            } else {
              client.emit('whatsapp:error', { message: 'No QR code available' });
            }
          }
        } catch (error) {
          this.logger.error(`Error during WhatsApp initialization: ${error.message}`);
          client.emit('whatsapp:status', { isConnected: false });
          client.emit('whatsapp:error', { message: 'Error initializing WhatsApp' });
        }
      }
    } catch (error) {
      this.logger.error(`Error getting WhatsApp status: ${error.message}`);
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