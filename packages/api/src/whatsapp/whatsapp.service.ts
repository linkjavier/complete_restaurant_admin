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
  private clients: Map<string, Client> = new Map();
  private initializationPromises: Map<string, Promise<void>> = new Map();
  private qrCodes: Map<string, string | null> = new Map();
  private isConnected: Map<string, boolean> = new Map();
  private isAuthenticating: Map<string, boolean> = new Map();
  private cachedChats: Map<string, any[]> = new Map();
  private lastChatsUpdate: Map<string, number> = new Map();
  private readonly CHATS_CACHE_DURATION = 30000; // 30 seconds
  private aiEnabled: boolean = false;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AIGateway))
    private aiGateway: AIGateway,
    private sttService: STTService,
    @Inject(forwardRef(() => CustomersService))
    private customersService: CustomersService,
  ) {}

  private getSessionKey(tenantId: string, locationId: string): string {
    return `${tenantId}:${locationId}`;
  }

  async initializeWhatsApp(tenantId: string, locationId: string) {
    if (!tenantId || !locationId) {
      throw new Error('tenantId and locationId are required for WhatsApp initialization');
    }
    const key = this.getSessionKey(tenantId, locationId);
    if (this.initializationPromises.has(key)) {
      return this.initializationPromises.get(key);
    }
    const promise = (async () => {
      try {
        const authPath = `.wwebjs_auth/${tenantId}/${locationId}`;
        const clientId = `${tenantId}-${locationId}`;
        const sessionExists = await this.checkSessionExists(authPath, clientId);
        let client = this.clients.get(key);
        if (client) {
          try {
            const state = await client.getState();
            if (state === 'CONNECTED') {
              this.isConnected.set(key, true);
              return;
            }
          } catch (error) {
            try { await client.destroy(); } catch {}
            this.clients.delete(key);
          }
        }
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
        client = new Client({
          authStrategy: new LocalAuth({
            clientId,
            dataPath: authPath,
          }),
          puppeteer: puppeteerOptions,
          qrMaxRetries: 5,
          authTimeoutMs: 60000,
          restartOnAuthFail: true,
          takeoverOnConflict: true,
          takeoverTimeoutMs: 10000,
        });
        this.clients.set(key, client);
        this.isConnected.set(key, false);
        this.isAuthenticating.set(key, false);
        this.qrCodes.set(key, null);
        this.cachedChats.set(key, []);
        this.lastChatsUpdate.set(key, 0);
        client.on('qr', async (qr) => {
          try {
            const qrCode = await qrcode.toDataURL(qr);
            this.qrCodes.set(key, qrCode);
            this.eventEmitter.emit(`whatsapp.qr.${key}`, qrCode);
          } catch {
            this.qrCodes.set(key, null);
          }
        });
        client.on('authenticated', () => {
          this.isAuthenticating.set(key, true);
          this.isConnected.set(key, false);
          this.qrCodes.set(key, null);
          setTimeout(() => {
            this.eventEmitter.emit(`whatsapp.authenticated.${key}`);
          }, 1000);
        });
        client.on('ready', async () => {
          this.isConnected.set(key, true);
          this.isAuthenticating.set(key, false);
          this.qrCodes.set(key, null);
          this.eventEmitter.emit(`whatsapp.ready.${key}`);
        });
        client.on('auth_failure', (error) => {
          this.isConnected.set(key, false);
          this.isAuthenticating.set(key, false);
          this.initializationPromises.delete(key);
          this.qrCodes.set(key, null);
          this.eventEmitter.emit(`whatsapp.auth_failure.${key}`, error);
        });
        client.on('disconnected', (reason) => {
          this.isConnected.set(key, false);
          this.isAuthenticating.set(key, false);
          this.initializationPromises.delete(key);
          this.qrCodes.set(key, null);
          this.eventEmitter.emit(`whatsapp.disconnected.${key}`, reason);
        });
        client.on('error', (error) => {
          this.isConnected.set(key, false);
          this.initializationPromises.delete(key);
          this.qrCodes.set(key, null);
          this.eventEmitter.emit(`whatsapp.error.${key}`, error);
        });
        
        // --- NUEVO: Capturar mensajes entrantes y enviarlos al asistente IA ---
        client.on('message', async (message) => {
          try {
            // Solo procesar mensajes de texto que no sean del propio bot
            if (message.type !== 'chat' || message.fromMe) {
              return;
            }
            
            const chatId = message.from;
            const messageText = message.body;
            
            // Verificar si la IA está habilitada para este chat
            const chatSettings = await this.prisma.whatsappChat.findFirst({
              where: { id: chatId, locationId }
            });
            
            // Si no hay configuración, por defecto la IA está habilitada
            const aiEnabled = chatSettings ? chatSettings.aiEnabled : true;
            
            if (!aiEnabled) {
              this.logger.log(`[${key}] IA deshabilitada para chat ${chatId}, ignorando mensaje`);
              return;
            }
            
            this.logger.log(`[${key}] Mensaje entrante de ${chatId}: ${messageText.substring(0, 50)}...`);
            
            // Emitir el mensaje para que el frontend lo muestre
            this.eventEmitter.emit(`whatsapp.message.${key}`, {
              id: message.id._serialized,
              body: messageText,
              from: chatId,
              to: message.to,
              timestamp: message.timestamp,
              fromMe: false,
              type: message.type,
            });
            
            // Enviar el mensaje al asistente IA
            const aiResponse = await this.aiGateway.handleTextInput({
              text: messageText,
              locationId,
              chatType: 'whatsapp',
              chatId
            });
            
            if (aiResponse && aiResponse.trim()) {
              // Enviar la respuesta de vuelta a WhatsApp
              await client.sendMessage(chatId, aiResponse);
              
              // Emitir la respuesta para que el frontend la muestre
              this.eventEmitter.emit(`whatsapp.message.${key}`, {
                id: `ai_${Date.now()}`,
                body: aiResponse,
                from: chatId,
                to: message.to,
                timestamp: Date.now() / 1000,
                fromMe: true,
                type: 'chat',
              });
              
              this.logger.log(`[${key}] Respuesta IA enviada a ${chatId}: ${aiResponse.substring(0, 50)}...`);
            }
          } catch (error) {
            this.logger.error(`[${key}] Error procesando mensaje de WhatsApp:`, error);
          }
        });
        
        // TODO: Adaptar el resto de eventos y lógica de mensajes para usar tenantId/locationId
        setTimeout(() => {
          client.initialize().catch((err) => {
            this.initializationPromises.delete(key);
            this.qrCodes.set(key, null);
            this.eventEmitter.emit(`whatsapp.error.${key}`, err);
          });
        }, 1000);
        // Esperar a que el cliente esté listo
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            const err = new Error('WhatsApp initialization timeout');
            this.eventEmitter.emit(`whatsapp.error.${key}`, err);
            reject(err);
          }, 30000);
          const readyHandler = () => {
            clearTimeout(timeout);
            this.eventEmitter.off(`whatsapp.ready.${key}`, readyHandler);
            resolve(true);
          };
          this.eventEmitter.on(`whatsapp.ready.${key}`, readyHandler);
        });
        const state = await client.getState();
        this.isConnected.set(key, state === 'CONNECTED');
        if (this.isConnected.get(key)) {
          this.eventEmitter.emit(`whatsapp.ready.${key}`);
        }
      } catch (error) {
        this.initializationPromises.delete(key);
        this.qrCodes.set(key, null);
        this.eventEmitter.emit(`whatsapp.error.${key}`, error);
        // No relanzo el error para evitar que crashee el proceso
      }
    })();
    this.initializationPromises.set(key, promise);
    return promise;
  }

  private async checkSessionExists(authPath: string, clientId: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join(process.cwd(), authPath, clientId);
      return fs.existsSync(sessionPath);
    } catch {
      return false;
    }
  }

  async waitForConnection(tenantId: string, locationId: string): Promise<void> {
    const key = this.getSessionKey(tenantId, locationId);
    if (this.isConnected.get(key)) {
      return;
    }

    return new Promise((resolve) => {
      const readyHandler = () => {
        this.eventEmitter.off(`whatsapp.ready.${key}`, readyHandler);
        resolve();
      };
      this.eventEmitter.on(`whatsapp.ready.${key}`, readyHandler);
    });
  }

  async getQRCode(tenantId: string, locationId: string): Promise<string | null> {
    await this.initializeWhatsApp(tenantId, locationId);
    const key = this.getSessionKey(tenantId, locationId);
    return this.qrCodes.get(key);
  }

  async isWhatsAppAuthenticating(tenantId: string, locationId: string): Promise<boolean> {
    await this.initializeWhatsApp(tenantId, locationId);
    const key = this.getSessionKey(tenantId, locationId);
    return this.isAuthenticating.get(key) || false;
  }

  async isWhatsAppConnected(tenantId: string, locationId: string): Promise<boolean> {
    await this.initializeWhatsApp(tenantId, locationId);
    const key = this.getSessionKey(tenantId, locationId);
    return this.isConnected.get(key) || false;
  }

  async getChats(tenantId: string, locationId: string): Promise<any[]> {
    const key = this.getSessionKey(tenantId, locationId);
    try {
      await this.initializeWhatsApp(tenantId, locationId);
      const client = this.clients.get(key);
      if (!client) {
        throw new Error('WhatsApp client not initialized');
      }
      const state = await client.getState();
      if (state !== 'CONNECTED') {
        throw new Error('WhatsApp is not connected');
      }
      // Check if we have cached chats that are still valid
      const now = Date.now();
      if (this.cachedChats.get(key)?.length > 0 && (now - this.lastChatsUpdate.get(key) || 0) < this.CHATS_CACHE_DURATION) {
        return this.cachedChats.get(key) || [];
      }
      const chats = await client.getChats();
      const chatSettings = await this.prisma.whatsappChat.findMany({
        where: {
          locationId: locationId,
          id: { in: chats.map((c: any) => c.id._serialized) },
        },
      });
      const chatSettingsMap = new Map(
        chatSettings.map((cs: any) => [cs.id, cs]),
      );
      const formattedChats = chats.map((chat: any) => {
        const settings = chatSettingsMap.get(chat.id._serialized);
        return {
          id: chat.id._serialized,
          name: chat.name,
          lastMessage: chat.lastMessage?.body || '',
          timestamp: chat.lastMessage?.timestamp || null,
          unreadCount: chat.unreadCount,
          aiEnabled: settings ? settings.aiEnabled : true, // Default to true if no settings found
        };
      });
      await this.captureCustomerInfo(formattedChats, locationId);
      this.cachedChats.set(key, formattedChats);
      this.lastChatsUpdate.set(key, now);
      return formattedChats;
    } catch (error) {
      if (this.cachedChats.get(key)?.length > 0) {
        return this.cachedChats.get(key) || [];
      }
      throw error;
    }
  }

  // ENVÍO DE MENSAJES
  async sendMessage(tenantId: string, locationId: string, to: string, message: string): Promise<void> {
    const key = this.getSessionKey(tenantId, locationId);
    await this.initializeWhatsApp(tenantId, locationId);
    const client = this.clients.get(key);
    if (!client) throw new Error('WhatsApp client not initialized');
    const state = await client.getState();
    if (state !== 'CONNECTED') throw new Error('WhatsApp is not connected');
    await client.sendMessage(to, message);
  }

  // OBTENER MENSAJES DE UN CHAT
  async getChatMessages(tenantId: string, locationId: string, chatId: string): Promise<any[]> {
    const key = this.getSessionKey(tenantId, locationId);
    await this.initializeWhatsApp(tenantId, locationId);
    const client = this.clients.get(key);
    if (!client) throw new Error('WhatsApp client not initialized');
    const state = await client.getState();
    if (state !== 'CONNECTED') throw new Error('WhatsApp is not connected');
    const chat = await client.getChatById(chatId);
    if (!chat) throw new Error('Chat not found');
    const messages = await chat.fetchMessages({ limit: 50 });
    return messages.map((msg: any) => ({
      id: msg.id._serialized,
      body: msg.body,
      from: msg.from,
      to: msg.to,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      type: msg.type,
    }));
  }

  // TOGGLE AI EN UN CHAT
  async toggleAIChat(tenantId: string, locationId: string, chatId: string): Promise<any> {
    // Busca el chat en la base de datos
    let chat = await this.prisma.whatsappChat.findFirst({
      where: { id: chatId, locationId },
    });
    
    // Si no existe, créalo con IA habilitada por defecto
    if (!chat) {
      chat = await this.prisma.whatsappChat.create({
        data: {
          id: chatId,
          locationId,
          aiEnabled: true, // Por defecto habilitado
        },
      });
    }
    
    // Cambia el estado de aiEnabled
    const updated = await this.prisma.whatsappChat.update({
      where: { id: chatId },
      data: { aiEnabled: !chat.aiEnabled },
    });
    
    return updated;
  }

  private normalizePhone(phone: string): string {
    // Quita todo lo que no sea dígito
    return phone.replace(/[^0-9]/g, '');
  }

  private async captureCustomerInfo(chats: any[], locationId: string) {
    try {
      if (!Array.isArray(chats) || chats.length === 0) return;
      // Obtener tenantId a partir de locationId
      const location = await this.prisma.location.findUnique({ where: { id: locationId } });
      if (!location) return;
      const tenantId = location.tenantId;
      // Filtrar solo chats individuales (no grupos)
      const individualChats = (chats as any[]).filter((chat: any) =>
        chat && chat.id && typeof chat.id === 'string' &&
        chat.id.endsWith('@c.us') &&
        !chat.id.includes('-') &&
        !chat.id.includes('@g.us') &&
        !chat.id.includes('@broadcast')
      );
      for (const chat of individualChats) {
        try {
          const customerInfo: any = await this.extractCustomerInfoFromChat(chat);
          if (customerInfo && customerInfo.phone) {
            const normalizedPhone = this.normalizePhone(customerInfo.phone);
            const existingCustomer = await this.customersService.findByPhone(normalizedPhone, locationId, tenantId);
            if (!existingCustomer) {
              try {
                await this.customersService.create({
                  name: customerInfo.name || '',
                  phone: normalizedPhone,
                  email: customerInfo.email || null,
                  locationId: locationId
                }, tenantId);
              } catch (createError) {
                // Si ya existe, no hacer nada
                console.log('Customer already exists:', createError.message);
              }
            }
          }
        } catch (error) {}
      }
    } catch (error) {}
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
        const partes = chat.name.split(/[,\-]/).map((p: string) => p.trim()).filter(Boolean);
        const clavesDireccion = ['cra', 'calle', 'carrera', 'cll', 'av', 'avenida', '#', 'apto', 'casa', 'torre', 'piso', 'apartamento', 'unidad', 'edificio', 'manzana', 'mz', 'bloque', 'bq', 'sector', 'conjunto'];
        partes.forEach((parte: string) => {
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
          const addressMatch = chat.lastMessage.match(/(?:dirección|direccion|vivo en|mi dirección es?)\s*:? 0*([^,.\n]+)/i);
          if (addressMatch) {
            address = addressMatch[1].trim();
          }
        }
        // Buscar patrones de barrio
        if (text.includes('barrio') || text.includes('sector') || text.includes('zona')) {
          const neighborhoodMatch = chat.lastMessage.match(/(?:barrio|sector|zona)\s*:? *([^,.\n]+)/i);
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
}