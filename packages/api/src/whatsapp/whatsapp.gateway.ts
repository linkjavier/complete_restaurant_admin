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
import { CustomerContextService } from '../ai/services/customer-context.service';

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
    private readonly customerContextService: CustomerContextService,
  ) {
    // Suscribirse a eventos de WhatsApp
    this.eventEmitter.on('whatsapp.qr', (qrCode: string) => {
      // this.logger.log('Received QR code event');
      this.broadcastToAll('whatsapp:qr', { qrCode });
    });

    this.eventEmitter.on('whatsapp.ready', () => {
      // this.logger.log('Received ready event');
      this.broadcastToAll('whatsapp:status', { isConnected: true });
    });

    this.eventEmitter.on('whatsapp.authenticated', () => {
      // this.logger.log('Received authenticated event');
      this.broadcastToAll('whatsapp:authenticating', {});
    });

    this.eventEmitter.on('whatsapp.auth_failure', (error: any) => {
      // this.logger.error('Received auth failure event:', error);
      this.broadcastToAll('whatsapp:status', { isConnected: false });
    });

    this.eventEmitter.on('whatsapp.disconnected', (reason: string) => {
      // this.logger.log(`Received disconnected event: ${reason}`);
      this.broadcastToAll('whatsapp:status', { isConnected: false });
    });

    this.eventEmitter.on('whatsapp.chats', (data: { chats: any[] }) => {
      // this.logger.log(`Received chats update event with ${data.chats.length} chats`);
      this.broadcastToAll('whatsapp:chats', data);
    });

    this.eventEmitter.on('whatsapp.message', (message: any) => {
      // this.logger.log('Received message event');
      this.broadcastToAll('whatsapp:message', message);
    });
  }

  private broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  async handleConnection(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    const locationId = client.handshake.query.locationId as string;
    if (!tenantId || !locationId) {
      client.emit('whatsapp:error', { message: 'Faltan tenantId o locationId en la conexión.' });
      client.disconnect();
      return;
    }
    // Suscribirse a eventos específicos de este cliente
    const key = `${tenantId}:${locationId}`;
    const qrListener = (qrCode: string) => {
      this.logger.log(`[${key}] Enviando QR al cliente ${client.id}`);
      client.emit('whatsapp:qr', { qrCode });
    };
    const readyListener = () => {
      this.logger.log(`[${key}] WhatsApp listo para cliente ${client.id}`);
      client.emit('whatsapp:status', { isConnected: true });
    };
    const authenticatingListener = () => {
      this.logger.log(`[${key}] WhatsApp autenticando para cliente ${client.id}`);
      client.emit('whatsapp:authenticating');
    };
    const authFailureListener = (error: any) => {
      this.logger.error(`[${key}] Fallo de autenticación para cliente ${client.id}:`, error);
      client.emit('whatsapp:status', { isConnected: false });
    };
    const disconnectedListener = (reason: string) => {
      this.logger.log(`[${key}] WhatsApp desconectado para cliente ${client.id}: ${reason}`);
      client.emit('whatsapp:status', { isConnected: false });
    };
    const errorListener = (error: any) => {
      this.logger.error(`[${key}] Error de WhatsApp para cliente ${client.id}:`, error);
      client.emit('whatsapp:error', { message: error?.message || 'Error desconocido en WhatsApp', details: error });
    };
    const messageListener = (message: any) => {
      this.logger.log(`[${key}] Mensaje de WhatsApp para cliente ${client.id}:`, message);
      client.emit('whatsapp:message', message);
    };
    this.eventEmitter.on(`whatsapp.qr.${key}`, qrListener);
    this.eventEmitter.on(`whatsapp.ready.${key}`, readyListener);
    this.eventEmitter.on(`whatsapp.authenticated.${key}`, authenticatingListener);
    this.eventEmitter.on(`whatsapp.auth_failure.${key}`, authFailureListener);
    this.eventEmitter.on(`whatsapp.disconnected.${key}`, disconnectedListener);
    this.eventEmitter.on(`whatsapp.error.${key}`, errorListener);
    this.eventEmitter.on(`whatsapp.message.${key}`, messageListener);
    // Guardar listeners para quitarlos al desconectar
    (client as any)._whatsappListeners = [
      [`whatsapp.qr.${key}`, qrListener],
      [`whatsapp.ready.${key}`, readyListener],
      [`whatsapp.authenticated.${key}`, authenticatingListener],
      [`whatsapp.auth_failure.${key}`, authFailureListener],
      [`whatsapp.disconnected.${key}`, disconnectedListener],
      [`whatsapp.error.${key}`, errorListener],
      [`whatsapp.message.${key}`, messageListener],
    ];
    this.connectedClients.set(client.id, client);
    await this.whatsappService.initializeWhatsApp(tenantId, locationId);
    const isConnected = await this.whatsappService.isWhatsAppConnected(tenantId, locationId);
    const isAuthenticating = await this.whatsappService.isWhatsAppAuthenticating(tenantId, locationId);
    if (isConnected) {
      client.emit('whatsapp:status', { isConnected: true });
      try {
        const chats = await this.whatsappService.getChats(tenantId, locationId);
        client.emit('whatsapp:chats', { chats });
      } catch (error) {
        client.emit('whatsapp:error', { message: 'Error getting initial chats' });
      }
    } else if (isAuthenticating) {
      client.emit('whatsapp:authenticating');
    } else {
      client.emit('whatsapp:status', { isConnected: false });
      const qrCode = await this.whatsappService.getQRCode(tenantId, locationId);
      if (qrCode) {
        client.emit('whatsapp:qr', { qrCode });
      }
    }
    // --- SALUDO PERSONALIZADO ---
    try {
      const chatId = client.handshake.query.chatId as string;
      const location = await this.whatsappService['prisma'].location.findUnique({ where: { id: locationId } });
      const tenantIdFromLocation = location ? location.tenantId : undefined;
      const customerContext = await this.customerContextService.getCustomerContext(chatId, locationId, tenantIdFromLocation);
      const cleanName = customerContext && customerContext.name ? customerContext.name.trim() : '';
      let welcomeMessage = '';
      if (cleanName.length > 0) {
        welcomeMessage = `👋 ¡Hola, *${cleanName}*! Soy tu asistente personal. 😊\n\n🍽️ ¿En qué puedo ayudarte hoy? ¿Te gustaría ver el menú o tienes un antojo especial?`;
      } else {
        welcomeMessage = `👋 ¡Hola! Soy tu asistente personal. 😊\n\n🍽️ ¿En qué puedo ayudarte hoy? ¿Te gustaría ver el menú o tienes un antojo especial?`;
      }
      client.emit('whatsapp:welcome', { message: welcomeMessage });
    } catch (err) {
      this.logger.error('Error enviando saludo personalizado:', err);
    }
  }

  handleDisconnect(client: Socket) {
    // this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
    // Remover listeners específicos de este cliente
    if ((client as any)._whatsappListeners) {
      for (const [event, listener] of (client as any)._whatsappListeners) {
        this.eventEmitter.off(event, listener);
      }
    }
  }

  private getTenantAndLocation(client: Socket, data?: any): { tenantId: string, locationId: string } {
    // Prefer message body, fallback to handshake query
    const locationId = (data && data.locationId) || client.handshake.query.locationId;
    const tenantId = (data && data.tenantId) || client.handshake.query.tenantId;
    if (!tenantId || !locationId) throw new Error('tenantId and locationId are required');
    return { tenantId, locationId };
  }

  @SubscribeMessage('whatsapp:getStatus')
  async handleGetStatus(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const { tenantId, locationId } = this.getTenantAndLocation(client, data);
    await this.whatsappService.initializeWhatsApp(tenantId, locationId);
    const isConnected = await this.whatsappService.isWhatsAppConnected(tenantId, locationId);
    const isAuthenticating = await this.whatsappService.isWhatsAppAuthenticating(tenantId, locationId);
    if (isConnected) {
      client.emit('whatsapp:status', { isConnected: true });
      try {
        const chats = await this.whatsappService.getChats(tenantId, locationId);
        client.emit('whatsapp:chats', { chats });
      } catch (error) {
        client.emit('whatsapp:error', { message: 'Error getting initial chats' });
      }
    } else if (isAuthenticating) {
      client.emit('whatsapp:authenticating');
    } else {
      client.emit('whatsapp:status', { isConnected: false });
      const qrCode = await this.whatsappService.getQRCode(tenantId, locationId);
      if (qrCode) {
        client.emit('whatsapp:qr', { qrCode });
      }
    }
  }

  @SubscribeMessage('whatsapp:getChats')
  async handleGetChats(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const { tenantId, locationId } = this.getTenantAndLocation(client, data);
    const isConnected = await this.whatsappService.isWhatsAppConnected(tenantId, locationId);
    if (!isConnected) throw new Error('WhatsApp is not connected');
    const chats = await this.whatsappService.getChats(tenantId, locationId);
    client.emit('whatsapp:chats', { chats });
  }

  @SubscribeMessage('whatsapp:getQR')
  async handleGetQR(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const { tenantId, locationId } = this.getTenantAndLocation(client, data);
    const qrCode = await this.whatsappService.getQRCode(tenantId, locationId);
    if (qrCode) {
      client.emit('whatsapp:qr', { qrCode });
    } else {
      client.emit('whatsapp:error', { message: 'No QR code available' });
    }
  }

  @SubscribeMessage('whatsapp:getChatMessages')
  async handleGetChatMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string; locationId: string; chatId: string },
  ) {
    const { tenantId, locationId } = this.getTenantAndLocation(client, data);
    const isConnected = await this.whatsappService.isWhatsAppConnected(tenantId, locationId);
    if (!isConnected) throw new Error('WhatsApp is not connected');
    const messages = await this.whatsappService.getChatMessages(tenantId, locationId, data.chatId);
    client.emit('whatsapp:chatMessages', { messages });
  }

  @SubscribeMessage('whatsapp:toggleAIChat')
  async handleToggleAIChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string; locationId: string; chatId: string },
  ) {
    const { tenantId, locationId } = this.getTenantAndLocation(client, data);
    const updatedChat = await this.whatsappService.toggleAIChat(tenantId, locationId, data.chatId);
    client.emit('whatsapp:chatUpdated', updatedChat);
    this.broadcastToAll('whatsapp:chatUpdated', updatedChat);
  }

  @SubscribeMessage('whatsapp:sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string; locationId: string; to: string; message: string },
  ) {
    const { tenantId, locationId } = this.getTenantAndLocation(client, data);
    const isConnected = await this.whatsappService.isWhatsAppConnected(tenantId, locationId);
    if (!isConnected) throw new Error('WhatsApp is not connected');
    await this.whatsappService.sendMessage(tenantId, locationId, data.to, data.message);
    client.emit('whatsapp:message', {
      from: data.to,
      body: data.message,
      timestamp: Date.now() / 1000,
      fromMe: true,
    });
  }
} 