import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { Inject, forwardRef } from '@nestjs/common';
import { restaurantAssistantFunctions } from './functions/restaurant-assistant.functions';
import { adminAssistantFunctions } from './functions/admin-assistant.functions';
import { STTService } from '../stt/stt.service';
import { SettingsService } from '../settings/settings.service';
import { ConversationService, ConversationContext } from './services/conversation.service';
import { OrderStateService } from './services/order-state.service';
import { CustomerContextService } from './services/customer-context.service';
import { MessageHandlerService } from './services/message-handler.service';
import { MenuHandlerService } from './services/menu-handler.service';
import { OrderHandlerService } from './services/order-handler.service';
import { FunctionExecutorService } from './services/function-executor.service';
import { NLPService } from './services/nlp.service';
import { LocationsService } from '../locations/locations.service';

function asChatType(value: any): 'whatsapp' | 'ai' | 'admin' {
  if (value === 'whatsapp' || value === 'ai' || value === 'admin') return value;
  return 'ai';
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AIGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private openai: OpenAI;
  private locationIds: Map<string, string> = new Map();
  private chatTypes: Map<string, 'whatsapp' | 'ai' | 'admin'> = new Map();
  private orderState: Map<string, { items: any[]; customerData: any; step: string; validatedOrderData?: any }> = new Map();

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private sttService: STTService,
    private conversationService: ConversationService,
    private orderStateService: OrderStateService,
    private customerContextService: CustomerContextService,
    private messageHandler: MessageHandlerService,
    private menuHandler: MenuHandlerService,
    private orderHandler: OrderHandlerService,
    private functionExecutor: FunctionExecutorService,
    private locationsService: LocationsService
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({ apiKey });
  }

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const locationId = client.handshake.query.locationId as string;
    const chatType = client.handshake.query.chatType as 'whatsapp' | 'ai' | 'admin';
    const chatId = client.handshake.query.chatId as string;

    if (!locationId || !chatType || !chatId) {
      console.error(`Missing required parameters for client ${client.id}`);
      client.emit('error', {
        message: 'Missing required parameters',
        details: 'Location ID, chat type, and chat ID are required to connect'
      });
      client.disconnect();
      return;
    }

    console.log(`Client ${client.id} connected with locationId: ${locationId}, chatType: ${chatType}, chatId: ${chatId}`);
    this.locationIds.set(client.id, locationId);
    this.chatTypes.set(client.id, chatType);
    this.orderStateService.setState(this.conversationService.getConversationId(locationId, chatType, chatId), {
      items: [],
      customerData: {},
      step: 'awaiting_menu_confirmation',
    });
    
    try {
      const tenantId = await this.getTenantId(locationId);
      const customerContext = await this.customerContextService.getCustomerContext(chatId, locationId, tenantId);
      // DEBUG: Verifica si el customerContext recibido tiene el nombre y datos correctos
      console.log('[DEBUG][ai.gateway.ts] customerContext recibido:', customerContext);
      const conversationContext: ConversationContext = {
        locationId,
        tenantId,
        chatType,
        chatId,
        customerName: customerContext.name,
        customerPhone: customerContext.phone,
        customerAddress: customerContext.address,
        customerNeighborhood: customerContext.neighborhood,
      };

      await this.conversationService.getOrCreateConversation(conversationContext);
      
      const aiSettings = await this.settingsService.getAISettings();
      const businessSettings = await this.settingsService.getBusinessSettings();
      const businessName = businessSettings.name;

      // DEBUG: Verificar el contenido real de customerContext
      console.log('[DEBUG] customerContext:', customerContext);

      let welcomeMessage = '';
      if (chatType === 'admin') {
        welcomeMessage = `👋 ¡Hola! Soy *${aiSettings.name}*, tu asistente administrativo.\n\n🔧 Estoy aquí para ayudarte con las tareas administrativas del restaurante.\n\n¿En qué puedo ayudarte hoy? 😊`;
      } else {
        const cleanName = customerContext && customerContext.name ? customerContext.name.trim() : '';
        if (cleanName.length > 0) {
          welcomeMessage = `👋 ¡Hola, *${cleanName}*! Soy *${aiSettings.name}*, tu asistente personal. 😊\n\n🍽️ ¿En qué puedo ayudarte hoy? ¿Te gustaría ver el menú o tienes un antojo especial?`;
        } else {
          welcomeMessage = `👋 ¡Hola! Soy *${aiSettings.name}*, tu asistente personal. 😊\n\n🍽️ ¿En qué puedo ayudarte hoy? ¿Te gustaría ver el menú o tienes un antojo especial?`;
        }
      }

      client.emit('ai_response', {
        type: 'text',
        content: welcomeMessage,
      });
    } catch (error) {
      console.error('Error in handleConnection:', error);
      client.emit('error', {
        message: 'Error initializing chat',
        details: error.message
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const locationId = this.locationIds.get(client.id);
    const chatType = this.chatTypes.get(client.id);
    const chatId = client.handshake.query.chatId as string;
    
    if (locationId && chatType && chatId) {
      const conversationId = this.conversationService.getConversationId(locationId, chatType, chatId);
      this.conversationService.deleteConversation(conversationId);
      this.orderStateService.deleteState(conversationId);
    }
    
    this.locationIds.delete(client.id);
    this.chatTypes.delete(client.id);
  }

  @SubscribeMessage('input_text')
  async handleTextInput(client: Socket | { text: string, locationId: string, chatType: string, chatId: string }, payload?: { text: string }): Promise<string> {
    const locationId = 'locationId' in client ? client.locationId : this.locationIds.get(client.id);
    const chatTypeValue = 'chatType' in client ? client.chatType : this.chatTypes.get(client.id);
    const chatType: 'whatsapp' | 'ai' | 'admin' =
      chatTypeValue === 'whatsapp' || chatTypeValue === 'ai' || chatTypeValue === 'admin'
        ? chatTypeValue
        : 'ai';
    const chatId = 'chatId' in client ? client.chatId : client.handshake.query.chatId as string;
    const text = payload?.text || ('text' in client ? client.text : '');

    console.log(`[AI Gateway] Processing text input:`, { locationId, chatType, chatId, text: text.substring(0, 100) });

    if (!locationId || !chatType || !chatId) {
      console.error('Missing required parameters for text input');
      return 'Error: Missing required parameters';
    }

    const deliveryTimeText = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

    // --- NUEVO: Responder sobre tiempo de domicilio antes de cualquier otro flujo ---
    const deliveryTimeKeywords = [
      'cuanto se demora el domicilio',
      'cuánto se demora el domicilio',
      'cuanto tarda el domicilio',
      'cuánto tarda el domicilio',
      'cuanto tiempo toma el domicilio',
      'cuánto tiempo toma el domicilio',
      'tiempo de entrega',
      'tiempo domicilio',
      'demora domicilio',
      'demora del domicilio',
      'cuanto se demora el pedido',
      'cuánto se demora el pedido',
      'cuanto tarda el pedido',
      'cuánto tarda el pedido',
      'cuanto tiempo toma el pedido',
      'cuánto tiempo toma el pedido',
      'tiempo de entrega del pedido',
      'tiempo pedido',
      'demora pedido',
      'demora del pedido',
    ];
    if (deliveryTimeKeywords.some(k => deliveryTimeText.includes(k))) {
      const response = '¡Por supuesto! Normalmente los domicilios se demoran entre 20 y 30 minutos, pero puede variar según la zona y la demanda. 😊';
      if ('emit' in client) {
        client.emit('ai_response', {
          type: 'text',
          content: response
        });
      }
      return response;
    }

    const conversationId = this.conversationService.getConversationId(locationId, chatType, chatId);
    const state = this.orderStateService.getState(conversationId);
    const normalizedText = this.messageHandler.normalizeText(text);

    // Update customer context if needed
    await this.updateCustomerContext(locationId, chatType, chatId);

    // Handle delivery time questions
    if (this.messageHandler.isDeliveryTimeQuestion(text)) {
      const response = this.messageHandler.getDeliveryTimeResponse();
      if ('emit' in client) {
        client.emit('ai_response', { type: 'text', content: response });
      }
      return response;
    }

    // Check if AI is enabled for WhatsApp
    if (chatType === 'whatsapp') {
      try {
        const aiSettings = await this.settingsService.getAISettings();
        if (!aiSettings?.enabled) {
          console.log(`[AI Gateway] AI is disabled for WhatsApp, not processing message`);
          return '';
        }
      } catch (error) {
        console.error('Error checking AI settings:', error);
        return '';
      }
    }

    // Primero: si es una pregunta general de almuerzo, muestra el menú de almuerzos
    if (chatType !== 'admin' && this.messageHandler.isGeneralLunchRequest(text)) {
      const lastAssistantMessage = this.conversationService.getLastAssistantMessage(conversationId);
      if (!this.messageHandler.isVariantPrompt(lastAssistantMessage)) {
        return await this.handleLunchRequest(client, locationId, chatType);
      }
    }

    // Si la frase contiene "almuerzo" pero NO es una pregunta general, usa NLP para buscar el producto en almuerzos
    if (chatType !== 'admin' && this.messageHandler.isLunchRequest(text)) {
      // Obtener solo productos de almuerzos
      const tenantId = await this.getTenantId(locationId);
      const lunchMenu = await this.menuHandler.getLunchProducts(locationId, tenantId);
      const nlp = new (require('./services/nlp.service').NLPService)(lunchMenu);
      const nlpResult = nlp.findBestProduct(text);
      if (nlpResult) {
        // Agrega un mensaje explícito al historial para guiar al modelo
        this.conversationService.addMessage(conversationId, {
          role: 'user',
          content: `Quiero pedir el producto: ${Array.isArray(nlpResult) ? nlpResult[0].name : nlpResult.name}`
        });
        return await this.processWithOpenAI(client, text, locationId, chatType, chatId);
      } else {
        // Si no hay match, muestra el menú de almuerzos como fallback
        const tenantId = await this.getTenantId(locationId);
        const lunchMenuText = await this.menuHandler.getLunchMenuText(locationId, tenantId);
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: lunchMenuText });
        }
        return lunchMenuText;
      }
    }

    // Luego, si no es de almuerzo, el menú general
    if (chatType !== 'admin' && this.messageHandler.isMenuRequest(text)) {
      const lastAssistantMessage = this.conversationService.getLastAssistantMessage(conversationId);
      if (!this.messageHandler.isVariantPrompt(lastAssistantMessage)) {
        return await this.handleMenuRequest(client, text, locationId, chatType);
      }
    }

    // --- FLUJO HUMANO: Captura progresiva y flexible de datos del cliente ---
    if (state.step === 'awaiting_customer_data') {
      const customerData = state.customerData || {};
      const normalized = text.toLowerCase();
      // 1. Extraer todos los datos posibles de la frase
      // (usa la heurística avanzada ya implementada)
      // ... (código de extracción avanzada aquí) ...
      // 2. Detectar si el usuario respondió solo el dato pedido
      // Si el bot acaba de preguntar por el teléfono y el usuario responde solo un número, guárdalo
      if (!customerData.phone && /^\d{7,}$/.test(text.trim())) {
        customerData.phone = text.trim();
      }
      // Si acaba de preguntar por el nombre y el usuario responde solo palabras
      if (!customerData.name && /^[a-záéíóúñ ]{3,40}$/i.test(text.trim())) {
        customerData.name = text.trim();
      }
      // Si acaba de preguntar por el método de pago y el usuario responde solo "Efectivo", "Tarjeta", etc.
      if (!customerData.paymentMethod && /efectivo|tarjeta|credito|cr[eé]dito|d[eé]bito|transferencia|qr/i.test(text.trim())) {
        const pagoNorm = text.trim().toLowerCase();
        if (pagoNorm.includes('efectivo')) customerData.paymentMethod = 'CASH';
        else if (pagoNorm.includes('credito') || pagoNorm.includes('crédito') || pagoNorm.includes('tarjeta')) customerData.paymentMethod = 'CREDIT_CARD';
        else if (pagoNorm.includes('débito') || pagoNorm.includes('debito')) customerData.paymentMethod = 'DEBIT_CARD';
        else if (pagoNorm.includes('transfer')) customerData.paymentMethod = 'TRANSFER';
        else if (pagoNorm.includes('qr')) customerData.paymentMethod = 'QR';
      }
      // Si acaba de preguntar por el barrio y el usuario responde solo una palabra/frase corta
      if (!customerData.neighborhood && text.trim().length > 0 && text.trim().length < 40 && text.trim().split(/\s+/).length <= 5 && !/\d/.test(text)) {
        customerData.neighborhood = text.trim();
      }
      // 3. Guardar progreso
      this.orderStateService.updateState(conversationId, { customerData });
      // 4. Preguntar solo por el siguiente dato faltante
      const missing = [];
      if (!customerData.name) missing.push('nombre completo');
      if (!customerData.phone) missing.push('número de teléfono');
      if (!customerData.deliveryAddress) missing.push('dirección de entrega');
      if (!customerData.neighborhood) missing.push('barrio o sector');
      if (!customerData.paymentMethod) missing.push('método de pago');
      if (missing.length === 0) {
        // Todos los datos listos: mostrar resumen y pedir confirmación
        const resumen = `Por favor confirma que estos datos están bien:\n\n*Nombre:* ${customerData.name}\n*Teléfono:* ${customerData.phone}\n*Dirección:* ${customerData.deliveryAddress}\n*Barrio:* ${customerData.neighborhood}\n*Pago:* ${customerData.paymentMethod === 'CASH' ? 'Efectivo' : customerData.paymentMethod === 'CREDIT_CARD' ? 'Tarjeta de Crédito' : customerData.paymentMethod === 'DEBIT_CARD' ? 'Débito' : customerData.paymentMethod === 'QR' ? 'QR' : 'Transferencia'}\n\n¿Están correctos? (Responde \"Sí\" para continuar o indícanos qué corregir)`;
        await this.conversationService.addMessage(conversationId, { role: 'assistant', content: resumen });
        if ('emit' in client) {
          client.emit('ai_response', resumen);
        }
        state.step = 'awaiting_customer_data_confirmation';
        this.orderStateService.updateState(conversationId, state);
        return;
      } else {
        // Pregunta solo por el siguiente dato faltante
        let nextPrompt = '';
        if (!customerData.name) nextPrompt = '¿Cuál es tu nombre completo?';
        else if (!customerData.phone) nextPrompt = '¿Cuál es tu número de teléfono?';
        else if (!customerData.deliveryAddress) nextPrompt = '¿Cuál es tu dirección de entrega?';
        else if (!customerData.neighborhood) nextPrompt = '¿En qué barrio o sector te encuentras?';
        else if (!customerData.paymentMethod) nextPrompt = '¿Cómo prefieres pagar? (Efectivo, Tarjeta de Crédito, Débito, Transferencia)';
        if (nextPrompt) {
          await this.conversationService.addMessage(conversationId, { role: 'assistant', content: nextPrompt });
          if ('emit' in client) {
            client.emit('ai_response', nextPrompt);
          }
          return;
        }
      }
    }
    // --- Confirmación final de datos ---
    if (state.step === 'awaiting_customer_data_confirmation') {
      if (this.messageHandler.isConfirmation(text)) {
        // Crear la orden y agradecer
        // ... lógica de creación de orden ...
        const gracias = '¡Perfecto! Tu pedido ha sido registrado con éxito. Muchas gracias por tu confianza 😊';
        await this.conversationService.addMessage(conversationId, { role: 'assistant', content: gracias });
        if ('emit' in client) {
          client.emit('ai_response', gracias);
        }
        // ... resto del flujo ...
        return;
      } else {
        // Si el usuario indica un cambio, reinicia solo el dato corregido
        // ... lógica para actualizar solo el dato corregido ...
      }
    }

    // --- NUEVO: Confirmación final de orden ---
    if (state.step === 'awaiting_final_confirmation' && this.messageHandler.isConfirmation(text)) {
      // Ya tenemos todo, crear la orden
      const tenantId = await this.getTenantId(locationId);
      const validatedOrderData = this.orderStateService.getValidatedOrderData(conversationId);
      if (!validatedOrderData || !validatedOrderData.items) {
        const msg = 'Ocurrió un error recuperando tu pedido. Por favor, vuelve a seleccionar los productos.';
        if ('emit' in client) client.emit('ai_response', { type: 'text', content: msg });
        this.conversationService.addMessage(conversationId, { role: 'assistant', content: msg });
        return msg;
      }
      const createdOrder = await this.orderHandler.createOrder({
        ...validatedOrderData,
        ...state.customerData,
        chatId,
        locationId
      }, tenantId);
      const response = this.orderHandler.formatOrderSuccessMessage(createdOrder.id);
      this.orderStateService.deleteState(conversationId);
      if ('emit' in client) client.emit('ai_response', { type: 'text', content: response });
      this.conversationService.addMessage(conversationId, { role: 'assistant', content: response });
      return response;
    }

    // --- NUEVO: Manejo de selección pendiente de producto ---
    const pendingSelection = this.orderStateService.getPendingProductSelection(conversationId);
    if (pendingSelection) {
      // --- Heurística de contexto: si hay panadería y chocolate, prioriza bebida ---
      const bakeryKeywords = ['pan', 'pandebono', 'almojábana', 'arepa', 'buñuelo', 'panadería', 'pastelería'];
      const items = [...pendingSelection.originalItems];
      const hasBakery = items.some(item => bakeryKeywords.some(k => item.productName.toLowerCase().includes(k)));
      const beverageOptions = pendingSelection.options.filter(opt =>
        opt.category && opt.category.name && opt.category.name.toLowerCase().includes('bebida')
      );
      let selectedProduct = null;
      if (hasBakery && beverageOptions.length === 1) {
        selectedProduct = beverageOptions[0];
      } else if (hasBakery && beverageOptions.length > 1) {
        // Si hay varias bebidas, pregunta solo por las bebidas
        const options = beverageOptions.map((product, idx) => `${idx + 1}. *${product.name}*`).join('\n');
        const msg = `He encontrado varias bebidas llamadas "chocolate":\n\n${options}\n\nPor favor, dime el número o el nombre exacto de la bebida que deseas.`;
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: msg });
        }
        return msg;
      }
      // Si no se seleccionó automáticamente, usa NLPService
      if (!selectedProduct) {
        const tenantId = await this.getTenantId(locationId);
        const nlp = new NLPService(pendingSelection.options);
        const nlpResult = nlp.findBestProduct(text);
        if (Array.isArray(nlpResult)) {
          if (nlpResult.length === 1) {
            selectedProduct = nlpResult[0];
          } else if (nlpResult.length > 1) {
            const options = nlpResult.map((product, idx) => `${idx + 1}. *${product.name}*`).join('\n');
            const msg = `He encontrado varias coincidencias:\n\n${options}\n\nPor favor, dime el número o el nombre exacto de uno de estos productos.`;
            if ('emit' in client) {
              client.emit('ai_response', { type: 'text', content: msg });
            }
            return msg;
          }
        } else if (nlpResult) {
          selectedProduct = nlpResult;
        }
      }
      if (selectedProduct) {
        this.orderStateService.clearPendingProductSelection(conversationId);
        items[pendingSelection.ambiguousIndex] = {
          ...items[pendingSelection.ambiguousIndex],
          productName: selectedProduct.name
        };
        const functionArgs = {
          items,
          conversationId
        };
        const tenantId = await this.getTenantId(locationId);
        const subtotalResult = await this.functionExecutor.executeFunction(
          'calculate_order_subtotal',
          functionArgs,
          locationId,
          chatType,
          tenantId
        );
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: subtotalResult.message });
        }
        return subtotalResult.message;
      } else {
        const options = pendingSelection.options.map((product, idx) =>
          `${idx + 1}. *${product.name}*`
        ).join('\n');
        const msg = `No entendí tu selección. Por favor, dime el número o el nombre exacto de uno de estos productos:\n\n${options}`;
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: msg });
        }
        return msg;
      }
    }
    // --- FIN NUEVO ---

    // Process with OpenAI
    return await this.processWithOpenAI(client, text, locationId, chatType, chatId);
  }

  @SubscribeMessage('transcribe_audio')
  async handleTranscribeAudio(client: Socket, data: { audio: Buffer, mimeType?: string }) {
    try {
      if (!data.audio) {
        client.emit('error', { message: 'No audio data received' });
        return;
      }
      const text = await this.sttService.transcribeAudio(data.audio);
      client.emit('transcription_result', { text });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      client.emit('error', { message: 'Error transcribing audio', details: error.message });
    }
  }

  private async updateCustomerContext(locationId: string, chatType: string, chatId: string): Promise<void> {
    const chatTypeFixed: 'whatsapp' | 'ai' | 'admin' =
      chatType === 'whatsapp' || chatType === 'ai' || chatType === 'admin'
        ? chatType
        : 'ai';
    if (chatTypeFixed === 'whatsapp' && chatId && locationId) {
      const tenantId = await this.getTenantId(locationId);
      const customerContext = await this.customerContextService.getCustomerContext(chatId, locationId, tenantId);
      const conversationContext = {
        locationId,
        tenantId,
        chatType: chatTypeFixed,
        chatId,
        customerName: customerContext.name,
        customerPhone: customerContext.phone,
        customerAddress: customerContext.address,
        customerNeighborhood: customerContext.neighborhood,
      } as ConversationContext;
      await this.conversationService.updateConversationContext(conversationContext);
    }
  }

  private async handleMenuRequest(client: any, text: string, locationId: string, chatType: string): Promise<string> {
    try {
      const tenantId = await this.getTenantId(locationId);
      const { bestProduct, candidateProducts, matchingProducts } = await this.menuHandler.searchProducts(text, locationId, tenantId);
      
      const usedGeneric = this.messageHandler.hasUsedGenericWords(text);
      if (candidateProducts.length > 1 && usedGeneric) {
        const response = this.menuHandler.formatCandidateProducts(candidateProducts);
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: response });
        }
        // Guardar en historial
        const conversationId = this.conversationService.getConversationId(locationId, chatType, client.chatId || client.handshake?.query?.chatId);
        this.conversationService.addMessage(conversationId, { role: 'assistant', content: response });
        return response;
      }

      if (bestProduct && candidateProducts.length > 0) {
        return await this.handleProductSelection(client, bestProduct, text, locationId, chatType);
      }

      if (matchingProducts.length > 0 && !this.messageHandler.isGeneralMenuRequest(text)) {
        const response = matchingProducts.length === 1 
          ? this.menuHandler.formatProductResponse(matchingProducts[0])
          : this.menuHandler.formatProductList(matchingProducts);
        
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: response });
        }
        // Guardar en historial
        const conversationId = this.conversationService.getConversationId(locationId, chatType, client.chatId || client.handshake?.query?.chatId);
        this.conversationService.addMessage(conversationId, { role: 'assistant', content: response });
        return response;
      }

      const menuText = await this.menuHandler.getMenuText(locationId, tenantId);
      if ('emit' in client) {
        client.emit('ai_response', { type: 'text', content: menuText });
      }
      // Guardar en historial
      const conversationId = this.conversationService.getConversationId(locationId, chatType, client.chatId || client.handshake?.query?.chatId);
      this.conversationService.addMessage(conversationId, { role: 'assistant', content: menuText });
      return menuText;
    } catch (error) {
      console.error('Error handling menu request:', error);
      const errorMessage = 'Error mostrando el menú/producto. Por favor, intenta de nuevo.';
      if ('emit' in client) {
        client.emit('error', { message: errorMessage, details: error.message });
      }
      return errorMessage;
    }
  }

  private async handleLunchRequest(client: any, locationId: string, chatType: string): Promise<string> {
    try {
      const tenantId = await this.getTenantId(locationId);
      const lunchMenuText = await this.menuHandler.getLunchMenuText(locationId, tenantId);
      if ('emit' in client) {
        client.emit('ai_response', { type: 'text', content: lunchMenuText });
      }
      // Guardar en historial
      const conversationId = this.conversationService.getConversationId(locationId, chatType, client.chatId || client.handshake?.query?.chatId);
      this.conversationService.addMessage(conversationId, { role: 'assistant', content: lunchMenuText });
      return lunchMenuText;
    } catch (error) {
      console.error('Error handling lunch request:', error);
      const errorMessage = 'Error mostrando las opciones de almuerzo. Por favor, intenta de nuevo.';
      if ('emit' in client) {
        client.emit('error', { message: errorMessage, details: error.message });
      }
      return errorMessage;
    }
  }

  private async handleProductSelection(client: any, product: any, text: string, locationId: string, chatType: string): Promise<string> {
    // This would contain the logic for handling product selection with variants
    // For brevity, I'm returning a simplified response
    const response = this.menuHandler.formatProductResponse(product);
    if ('emit' in client) {
      client.emit('ai_response', { type: 'text', content: response });
    }
    // Guardar en historial
    const conversationId = this.conversationService.getConversationId(locationId, chatType, client.chatId || client.handshake?.query?.chatId);
    this.conversationService.addMessage(conversationId, { role: 'assistant', content: response });
    return response;
  }

  private async processWithOpenAI(client: any, text: string, locationId: string, chatType: string, chatId: string): Promise<string> {
    const conversationId = this.conversationService.getConversationId(locationId, chatType, chatId);
    const conversation = await this.conversationService.getOrCreateConversation({
      locationId,
      tenantId: await this.getTenantId(locationId),
      chatType,
      chatId,
    } as ConversationContext);

    this.conversationService.addMessage(conversationId, { role: 'user', content: text });

    try {
      console.log(`[AI Gateway] Calling OpenAI API with ${conversation.length} messages`);
      const tenantId = await this.getTenantId(locationId);
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: conversation,
        functions: chatType === 'admin' ? adminAssistantFunctions : restaurantAssistantFunctions,
        function_call: 'auto',
      });

      const response = completion.choices[0].message;
      console.log(`[AI Gateway] OpenAI response:`, { 
        hasContent: !!response.content, 
        hasFunctionCall: !!response.function_call,
        functionName: response.function_call?.name 
      });
      
      this.conversationService.addMessage(conversationId, {
        role: 'assistant',
        content: response.content || '',
      });

      if (response.function_call) {
        // LOG de depuración para ver el payload que genera OpenAI
        console.log('[DEBUG] Payload de OpenAI function_call:', response.function_call.name, response.function_call.arguments);
        const functionResult = await this.functionExecutor.executeFunction(
          response.function_call.name,
          JSON.parse(response.function_call.arguments),
          locationId,
          chatType,
          tenantId
        );
        
        this.conversationService.addMessage(conversationId, {
          role: 'function',
          name: response.function_call.name,
          content: JSON.stringify(functionResult),
        });
        
        if (functionResult && (functionResult.validatedItems || functionResult.validated)) {
          console.log('[DEBUG] Guardando orderData en OrderStateService:', functionResult.orderData);
          // Si es calculate_order_subtotal, guardar validatedItems como items
          if (response.function_call.name === 'calculate_order_subtotal') {
            this.orderStateService.setValidatedOrderData(conversationId, {
              items: functionResult.validatedItems,
              totalAmount: functionResult.totalAmount
            });
            // Cuando se muestra el resumen, esperar selección de productos
            this.orderStateService.updateState(conversationId, { step: 'awaiting_product_selection' });
          } else if (functionResult.orderData) {
            // Si es validate_order_before_creation, guardar orderData completo
            this.orderStateService.setValidatedOrderData(conversationId, {
              ...functionResult.orderData,
              validatedItems: functionResult.validatedItems,
              totalAmount: functionResult.totalAmount
            });
            // Cuando se muestra el resumen final, esperar confirmación de orden
            this.orderStateService.updateState(conversationId, { step: 'awaiting_order_confirmation' });
          }
        }
        // Si el resultado tiene un mensaje (ej: resumen de pedido), guárdalo como mensaje del asistente
        if (functionResult && functionResult.message) {
          this.conversationService.addMessage(conversationId, { role: 'assistant', content: functionResult.message });
        }
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: functionResult.message });
        }
        return functionResult.message;
      }

      if ('emit' in client) {
        client.emit('ai_response', { type: 'text', content: response.content || '' });
      }
      return response.content || 'No response from AI';
    } catch (error) {
      console.error('Error in processWithOpenAI:', error);
      const errorMessage = 'Error processing your message. Please try again.';
      
      if ('emit' in client) {
        client.emit('error', { message: errorMessage, details: error.message });
      }
      return errorMessage;
    }
  }

  private async getTenantId(locationId: string): Promise<string> {
    const location = await this.locationsService.findOne(locationId, undefined);
    if (!location) throw new Error('Ubicación no encontrada');
    return location.tenantId;
  }
}