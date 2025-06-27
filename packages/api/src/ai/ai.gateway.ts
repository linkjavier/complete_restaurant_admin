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
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { Inject, forwardRef } from '@nestjs/common';
import { getRestaurantAssistantRole } from './roles/restaurant-assistant.role';
import { getAdminAssistantRole } from './roles/admin-assistant.role';
import { restaurantAssistantFunctions } from './functions/restaurant-assistant.functions';
import { adminAssistantFunctions } from './functions/admin-assistant.functions';
import { STTService } from '../stt/stt.service';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { CategoriesService } from '../categories/categories.service';
import { OrderType, OrderSource } from '../orders/dto/create-order.dto';

// Utilidad para obtener todas las variantes de todos los grupos
function getAllVariants(product) {
  if (!product.variantGroups) return [];
  return product.variantGroups.flatMap(g => g.variants || []);
}

// Utilidad para normalizar nombres (sin tildes, minúsculas, sin espacios extra)
function normalizeName(str: string) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  private conversations: Map<string, OpenAI.Chat.ChatCompletionMessageParam[]> = new Map();
  private locationIds: Map<string, string> = new Map();
  private chatTypes: Map<string, 'whatsapp' | 'ai' | 'admin'> = new Map();
  private orderState: Map<string, { items: any[]; customerData: any; step: string; validatedOrderData?: any }> = new Map();

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    private settingsService: SettingsService,
    private sttService: STTService,
    private categoriesService: CategoriesService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({
      apiKey,
    });
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
      // Get AI settings
      const aiSettings = await this.settingsService.getAISettings();
      const businessSettings = await this.settingsService.getBusinessSettings();
      const businessName = businessSettings.name;

      // Create a unique conversation ID combining location, chat type and chat ID
      const conversationId = `${locationId}:${chatType}:${chatId}`;

      // Initialize conversation history for this specific chat if it doesn't exist
      if (!this.conversations.has(conversationId)) {
        let systemMessage: OpenAI.Chat.ChatCompletionMessageParam;

        if (chatType === 'admin') {
          // Use admin assistant role
          systemMessage = {
            role: 'system',
            content: getAdminAssistantRole({
              aiSettings,
              locationId,
              chatId,
              businessName,
            }),
          };
        } else {
          // Use restaurant assistant role for both 'ai' and 'whatsapp' types
          const menu = await this.productsService.findAll({
            locationId,
          });
          systemMessage = {
            role: 'system',
            content: getRestaurantAssistantRole({
              aiSettings,
              locationId,
              chatId,
              menu,
              businessName,
            }),
          };
        }

        this.conversations.set(conversationId, [systemMessage]);
      }

      // Send welcome message
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
      const conversationId = `${locationId}:${chatType}:${chatId}`;
      this.conversations.delete(conversationId);
    }
    
    this.locationIds.delete(client.id);
    this.chatTypes.delete(client.id);
  }

  @SubscribeMessage('input_text')
  async handleTextInput(client: Socket | { text: string, locationId: string, chatType: string, chatId: string }, payload?: { text: string }): Promise<string> {
    const locationId = 'locationId' in client ? client.locationId : this.locationIds.get(client.id);
    const chatType = 'chatType' in client ? client.chatType : this.chatTypes.get(client.id);
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

    // Detectar frases clave para mostrar el menú directamente
    const menuKeywords = [
      'domicilio',
      'menú',
      'menu',
      'carta',
      'pedido',
      'ordenar',
      'orden',
      'pedir',
      'ver menu',
      'ver menú',
      'ver carta',
      'quiero',
      'almuerzo',
      'almuerzos',
    ];

    // --- NUEVO: Si el último mensaje de la IA fue una pregunta de variantes, NO mostrar menú automático ---
    const conversationIdMenu = `${locationId}:${chatType}:${chatId}`;
    let conversationMenu = this.conversations.get(conversationIdMenu);
    let lastAssistantMessage = '';
    if (conversationMenu && conversationMenu.length > 0) {
      for (let i = conversationMenu.length - 1; i >= 0; i--) {
        if (conversationMenu[i].role === 'assistant' && conversationMenu[i].content) {
          lastAssistantMessage = conversationMenu[i].content as string;
          break;
        }
      }
    }
    const isVariantPrompt = lastAssistantMessage && (
      lastAssistantMessage.includes('elige una opción para cada grupo') ||
      lastAssistantMessage.includes('dime tus elecciones') ||
      lastAssistantMessage.includes('¿Qué opciones prefieres para cada uno de los grupos?')
    );
    // --- FIN NUEVO ---

    // --- NUEVO: Verificar si la IA está habilitada antes de responder con el menú ---
    let aiSettings: any;
    try {
      aiSettings = await this.settingsService.getAISettings();
      if (chatType === 'whatsapp' && !aiSettings?.enabled) {
        console.log(`[AI Gateway] AI is disabled for WhatsApp, not sending menu or processing message`);
        return '';
      }
    } catch (error) {
      console.error('Error checking AI settings:', error);
      if (chatType === 'whatsapp') {
        return '';
      }
    }
    // --- FIN NUEVO ---

    // --- NUEVO: Manejo de estado persistente de orden ---
    let state = this.orderState.get(conversationIdMenu) || { items: [], customerData: {}, step: 'products' };
    // Si el usuario agrega productos
    if (menuKeywords.some(k => normalizedText.includes(k))) {
      // Aquí deberías parsear el producto del mensaje y agregarlo a state.items
      // (esto requiere lógica de NLP o confiar en la IA para estructurar el producto)
      // Si la IA solo envía un producto, suma ese producto a la lista anterior (salvo que el usuario diga explícitamente que quiere reemplazar o eliminar)
      // Por ahora, solo simula que se agregó un producto
      // state.items.push({ ...nuevoProducto })
      // --- REFORZADO: Siempre mantener la lista acumulada de productos ---
      // Si el mensaje parece ser "agregar" o "sumar", acumula; si es "cambiar" o "eliminar", reemplaza o elimina
      // (esto puede mejorarse con NLP, aquí solo se documenta la intención)
      state.step = 'products';
      this.orderState.set(conversationIdMenu, state);
    }
    // Si el usuario da datos de cliente
    if (text.toLowerCase().includes('nombre') || text.toLowerCase().includes('dirección') || text.toLowerCase().includes('teléfono') || text.toLowerCase().includes('barrio') || text.toLowerCase().includes('pago')) {
      // Parsear y guardar los datos en state.customerData
      // (esto requiere lógica de NLP o confiar en la IA para estructurar los datos)
      state.customerData = { ...state.customerData, ...{/* datos parseados */} };
      state.step = 'customerData';
      this.orderState.set(conversationIdMenu, state);
    }
    // Si ya hay datos de cliente y productos, solo pide confirmación
    if (state.items.length > 0 && Object.keys(state.customerData).length > 0) {
      state.step = 'confirm';
      this.orderState.set(conversationIdMenu, state);
      // Mostrar resumen y pedir confirmación
      if ('emit' in client) {
        client.emit('ai_response', {
          type: 'text',
          content: 'Aquí tienes el resumen actualizado de tu pedido. ¿Confirmas que todo está correcto?'
        });
      }
      return 'Aquí tienes el resumen actualizado de tu pedido. ¿Confirmas que todo está correcto?';
    }
    // Si falta algún dato, solo pide lo que falta
    if (state.items.length > 0 && state.step === 'products') {
      if ('emit' in client) {
        client.emit('ai_response', {
          type: 'text',
          content: 'Por favor, proporciona tus datos de entrega para continuar.'
        });
      }
      return 'Por favor, proporciona tus datos de entrega para continuar.';
    }
    // --- FIN NUEVO ---

    // --- NUEVO: Manejo inteligente de menú y productos específicos ---
    if (chatType !== 'admin' && menuKeywords.some(k => normalizedText.includes(k)) && !isVariantPrompt) {
      try {
        // Buscar productos que coincidan con el texto del usuario (nombre parcial)
        const menu = await this.productsService.findAll({ locationId });
        // 1. Buscar producto base (coincidencia flexible)
        function tokenize(str) {
          return normalizeName(str)
            .replace(/[()\[\],.]/g, '')
            .replace(/\b(el|la|los|las|un|una|unos|unas|de|del|a|para|con|y|o|en|al)\b/gi, '')
            .split(' ')
            .filter(Boolean);
        }
        const userTokens = tokenize(text);
        let bestProduct = null;
        let bestScore = 0;
        let candidateProducts = [];
        for (const product of menu) {
          const productTokens = tokenize(product.name);
          const matchCount = productTokens.filter(tk => userTokens.includes(tk)).length;
          const score = matchCount / productTokens.length + productTokens.length * 0.01;
          if (matchCount > 0) {
            candidateProducts.push({ product, score, matchCount });
            if (score > bestScore) {
              bestScore = score;
              bestProduct = product;
            }
          }
        }
        // Si hay varias coincidencias relevantes y el usuario usó una palabra genérica, pedir que elija
        const genericWords = ['almuerzo', 'bebida', 'jugo', 'especial', 'ejecutivo', 'combo', 'plato', 'menu', 'menú', 'carta'];
        const usedGeneric = userTokens.some(tk => genericWords.includes(tk));
        if (candidateProducts.length > 1 && usedGeneric) {
          // Mostrar lista de opciones para que el usuario elija
          let response = '🔍 *Opciones encontradas:*\n';
          candidateProducts.sort((a, b) => b.score - a.score);
          candidateProducts.forEach(({ product }, idx) => {
            const formattedPrice = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            response += `\n${idx + 1}. *${product.name}* - *$${formattedPrice}*`;
          });
          response += '\n\n*Por favor, dime el nombre o número de la opción que deseas.*';
          if ('emit' in client) {
            client.emit('ai_response', {
              type: 'text',
              content: response,
            });
          }
          return response;
        }
        const baseProduct = bestProduct && bestScore > 0.3 ? bestProduct : null;
        // Diccionario de emojis sugeridos para grupos de variantes
        const groupEmojis = {
          'sopa': '🥣',
          'proteína': '🍗',
          'proteina': '🍗',
          'arroz': '🍚',
          'principio': '🥔',
          'ensalada': '🥗',
          'acompañamiento': '🍟',
          'bebida': '🥤',
        };
        function getGroupEmoji(groupName) {
          const key = groupName.trim().toLowerCase();
          return groupEmojis[key] || '';
        }
        if (baseProduct) {
          // 2. Buscar variantes mencionadas en el mensaje
          let selectedVariants = [];
          let missingGroups = [];
          if (baseProduct.variantGroups && baseProduct.variantGroups.length > 0) {
            for (const groupVar of baseProduct.variantGroups) {
              // Filtrar variantes válidas (no 'Sin ...')
              const filteredVariants = groupVar.variants.filter(v => !v.name.trim().toLowerCase().startsWith('sin '));
              // Buscar si alguna variante de este grupo es mencionada en el mensaje
              const foundVariant = filteredVariants.find(v => normalizedText.includes(normalizeName(v.name)));
              if (foundVariant) {
                selectedVariants.push({ groupName: groupVar.name, variantName: foundVariant.name, price: foundVariant.price || 0 });
          } else {
                missingGroups.push(groupVar.name);
              }
            }
          }
          // 3. Si faltan variantes obligatorias, pedir solo lo que falta
          if (missingGroups.length > 0) {
            let response = `*Para tu* *${baseProduct.name}*, *por favor indícame tu elección para:*\n`;
            missingGroups.forEach(g => {
              const groupVar = baseProduct.variantGroups.find(gr => gr.name === g);
              if (groupVar) {
                const filteredVariants = groupVar.variants.filter(v => !v.name.trim().toLowerCase().startsWith('sin '));
                const emoji = getGroupEmoji(groupVar.name);
                response += `\n${emoji} *${groupVar.name}:* ${filteredVariants.map(v => `*${v.name}*`).join(', ')}`;
              }
            });
            response += '\n\n*Responde* con tu elección para continuar.';
          if ('emit' in client) {
            client.emit('ai_response', {
              type: 'text',
                content: response,
            });
          }
          return response;
        }
          // 4. Calcular precio total
          let totalPrice = baseProduct.price;
          selectedVariants.forEach(v => { totalPrice += v.price; });
          const formattedPrice = totalPrice.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
          // 5. Confirmar pedido y calcular subtotal automáticamente
          let response = `✅ *Pedido Detectado*\n\n🍽️ *${baseProduct.name}*`;
          if (selectedVariants.length > 0) {
            response += '\n\n*Con:*';
            selectedVariants.forEach(v => {
              const emoji = getGroupEmoji(v.groupName);
              response += `\n   ${emoji} *${v.groupName}:* *${v.variantName}*`;
            });
          }
          response += `\n\n💰 *Total estimado:* *$${formattedPrice}*`;
          response += '\n\nCalculando subtotal real...';
          if ('emit' in client) {
            client.emit('ai_response', {
              type: 'text',
              content: response,
            });
          }
          // Llamar a calculate_order_subtotal automáticamente
          try {
            const items = [{
              productName: baseProduct.name,
              quantity: 1,
              variants: selectedVariants.map(v => ({ groupName: v.groupName, variantName: v.variantName }))
            }];
            const subtotalResult = await this.executeFunction('calculate_order_subtotal', { items, locationId }, locationId, chatType);
            if ('emit' in client) {
              client.emit('ai_response', {
                type: 'text',
                content: subtotalResult.message,
              });
            }
            return response + '\n\n' + subtotalResult.message;
          } catch (err) {
            if ('emit' in client) {
              client.emit('ai_response', {
                type: 'text',
                content: '❌ Error calculando el subtotal: ' + err.message,
              });
            }
            return response + '\n\n❌ Error calculando el subtotal: ' + err.message;
        }
        }
        // Si no hay coincidencia compuesta, buscar productos por nombre parcial (como antes)
        const matchingProducts = menu.filter(product =>
          product.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(normalizedText)
        );
        // Si hay coincidencias y el usuario no está pidiendo ver el menú completo, mostrar solo ese producto
        const generalMenuPhrases = [
          'ver menu', 'ver menú', 'ver carta', 'muéstrame el menú', 'muéstrame la carta', 'qué hay de almuerzo', 'qué hay para almorzar', 'qué tienes de almuerzo', 'opciones de almuerzo', 'opciones de menú', 'carta', 'menú', 'menu', 'almuerzos', 'almuerzo'
        ];
        const isGeneralMenuRequest = generalMenuPhrases.some(phrase => normalizedText.includes(phrase));
        if (matchingProducts.length > 0 && !isGeneralMenuRequest) {
          // Mostrar detalles del producto encontrado
          let response = '';
          if (matchingProducts.length === 1) {
            const product = matchingProducts[0];
            const formattedPrice = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            response = `✅ *Producto Encontrado*\n\n🍽️ *${product.name}*\n💰 *Precio:* *$${formattedPrice}*`;
            // Mostrar variantes si existen
            if (product.variantGroups && product.variantGroups.length > 0) {
              for (const groupVar of product.variantGroups) {
                // Filtrar variantes que NO empiecen con 'Sin '
                const filteredVariants = groupVar.variants.filter(v => !v.name.trim().toLowerCase().startsWith('sin '));
                const emoji = getGroupEmoji(groupVar.name);
                if (filteredVariants.length > 0) {
                  response += `\n   ${emoji} *${groupVar.name}:*`;
                  for (const v of filteredVariants) {
                    let variantLine = ` *${v.name}*`;
                    if (v.price && v.price > 0) {
                      const variantPrice = v.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                      variantLine += ` (+$${variantPrice})`;
                    }
                    response += `\n     •${variantLine}`;
                }
              }
            }
            }
            response += '\n\n¿*Te gustaría pedir* este producto o necesitas más información?';
          } else {
            // Si hay varias coincidencias, listarlas
            response = `🔍 *Búsqueda de Producto*\n\nSe encontraron *${matchingProducts.length}* productos que coinciden con tu búsqueda:`;
            matchingProducts.forEach((product, idx) => {
              const formattedPrice = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              response += `\n${idx + 1}. *${product.name}* - *$${formattedPrice}*`;
            });
            response += '\n\n¿*Te gustaría pedir* alguno de estos productos?';
          }
        if ('emit' in client) {
          client.emit('ai_response', {
            type: 'text',
              content: response,
            });
          }
          return response;
        }
        // Si no hay coincidencias o es una consulta general, mostrar el menú completo
        const menuResult = await this.executeFunction('get_menu', { locationId }, locationId, chatType);
        if ('emit' in client) {
          client.emit('ai_response', {
            type: 'text',
            content: menuResult.message,
          });
        }
        return menuResult.message;
      } catch (error) {
        console.error('Error mostrando el menú/producto:', error);
        if ('emit' in client) {
          client.emit('error', {
            message: 'Error mostrando el menú/producto',
            details: error.message
          });
        }
        return 'Error mostrando el menú/producto. Por favor, intenta de nuevo.';
      }
    }
    // --- FIN NUEVO ---

    const conversationId = `${locationId}:${chatType}:${chatId}`;
    let conversation = this.conversations.get(conversationId);

    // Solo inicializamos la conversación si no existe
    if (!conversation) {
      try {
        console.log(`[AI Gateway] Initializing new conversation for: ${conversationId}`);
        // Get AI settings
        const aiSettings = await this.settingsService.getAISettings();
        const businessSettings = await this.settingsService.getBusinessSettings();
        const businessName = businessSettings.name;

        // Initialize conversation with system message
        if (chatType === 'admin') {
          conversation = [
            {
              role: 'system',
              content: getAdminAssistantRole({
                aiSettings,
                locationId,
                chatId,
                businessName,
              }),
            },
          ];
        } else {
          const menu = await this.productsService.findAll({ locationId });
          conversation = [
            {
              role: 'system',
              content: getRestaurantAssistantRole({
                aiSettings,
                locationId,
                chatId,
                menu,
                businessName,
              }),
            },
          ];
        }

        // Guardamos la conversación inicializada
        this.conversations.set(conversationId, conversation);
        console.log(`[AI Gateway] Conversation initialized successfully`);
      } catch (error) {
        console.error('Error initializing conversation:', error);
        return 'Error initializing conversation. Please try again.';
      }
    }

    // Agregamos el mensaje del usuario a la conversación existente
    conversation.push({
      role: 'user',
      content: text,
    });

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
      
      // Add assistant response to conversation
      conversation.push({
        role: 'assistant',
        content: response.content || '',
      });

      // Update conversation in map
      this.conversations.set(conversationId, conversation);

      // Handle function calls if any
      if (response.function_call) {
        const functionName = response.function_call.name;
        const functionArgs = JSON.parse(response.function_call.arguments);
        console.log(`[AI Gateway] Executing function: ${functionName}`, functionArgs);
        
        const functionResult = await this.executeFunction(functionName, functionArgs, locationId, chatType);
        console.log(`[AI Gateway] Function result:`, { 
          messageLength: functionResult.message.length,
          hasValidatedItems: !!functionResult.validatedItems,
          hasTotalAmount: !!functionResult.totalAmount
        });
        
        // Add function result to conversation with additional data
        const functionContent = {
          message: functionResult.message,
          ...(functionResult.validatedItems && { validatedItems: functionResult.validatedItems }),
          ...(functionResult.totalAmount && { totalAmount: functionResult.totalAmount }),
          ...(functionResult.validated && { validated: functionResult.validated }),
          ...(functionResult.orderData && { orderData: functionResult.orderData })
        };

        conversation.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionContent),
        });

        // Update conversation in map
        this.conversations.set(conversationId, conversation);
        
        // Emit response to client if it's a socket
        if ('emit' in client) {
          client.emit('ai_response', {
            type: 'text',
            content: functionResult.message,
          });
        }
        
        return functionResult.message;
      }

      // Emit response to client if it's a socket
      if ('emit' in client) {
        client.emit('ai_response', {
          type: 'text',
          content: response.content,
        });
      }

      // --- NUEVO: Confirmación de orden y creación automática ---
      // Detectar si el usuario confirma la orden
      const confirmKeywords = ['sí', 'si', 'confirmo', 'confirmar', 'correcto', 'está bien', 'ok', 'dale', 'listo'];
      if (confirmKeywords.some(k => normalizedText.trim().startsWith(k))) {
        // Buscar el último orderData validado en el estado de la conversación
        const state = this.orderState.get(conversationIdMenu) as any || {};
        const orderData = state && state.validatedOrderData;
        // Validar que existan todos los datos de cliente antes de crear la orden
        if (orderData && orderData.customerName && orderData.deliveryAddress && orderData.phone && orderData.neighborhood && orderData.paymentMethod) {
          try {
            const createdOrder = await this.ordersService.create({
              items: orderData.items,
              customerName: orderData.customerName,
              deliveryAddress: orderData.deliveryAddress,
              phone: orderData.phone,
              neighborhood: orderData.neighborhood,
              paymentMethod: orderData.paymentMethod,
              locationId: orderData.locationId,
              deliveryFee: orderData.deliveryFee,
              type: OrderType.DELIVERY,
              source: OrderSource.WHATSAPP,
            });
            if ('emit' in client) {
              client.emit('ai_response', {
                type: 'text',
                content: `✅ ¡Tu orden ha sido creada exitosamente!\n\nNúmero de orden: *${createdOrder.id}*\n\nPronto recibirás la confirmación de tu pedido. ¡Gracias por confiar en nosotros!`,
              });
            }
            // Limpiar el estado de la orden después de crearla
            this.orderState.delete(conversationIdMenu);
            return `✅ ¡Tu orden ha sido creada exitosamente!\n\nNúmero de orden: *${createdOrder.id}*\n\nPronto recibirás la confirmación de tu pedido. ¡Gracias por confiar en nosotros!`;
          } catch (error) {
            if ('emit' in client) {
              client.emit('ai_response', {
                type: 'text',
                content: '❌ Error creando la orden: ' + error.message,
              });
            }
            return '❌ Error creando la orden: ' + error.message;
          }
        } else {
          const missingFields = [];
          if (!orderData?.customerName) missingFields.push('nombre completo');
          if (!orderData?.deliveryAddress) missingFields.push('dirección de entrega');
          if (!orderData?.phone) missingFields.push('número de teléfono');
          if (!orderData?.neighborhood) missingFields.push('barrio o sector');
          if (!orderData?.paymentMethod) missingFields.push('método de pago');
          const msg = missingFields.length > 0
            ? `Por favor, proporciona los siguientes datos antes de confirmar la orden: ${missingFields.join(', ')}.`
            : 'Por favor, primero proporciona todos los datos de entrega antes de confirmar la orden.';
          if ('emit' in client) {
            client.emit('ai_response', {
              type: 'text',
              content: msg,
            });
          }
          return msg;
        }
      }
      // --- FIN NUEVO ---

      return response.content || 'No response from AI';
    } catch (error) {
      console.error('Error in handleTextInput:', error);
      const errorMessage = 'Error processing your message. Please try again.';
      
      if ('emit' in client) {
        client.emit('error', {
          message: errorMessage,
          details: error.message
        });
      }
      
      return errorMessage;
    }
  }

  @SubscribeMessage('transcribe_audio')
  async handleTranscribeAudio(client: Socket, data: { audio: Buffer, mimeType?: string }) {
    try {
      if (!data.audio) {
        client.emit('error', { message: 'No audio data received' });
        return;
      }
      // Procesar el audio con el servicio de STT
      const text = await this.sttService.transcribeAudio(data.audio);
      client.emit('transcription_result', { text });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      client.emit('error', { message: 'Error transcribing audio', details: error.message });
    }
  }

  private async executeFunction(functionName: string, functionArgs: any, locationId: string, chatType: string): Promise<{ message: string; validatedItems?: any[]; totalAmount?: number; validated?: boolean; orderData?: any }> {
    console.log(`[AI Gateway] executeFunction called:`, { functionName, chatType, locationId });
    
    // Handle admin functions
    if (chatType === 'admin') {
      console.log(`[AI Gateway] Processing admin function: ${functionName}`);
      switch (functionName) {
        case 'get_sales_report':
          // TODO: Implement sales report generation
          return {
            message: `Generando reporte de ventas para el período especificado...`
          };

        case 'get_inventory_status':
          // TODO: Implement inventory status check
          return {
            message: `Verificando estado del inventario...`
          };

        case 'get_staff_performance':
          // TODO: Implement staff performance metrics
          return {
            message: `Generando métricas de rendimiento del personal...`
          };

        default:
          return {
            message: `Función administrativa no implementada: ${functionName}`
          };
      }
    }

    // Handle restaurant functions
    console.log(`[AI Gateway] Processing restaurant function: ${functionName}`);
    switch (functionName) {
      case 'search_products_by_name':
        try {
          console.log(`[AI Gateway] search_products_by_name: Starting search`);
          const { productName, locationId: searchLocationId } = functionArgs;
          console.log(`[AI Gateway] search_products_by_name: Searching for "${productName}" in location ${searchLocationId}`);
          
          const menu = await this.productsService.findAll({ locationId: searchLocationId });
          console.log(`[AI Gateway] search_products_by_name: Found ${menu.length} products in menu`);
          
          // Buscar productos que coincidan con el nombre (case insensitive)
          const matchingProducts = menu.filter(product => 
            product.name.toLowerCase().includes(productName.toLowerCase())
          );
          console.log(`[AI Gateway] search_products_by_name: Found ${matchingProducts.length} matching products`);

          if (matchingProducts.length === 0) {
            return {
              message: `🔍 *Búsqueda de Producto*\n\n❌ No se encontraron productos que coincidan con *"${productName}"*.\n\nPor favor, verifica el nombre del producto o intenta con una palabra clave diferente.`
            };
          }

          if (matchingProducts.length === 1) {
            const product = matchingProducts[0];
            const formattedPrice = product.price.toLocaleString('es-CO', { 
              minimumFractionDigits: 0, 
              maximumFractionDigits: 0 
            });
            return {
              message: `✅ *Producto Encontrado*\n\n🍽️ *${product.name}*\n💰 Precio: *$${formattedPrice}*\n🆔 ID: \`${product.id}\`\n\n¡Perfecto! Este producto está disponible.`
            };
          }

          // Si hay múltiples coincidencias, mostrar todas con formato mejorado
          const productList = matchingProducts.map((product, index) => {
            const formattedPrice = product.price.toLocaleString('es-CO', { 
              minimumFractionDigits: 0, 
              maximumFractionDigits: 0 
            });
            return `${index + 1}. *${product.name}*\n   💰 $${formattedPrice} | 🆔 \`${product.id}\``;
          }).join('\n');

          return {
            message: `🔍 *Búsqueda de Producto*\n\nSe encontraron *${matchingProducts.length}* productos que coinciden con *"${productName}"*:\n\n${productList}\n\nPor favor, especifica mejor el nombre del producto para obtener un resultado más preciso.`
          };
        } catch (error) {
          console.error('Error in search_products_by_name:', error);
          return {
            message: `❌ Error buscando productos: ${error.message}`
          };
        }

      case 'get_menu':
        try {
          const { locationId: menuLocationId } = functionArgs;
          const menu = await this.productsService.findAll({ locationId: menuLocationId });
          if (!menu || menu.length === 0) {
            return { message: 'No se encontró ningún producto en el menú para esta ubicación.' };
          }

          // Obtener categorías ordenadas por 'order'
          const categoriesList = await this.categoriesService.categories({ orderBy: { order: 'asc' } });
          const categories: Record<string, { name: string; products: any[] }> = {};
          for (const cat of categoriesList) {
            categories[cat.id] = { name: cat.name, products: [] };
          }
          menu.forEach(product => {
            const catId = product.categoryId;
            if (!catId) return;
            if (!categories[catId]) {
              categories[catId] = { name: '', products: [] };
            }
            categories[catId].products.push(product);
          });

          let menuText = '🍽️ *Menú del Restaurante*\n';
          let prodCount = 1;
          for (const cat of categoriesList) {
            const group = categories[cat.id];
            if (!group || group.products.length === 0) continue;
            menuText += `\n*${group.name}*\n`;
            for (const product of group.products) {
              const price = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              menuText += `\n${prodCount}. *${product.name}* - $${price}`;
              // Mostrar variantes si existen
              const prod = product;
              if (prod.variantGroups && prod.variantGroups.length > 0) {
                for (const groupVar of prod.variantGroups) {
                  // Filtrar variantes que NO empiecen con 'Sin '
                  const filteredVariants = groupVar.variants.filter(v => !v.name.trim().toLowerCase().startsWith('sin '));
                  if (filteredVariants.length > 0) {
                    menuText += `\n   _${groupVar.name}_:`;
                    for (const v of filteredVariants) {
                      let variantLine = ` ${v.name}`;
                      if (v.price && v.price > 0) {
                        const variantPrice = v.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                        variantLine += ` (+$${variantPrice})`;
                      }
                      menuText += `\n     • ${variantLine}`;
                    }
                  }
                }
              }
              menuText += '\n';
              prodCount++;
            }
            menuText += '\n';
          }
          menuText += '\n¿Te gustaría pedir algo o necesitas más información sobre algún plato? 😊';
          return { message: menuText };
        } catch (error) {
          console.error('Error in get_menu:', error);
          return { message: `❌ Error obteniendo el menú: ${error.message}` };
        }

      case 'calculate_order_subtotal':
        try {
          console.log(`[AI Gateway] calculate_order_subtotal: Starting calculation`);
          const { items, locationId: calcLocationId } = functionArgs;
          console.log(`[AI Gateway] calculate_order_subtotal: Processing ${items.length} items for location ${calcLocationId}`);
          console.log(`[AI Gateway] calculate_order_subtotal: Items:`, items);
          
          // Verificar que items sea un array válido
          if (!Array.isArray(items) || items.length === 0) {
            console.error(`[AI Gateway] calculate_order_subtotal: Invalid items array:`, items);
            return {
              message: `❌ Error: No se proporcionaron productos válidos para calcular.`
            };
          }

          // Verificar que cada item tenga las propiedades requeridas
          for (const item of items) {
            if (!item.productName || !item.quantity) {
              console.error(`[AI Gateway] calculate_order_subtotal: Invalid item:`, item);
              return {
                message: `❌ Error: Cada producto debe tener un nombre y cantidad válidos.`
              };
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0) {
              console.error(`[AI Gateway] calculate_order_subtotal: Invalid quantity for ${item.productName}:`, item.quantity);
              return {
                message: `❌ Error: La cantidad para "${item.productName}" debe ser un número mayor a 0.`
              };
            }
            if (item.quantity > 10) {
              console.log(`[AI Gateway] calculate_order_subtotal: Large quantity detected for ${item.productName}: ${item.quantity}`);
            }
          }

          console.log(`[AI Gateway] calculate_order_subtotal: Fetching menu from database...`);
          const menu = await this.productsService.findAll({ locationId: calcLocationId });
          console.log(`[AI Gateway] calculate_order_subtotal: Found ${menu.length} products in menu`);
          
          if (menu.length === 0) {
            console.error(`[AI Gateway] calculate_order_subtotal: No products found for location ${calcLocationId}`);
            return {
              message: `❌ Error: No se encontraron productos en esta ubicación. Por favor, verifica la configuración.`
            };
          }
          
          const validatedItems = [];
          let totalAmount = 0;
          const errors = [];
          const variantRequests = [];
          let deliveryFee = 0;
          
          // Obtener el valor de domicilio desde la configuración
          if (chatType === 'whatsapp') {
            deliveryFee = await this.settingsService.getDeliveryFee();
          }

          for (const item of items) {
            console.log(`[AI Gateway] calculate_order_subtotal: Processing item:`, item);
            // Buscar el producto por nombre
            const matchingProducts = menu.filter(product => 
              product.name.toLowerCase().includes(item.productName.toLowerCase())
            );
            console.log(`[AI Gateway] calculate_order_subtotal: Found ${matchingProducts.length} matches for "${item.productName}"`);

            if (matchingProducts.length === 0) {
              errors.push(`❌ Producto no encontrado: "${item.productName}"`);
              continue;
            }

            if (matchingProducts.length > 1) {
              errors.push(`❌ Múltiples productos coinciden con "${item.productName}". Por favor, especifica mejor el nombre.`);
              continue;
            }

            const product = matchingProducts[0];
            const prod: any = product;
            const variantGroups = prod.variantGroups || [];
            let variantSummary = [];
            if (variantGroups.length > 0) {
              // Validar que el item.variants sea un array y tenga una selección para cada grupo
              if (!Array.isArray(item.variants)) item.variants = [];
              const missingGroups = [];
              const invalidGroups = [];
              let price = product.price;
              for (const group of variantGroups) {
                const selected = item.variants.find(v => v.groupName && normalizeName(v.groupName) === normalizeName(group.name));
                if (!selected) {
                  missingGroups.push(`• *${group.name}*: ${group.variants.map(v => v.name).join(', ')}`);
                  continue;
                }
                const variant = group.variants.find(v => normalizeName(v.name) === normalizeName(selected.variantName));
                if (!variant) {
                  invalidGroups.push(`• *${group.name}*: La variante "${selected.variantName}" no existe. Opciones: ${group.variants.map(v => v.name).join(', ')}`);
                  continue;
                }
                price += variant.price ?? 0;
                variantSummary.push(`${group.name}: ${variant.name}`);
              }
              if (missingGroups.length > 0) {
                variantRequests.push(`El producto *${product.name}* requiere que selecciones una opción para cada grupo:
${missingGroups.join('\n')}`);
                continue;
              }
              if (invalidGroups.length > 0) {
                errors.push(`Errores en variantes de *${product.name}*:
${invalidGroups.join('\n')}`);
                continue;
              }
              const subtotal = price * item.quantity;
              totalAmount += subtotal;
              validatedItems.push({
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unitPrice: price,
                subtotal,
                variants: item.variants,
                notes: item.notes || '',
                variantSummary: variantSummary.map(v => {
                  // Si ya viene en formato 'Grupo: Variante', lo separamos
                  const parts = v.split(':');
                  if (parts.length === 2) {
                    return `**${parts[0].trim()}**: ${parts[1].trim()}`;
                  }
                  return v;
                }).join(', ')
              });
              continue;
            }
            // Producto sin variantes
            const subtotal = product.price * item.quantity;
            totalAmount += subtotal;
            validatedItems.push({
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              unitPrice: product.price,
              subtotal: subtotal,
              variants: [],
              notes: item.notes || '',
              variantSummary: ''
            });
          }

          // Si hay productos que requieren selección de variante
          if (variantRequests.length > 0) {
            return {
              message: `🚨 *Falta seleccionar variante:*

${variantRequests.join('\n')}

Por favor, responde indicando la variante deseada para cada producto.`
            };
          }

          if (errors.length > 0) {
            return {
              message: `🚨 *Errores encontrados:*

${errors.join('\n')}

Por favor, corrige los nombres de los productos y vuelve a intentar.`
            };
          }

          // Crear resumen de la orden con formato mejorado
          const itemsSummary = validatedItems.map((item, index) =>
            `${index + 1}. *${item.productName}${item.variantSummary ? ' (' + item.variantSummary + ')' : ''}*\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`
          ).join('\n');

          const formattedTotal = (totalAmount + deliveryFee).toLocaleString('es-CO', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
          });

          let deliveryFeeText = '';
          if (deliveryFee > 0) {
            deliveryFeeText = `\n🚚 *Domicilio:* $${deliveryFee.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          }

          let response = `📋 *Resumen de tu Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}${deliveryFeeText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ Todos los productos fueron validados correctamente.\n\n¿Deseas agregar algo más a tu orden o procedemos con tus datos de entrega?`;
          return {
            message: response,
            validatedItems,
            totalAmount: totalAmount + deliveryFee
          };
        } catch (error) {
          console.error('Error in calculate_order_subtotal:', error);
          console.error('Error stack:', error.stack);
          return {
            message: `❌ Error calculando subtotales: ${error.message}. Por favor, intenta de nuevo.`
          };
        }

      case 'validate_order_before_creation':
        try {
          const { items, totalAmount, customerName, deliveryAddress, phone, neighborhood, paymentMethod, locationId: validateLocationId } = functionArgs;
          const menu = await this.productsService.findAll({ locationId: validateLocationId });

          // Obtener el valor de domicilio desde la configuración
          const deliveryFee = await this.settingsService.getDeliveryFee();

          // Validar variantes en los items
          const missingVariants = [];
          const invalidVariants = [];
          for (const item of items) {
            const product = menu.find(p => p.id === item.productId);
            const prod: any = product;
            const variantGroups = prod.variantGroups || [];
            if (variantGroups.length > 0) {
              if (!Array.isArray(item.variants)) item.variants = [];
              const missingGroups = [];
              const invalidGroups = [];
              let price = product.price;
              let variantSummary = [];
              for (const group of variantGroups) {
                const selected = item.variants.find(v => v.groupName && normalizeName(v.groupName) === normalizeName(group.name));
                if (!selected) {
                  missingGroups.push(`• *${group.name}*: ${group.variants.map(v => v.name).join(', ')}`);
                  continue;
                }
                const variant = group.variants.find(v => normalizeName(v.name) === normalizeName(selected.variantName));
                if (!variant) {
                  invalidGroups.push(`• *${group.name}*: La variante "${selected.variantName}" no existe. Opciones: ${group.variants.map(v => v.name).join(', ')}`);
                  continue;
                }
                price += variant.price ?? 0;
                variantSummary.push(`${group.name}: ${variant.name}`);
              }
              if (missingGroups.length > 0) {
                missingVariants.push(`El producto *${product.name}* requiere que selecciones una opción para cada grupo:\n${missingGroups.join('\n')}`);
                continue;
              }
              if (invalidGroups.length > 0) {
                invalidVariants.push(`Errores en variantes de *${product.name}*:\n${invalidGroups.join('\n')}`);
                continue;
              }
              // Enriquecer item
              item.unitPrice = price;
              item.subtotal = price * item.quantity;
              item.variantSummary = variantSummary.join(', ');
            } else {
              // Producto sin variantes
              item.unitPrice = product.price;
              item.subtotal = product.price * item.quantity;
              item.variants = [];
            }
          }
          if (missingVariants.length > 0) {
            return {
              message: `🚨 *Falta seleccionar variante:*

${missingVariants.join('\n')}

Por favor, responde indicando la variante deseada para cada producto.`
            };
          }
          if (invalidVariants.length > 0) {
            return {
              message: `🚨 *Errores de variante:*

${invalidVariants.join('\n')}

Por favor, corrige las variantes y vuelve a intentar.`
            };
          }

          // Validar que todos los campos requeridos estén presentes
          if (!customerName || !deliveryAddress || !phone || !neighborhood || !paymentMethod) {
            return {
              message: `🚨 *Datos incompletos*\n\n❌ Faltan datos del cliente. Por favor, completa toda la información requerida.`
            };
          }

          // Validar que los items tengan la estructura correcta
          if (!items || items.length === 0) {
            return {
              message: `🚨 *Orden vacía*\n\n❌ No hay productos en la orden. Por favor, selecciona al menos un producto.`
            };
          }

          // Validar que los cálculos sean correctos
          const calculatedTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
          // Ahora solo comparo el subtotal de productos
          if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
            return {
              message: `🚨 *Error en cálculos*\n\n❌ Error en los cálculos. Subtotal calculado: $${calculatedTotal}, Subtotal proporcionado: $${totalAmount}. Por favor, recalcula la orden.`
            };
          }

          // El total mostrado y guardado sí suma el domicilio
          const totalWithDelivery = calculatedTotal + deliveryFee;

          // Crear resumen final para confirmación con formato mejorado
          const itemsSummary = items.map((item, index) =>
            `${index + 1}. *${item.productName}${item.variantSummary ? ' (' + item.variantSummary + ')' : ''}*\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`
          ).join('\n');

          const formattedTotal = totalWithDelivery.toLocaleString('es-CO', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
          });

          let deliveryFeeText = '';
          if (deliveryFee > 0) {
            deliveryFeeText = `\n🚚 *Domicilio:* $${deliveryFee.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          }

          // Mapear métodos de pago a emojis
          const paymentEmojis = {
            'CASH': '💵',
            'CREDIT_CARD': '💳',
            'DEBIT_CARD': '💳',
            'TRANSFER': '🏦'
          };

          const paymentDisplay = {
            'CASH': 'Efectivo',
            'CREDIT_CARD': 'Tarjeta de Crédito',
            'DEBIT_CARD': 'Tarjeta Débito',
            'TRANSFER': 'Transferencia'
          };

          const customerInfo = `👤 *Datos del Cliente*\n━━━━━━━━━━━━━━━━━━━━━━━━\n• *Nombre:* ${customerName}\n• *Dirección:* ${deliveryAddress}\n• *Teléfono:* ${phone}\n• *Barrio:* ${neighborhood}\n• *Método de pago:* ${paymentEmojis[paymentMethod]} ${paymentDisplay[paymentMethod]}`;

          const result = {
            message: `📋 *RESUMEN FINAL DE LA ORDEN*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${customerInfo}\n\n🍽️ *Detalles del Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}${deliveryFeeText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ La orden está validada y lista para crear.\n\n¿Confirmas que toda la información es correcta?\n\nResponde *\"Sí\"* o *\"Confirmo\"* para proceder con la orden.`,
            validated: true,
            orderData: {
              items: items.map(item => {
                const product = menu.find(p => p.id === item.productId);
                const prod: any = product;
                const variantGroups = prod.variantGroups || [];
                let variants = [];
                if (variantGroups.length > 0 && Array.isArray(item.variants)) {
                  variants = variantGroups.map(group => {
                    const selected = item.variants.find(v => v.groupName && normalizeName(v.groupName) === normalizeName(group.name));
                    if (!selected) return null;
                    const variant = group.variants.find(v => normalizeName(v.name) === normalizeName(selected.variantName));
                    if (!variant) return null;
                    return {
                      productVariantId: variant.id,
                      groupName: group.name
                    };
                  }).filter(Boolean);
                }
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  variants,
                  notes: item.notes
                };
              }),
              customerName,
              deliveryAddress,
              phone,
              neighborhood,
              paymentMethod,
              locationId: validateLocationId,
              deliveryFee
            }
          };

          // --- NUEVO: Guardar validatedOrderData en el estado de la conversación ---
          if (result.validated && result.orderData) {
            const stateKey = `${validateLocationId}:${chatType}:${functionArgs.chatId || ''}`;
            const prevState = this.orderState.get(stateKey) as any || {};
            this.orderState.set(stateKey, {
              items: prevState.items || [],
              customerData: prevState.customerData || {},
              step: prevState.step || 'products',
              validatedOrderData: result.orderData
            });
          }
          // --- FIN NUEVO ---

          return result;
        } catch (error) {
          console.error('Error in validate_order_before_creation:', error);
          return {
            message: `❌ Error validando la orden: ${error.message}`
          };
        }

      case 'create_order':
        try {
          console.log('Creating order with args:', functionArgs);
          // Ensure locationId is present
          if (!locationId) {
            throw new Error('No location ID found for this client');
          }
          if (!functionArgs.customerName) {
            throw new Error('Customer name is required');
          }
          
          // Obtener el valor de domicilio desde la configuración
          const deliveryFee = await this.settingsService.getDeliveryFee();
          
          // Llamar al servicio real para crear la orden en la base de datos
          const createdOrder = await this.ordersService.create({
            items: functionArgs.items,
              customerName: functionArgs.customerName,
              deliveryAddress: functionArgs.deliveryAddress,
              phone: functionArgs.phone,
              neighborhood: functionArgs.neighborhood,
              paymentMethod: functionArgs.paymentMethod,
              locationId: functionArgs.locationId,
            deliveryFee: functionArgs.deliveryFee || deliveryFee || 0,
            type: OrderType.DELIVERY,
            source: OrderSource.WHATSAPP,
          });

          return {
            message: `✅ ¡Tu orden ha sido creada exitosamente!\n\nNúmero de orden: *${createdOrder.id}*\n\nPronto recibirás la confirmación de tu pedido. ¡Gracias por confiar en nosotros!`,
            validated: true
          };
        } catch (error) {
          console.error('Error in create_order:', error);
          return {
            message: `❌ Error creando la orden: ${error.message}`
          };
        }

      default:
        return {
          message: `Función no implementada: ${functionName}`
        };
    }
  }
}