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

// Utilidad para obtener todas las variantes de todos los grupos
function getAllVariants(product) {
  if (!product.variantGroups) return [];
  return product.variantGroups.flatMap(g => g.variants || []);
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

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    private settingsService: SettingsService,
    private sttService: STTService,
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
    ];
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (
      chatType !== 'admin' &&
      menuKeywords.some(k => normalizedText.includes(k))
    ) {
      // Responder directamente con el menú
      try {
        const menu = await this.productsService.findAll({ locationId });
        if (!menu || menu.length === 0) {
          if ('emit' in client) {
            client.emit('ai_response', {
              type: 'text',
              content: 'No se encontró ningún producto en el menú para esta ubicación.'
            });
          }
          return 'No se encontró ningún producto en el menú para esta ubicación.';
        }
        // Agrupar productos por categoría
        const categories = {};
        menu.forEach(product => {
          const catId = product.category.id;
          if (!categories[catId]) {
            categories[catId] = { name: product.category.name, products: [] };
          }
          categories[catId].products.push(product);
        });
        let menuText = 'Te comparto el 🍽️ *Menú del Restaurante*\n';
        let prodCount = 1;
        const allCategories = Object.values(categories) as { name: string; products: any[] }[];
        const bebidas = allCategories.filter(cat => cat.name.toLowerCase().includes('bebida'));
        const otras = allCategories.filter(cat => !cat.name.toLowerCase().includes('bebida'));
        const orderedCategories = [...otras, ...bebidas];
        for (const cat of orderedCategories) {
          menuText += `\n\n**${cat.name}**\n\n`;
          for (const product of cat.products) {
            const price = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            menuText += `${prodCount}. *${product.name}* - $${price}\n\n`;
            prodCount++;
          }
          menuText += '\n';
        }
        menuText += '\n¿Te gustaría pedir algo? 😊';
        if ('emit' in client) {
          client.emit('ai_response', {
            type: 'text',
            content: menuText
          });
        }
        return menuText;
      } catch (error) {
        if ('emit' in client) {
          client.emit('ai_response', {
            type: 'text',
            content: `❌ Error obteniendo el menú: ${error.message}`
          });
        }
        return `❌ Error obteniendo el menú: ${error.message}`;
      }
    }

    // Verificar si la IA está habilitada
    try {
      const aiSettings = await this.settingsService.getAISettings();
      // Solo verificar el switch para WhatsApp, otros tipos de chat funcionan siempre
      if (chatType === 'whatsapp' && !aiSettings?.enabled) {
        console.log(`[AI Gateway] AI is disabled for WhatsApp, not processing message`);
        return ''; // Retornar string vacío para indicar que no se debe enviar respuesta
      }
    } catch (error) {
      console.error('Error checking AI settings:', error);
      // En caso de error, solo bloquear WhatsApp, permitir otros tipos
      if (chatType === 'whatsapp') {
        return ''; // En caso de error, no procesar WhatsApp
      }
    }

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
            // Obtener todas las variantes de todos los grupos
            const allVariants = getAllVariants(product);
            if (allVariants.length > 0) {
              if (!item.variantName) {
                const variantNames = allVariants.map(v => v.name).join(', ');
                variantRequests.push(`El producto *${product.name}* tiene variantes. Por favor, indícanos cuál prefieres. Opciones: ${variantNames}`);
                continue;
              }
              const variant = allVariants.find(v => v.name.toLowerCase() === item.variantName.toLowerCase());
              if (!variant) {
                const variantNames = allVariants.map(v => v.name).join(', ');
                errors.push(`❌ La variante "${item.variantName}" no existe para el producto *${product.name}*. Opciones válidas: ${variantNames}`);
                continue;
              }
              const price = variant.price ?? product.price;
              const subtotal = price * item.quantity;
              totalAmount += subtotal;
              validatedItems.push({
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unitPrice: price,
                subtotal: subtotal,
                variantName: variant.name,
                notes: item.notes || ''
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
              notes: item.notes || ''
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
            `${index + 1}. *${item.productName}${item.variantName ? ' (' + item.variantName + ')' : ''}*\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`
          ).join('\n');

          const formattedTotal = totalAmount.toLocaleString('es-CO', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
          });

          const result = {
            message: `📋 *Resumen de tu Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ Todos los productos fueron validados correctamente.\n\n¿Deseas agregar algo más a tu orden o procedemos con tus datos de entrega?`,
            validatedItems,
            totalAmount
          };

          console.log(`[AI Gateway] calculate_order_subtotal: Returning result with message length: ${result.message.length}`);
          return result;
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

          // Validar variantes en los items
          const missingVariants = [];
          const invalidVariants = [];
          for (const item of items) {
            const product = menu.find(p => p.id === item.productId);
            const allVariants = getAllVariants(product);
            if (allVariants.length > 0) {
              if (!item.variantName) {
                const variantNames = allVariants.map(v => v.name).join(', ');
                missingVariants.push(`El producto *${product.name}* requiere que selecciones una variante. Opciones: ${variantNames}`);
                continue;
              }
              const variant = allVariants.find(v => v.name.toLowerCase() === item.variantName.toLowerCase());
              if (!variant) {
                const variantNames = allVariants.map(v => v.name).join(', ');
                invalidVariants.push(`La variante "${item.variantName}" no existe para el producto *${product.name}*. Opciones válidas: ${variantNames}`);
              }
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

          // Enriquecer items
          let enrichedItems = items;
          if (
            items.length > 0 &&
            (!items[0].productName || !items[0].unitPrice || !items[0].subtotal)
          ) {
            const menu = await this.productsService.findAll({ locationId: validateLocationId });
            enrichedItems = items.map(item => {
              const product = menu.find(p => p.id === item.productId);
              if (!product) {
                throw new Error(`Producto no encontrado para ID: ${item.productId}`);
              }
              let unitPrice = product.price;
              let variantName = undefined;
              const allVariants = getAllVariants(product);
              if (allVariants.length > 0 && item.variantName) {
                const variant = allVariants.find(v => v.name.toLowerCase() === item.variantName.toLowerCase());
                if (variant) {
                  unitPrice = variant.price ?? product.price;
                  variantName = variant.name;
                }
              }
              const subtotal = unitPrice * item.quantity;
              return {
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unitPrice,
                subtotal,
                variantName: variantName || item.variantName,
                notes: item.notes || ''
              };
            });
          }

          // Validar que todos los campos requeridos estén presentes
          if (!customerName || !deliveryAddress || !phone || !neighborhood || !paymentMethod) {
            return {
              message: `🚨 *Datos incompletos*\n\n❌ Faltan datos del cliente. Por favor, completa toda la información requerida.`
            };
          }

          // Validar que los items tengan la estructura correcta
          if (!enrichedItems || enrichedItems.length === 0) {
            return {
              message: `🚨 *Orden vacía*\n\n❌ No hay productos en la orden. Por favor, selecciona al menos un producto.`
            };
          }

          // Validar que los cálculos sean correctos
          const calculatedTotal = enrichedItems.reduce((sum, item) => sum + item.subtotal, 0);
          if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
            return {
              message: `🚨 *Error en cálculos*\n\n❌ Error en los cálculos. Total calculado: $${calculatedTotal}, Total proporcionado: $${totalAmount}. Por favor, recalcula la orden.`
            };
          }

          // Crear resumen final para confirmación con formato mejorado
          const itemsSummary = enrichedItems.map((item, index) => 
            `${index + 1}. *${item.productName}${item.variantName ? ' (' + item.variantName + ')' : ''}*\n   └ ${item.quantity} × $${item.unitPrice} = *$${item.subtotal}*`
          ).join('\n');

          const formattedTotal = calculatedTotal.toLocaleString('es-CO', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
          });

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

          return {
            message: `📋 *RESUMEN FINAL DE LA ORDEN*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${customerInfo}\n\n🍽️ *Detalles del Pedido*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${itemsSummary}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *Total a pagar: $${formattedTotal}*\n\n✅ La orden está validada y lista para crear.\n\n¿Confirmas que toda la información es correcta?\n\nResponde *\"Sí\"* o *\"Confirmo\"* para proceder con la orden.`,
            validated: true,
            orderData: {
              items: enrichedItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                variantName: item.variantName,
                notes: item.notes
              })),
              customerName,
              deliveryAddress,
              phone,
              neighborhood,
              paymentMethod,
              locationId: validateLocationId
            }
          };
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
          const menu = await this.productsService.findAll({ locationId });
          const validProductIds = new Set(menu.map(product => product.id));

          // Validar variantes en los items
          for (const item of functionArgs.items) {
            const product = menu.find(p => p.id === item.productId);
            const allVariants = getAllVariants(product);
            if (allVariants.length > 0) {
              if (!item.variantName) {
                const variantNames = allVariants.map(v => v.name).join(', ');
                throw new Error(`El producto *${product.name}* requiere que selecciones una variante. Opciones: ${variantNames}`);
              }
              const variant = allVariants.find(v => v.name.toLowerCase() === item.variantName.toLowerCase());
              if (!variant) {
                const variantNames = allVariants.map(v => v.name).join(', ');
                throw new Error(`La variante "${item.variantName}" no existe para el producto *${product.name}*. Opciones válidas: ${variantNames}`);
              }
            }
          }

          // Validate product IDs
          const invalidProducts = functionArgs.items.filter(
            item => !validProductIds.has(item.productId)
          );

          if (invalidProducts.length > 0) {
            throw new Error(`Invalid product IDs found: ${invalidProducts.map(p => p.productId).join(', ')}`);
          }

          // Create the order with the correct type
          const order = await this.ordersService.create({
            ...functionArgs,
            locationId,
            type: 'DELIVERY', // Always set to DELIVERY for AI orders
            status: 'PENDING',
            tableId: undefined, // Ensure tableId is not set for delivery orders
            source: 'WHATSAPP',
          });

          return {
            message: `🎉 *¡Orden Creada Exitosamente!*\n\n📋 *Orden #${order.id}*\n👤 Cliente: *${functionArgs.customerName}*\n📍 Dirección: ${functionArgs.deliveryAddress}\n📞 Teléfono: ${functionArgs.phone}\n\n✅ Tu pedido ha sido recibido y está siendo procesado.\n\n¡Gracias por tu compra! 😊`
          };
        } catch (error) {
          console.error('Error in create_order:', error);
          return {
            message: `❌ Error creando la orden: ${error.message}`
          };
        }

      case 'get_menu':
        try {
          const { locationId: menuLocationId } = functionArgs;
          const menu = await this.productsService.findAll({ locationId: menuLocationId });
          if (!menu || menu.length === 0) {
            return { message: 'No se encontró ningún producto en el menú para esta ubicación.' };
          }

          // Agrupar productos por categoría
          const categories: Record<string, { name: string; products: any[] }> = {};
          menu.forEach(product => {
            const catId = product.category.id;
            if (!categories[catId]) {
              categories[catId] = { name: product.category.name, products: [] };
            }
            categories[catId].products.push(product);
          });

          let menuText = 'Te comparto el 🍽️ *Menú del Restaurante*\n';
          let prodCount = 1;
          const allCategories = Object.values(categories) as { name: string; products: any[] }[];
          const bebidas = allCategories.filter(cat => cat.name.toLowerCase().includes('bebida'));
          const otras = allCategories.filter(cat => !cat.name.toLowerCase().includes('bebida'));
          const orderedCategories = [...otras, ...bebidas];
          for (const cat of orderedCategories) {
            menuText += `\n\n**${cat.name}**\n\n`;
            for (const product of cat.products) {
              const price = product.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              menuText += `${prodCount}. *${product.name}* - $${price}\n\n`;
              prodCount++;
            }
            menuText += '\n';
          }
          menuText += '\n¿Te gustaría pedir algo? 😊';
          return { message: menuText };
        } catch (error) {
          console.error('Error in get_menu:', error);
          return { message: `❌ Error obteniendo el menú: ${error.message}` };
        }

      default:
        return {
          message: `Función no implementada: ${functionName}`
        };
    }
  }
}