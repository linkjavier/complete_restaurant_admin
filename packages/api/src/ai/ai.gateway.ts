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
    private functionExecutor: FunctionExecutorService
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
    
    try {
      const customerContext = await this.customerContextService.getCustomerContext(chatId, locationId);
      const conversationContext: ConversationContext = {
        locationId,
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

      let welcomeMessage = '';
      if (chatType === 'admin') {
        welcomeMessage = `👋 ¡Hola! Soy *${aiSettings.name}*, tu asistente administrativo.` +
          `\n\n🔧 Estoy aquí para ayudarte con las tareas administrativas del restaurante.\n\n¿En qué puedo ayudarte hoy? 😊`;
      } else {
        welcomeMessage = `👋 ¡Hola! Bienvenido a *${businessName}*. Mi nombre es *${aiSettings.name}*.` +
          `\n\n🍽️ Estoy aquí para ayudarte con tu pedido a domicilio.\n\n¿En qué puedo ayudarte hoy? 😊`;
      }

      client.emit('ai_response', {
        type: 'text',
        content: customerContext.greeting + welcomeMessage,
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

    const normalizedText = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

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
    if (deliveryTimeKeywords.some(k => normalizedText.includes(k))) {
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

    // Handle menu requests
    if (chatType !== 'admin' && this.messageHandler.isMenuRequest(text)) {
      const lastAssistantMessage = this.conversationService.getLastAssistantMessage(conversationId);
      if (!this.messageHandler.isVariantPrompt(lastAssistantMessage)) {
        return await this.handleMenuRequest(client, text, locationId, chatType);
      }
    }

    // Handle order confirmation
    if (this.messageHandler.isConfirmation(text)) {
      return await this.handleOrderConfirmation(client, conversationId, locationId, chatType);
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
        const subtotalResult = await this.functionExecutor.executeFunction(
          'calculate_order_subtotal',
          functionArgs,
          locationId,
          chatType
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
      const customerContext = await this.customerContextService.getCustomerContext(chatId, locationId);
      const conversationContext = {
        locationId,
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
      const { bestProduct, candidateProducts, matchingProducts } = await this.menuHandler.searchProducts(text, locationId);
      
      const usedGeneric = this.messageHandler.hasUsedGenericWords(text);
      if (candidateProducts.length > 1 && usedGeneric) {
        const response = this.menuHandler.formatCandidateProducts(candidateProducts);
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: response });
        }
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
        return response;
      }

      const menuText = await this.menuHandler.getMenuText(locationId);
      if ('emit' in client) {
        client.emit('ai_response', { type: 'text', content: menuText });
      }
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

  private async handleProductSelection(client: any, product: any, text: string, locationId: string, chatType: string): Promise<string> {
    // This would contain the logic for handling product selection with variants
    // For brevity, I'm returning a simplified response
    const response = this.menuHandler.formatProductResponse(product);
    if ('emit' in client) {
      client.emit('ai_response', { type: 'text', content: response });
    }
    return response;
  }

  private async handleOrderConfirmation(client: any, conversationId: string, locationId: string, chatType: string): Promise<string> {
    const orderData = this.orderStateService.getValidatedOrderData(conversationId);
    const validation = this.orderHandler.validateOrderData(orderData);
    
    if (validation.isValid) {
      try {
        const createdOrder = await this.orderHandler.createOrder(orderData);
        const response = this.orderHandler.formatOrderSuccessMessage(createdOrder.id);
        this.orderStateService.deleteState(conversationId);
        
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: response });
        }
        return response;
      } catch (error) {
        const errorMessage = this.orderHandler.formatOrderErrorMessage(error);
        if ('emit' in client) {
          client.emit('ai_response', { type: 'text', content: errorMessage });
        }
        return errorMessage;
      }
    } else {
      const missingFieldsMessage = this.orderHandler.formatMissingFieldsMessage(validation.missingFields);
      if ('emit' in client) {
        client.emit('ai_response', { type: 'text', content: missingFieldsMessage });
      }
      return missingFieldsMessage;
    }
  }

  private async processWithOpenAI(client: any, text: string, locationId: string, chatType: string, chatId: string): Promise<string> {
    const conversationId = this.conversationService.getConversationId(locationId, chatType, chatId);
    const conversation = await this.conversationService.getOrCreateConversation({
      locationId,
      chatType,
      chatId,
    } as ConversationContext);

    this.conversationService.addMessage(conversationId, { role: 'user', content: text });

    try {
      console.log(`[AI Gateway] Calling OpenAI API with ${conversation.length} messages`);
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
          chatType
        );
        
        this.conversationService.addMessage(conversationId, {
          role: 'function',
          name: response.function_call.name,
          content: JSON.stringify(functionResult),
        });
        
        if (functionResult && (functionResult.validatedItems || functionResult.validated)) {
          this.orderStateService.setValidatedOrderData(conversationId, {
            ...(functionResult.orderData || {}),
            validatedItems: functionResult.validatedItems,
            totalAmount: functionResult.totalAmount
          });
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
}