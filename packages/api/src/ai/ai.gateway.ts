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
            }),
          };
        }

        this.conversations.set(conversationId, [systemMessage]);
      }

      // Send welcome message
      client.emit('ai_response', {
        type: 'text',
        content: `¡Hola! Soy ${aiSettings.name}, tu asistente ${chatType === 'admin' ? 'administrativo' : 'virtual'}. ¿En qué puedo ayudarte hoy?`,
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

    if (!locationId || !chatType || !chatId) {
      console.error('Missing required parameters for text input');
      return 'Error: Missing required parameters';
    }

    const conversationId = `${locationId}:${chatType}:${chatId}`;
    let conversation = this.conversations.get(conversationId);

    // Solo inicializamos la conversación si no existe
    if (!conversation) {
      try {
        // Get AI settings
        const aiSettings = await this.settingsService.getAISettings();

        // Initialize conversation with system message
        if (chatType === 'admin') {
          conversation = [
            {
              role: 'system',
              content: getAdminAssistantRole({
                aiSettings,
                locationId,
                chatId,
              }),
            },
          ];
        } else {
          const menu = await this.productsService.findAll({
            locationId,
          });
          conversation = [
            {
              role: 'system',
              content: getRestaurantAssistantRole({
                aiSettings,
                locationId,
                chatId,
                menu,
              }),
            },
          ];
        }

        // Guardamos la conversación inicializada
        this.conversations.set(conversationId, conversation);
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
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: conversation,
        functions: chatType === 'admin' ? adminAssistantFunctions : restaurantAssistantFunctions,
        function_call: 'auto',
      });

      const response = completion.choices[0].message;
      
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
        const functionResult = await this.executeFunction(functionName, functionArgs, locationId, chatType);
        
        // Add function result to conversation
        conversation.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult),
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

  private async executeFunction(functionName: string, functionArgs: any, locationId: string, chatType: string): Promise<{ message: string }> {
    // Handle admin functions
    if (chatType === 'admin') {
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
    switch (functionName) {
      case 'create_order':
        try {
          console.log('Creating order with args:', functionArgs);
          
          // Ensure locationId is present
          if (!locationId) {
            throw new Error('No location ID found for this client');
          }

          // Ensure customerName is present
          if (!functionArgs.customerName) {
            throw new Error('Customer name is required');
          }

          // Validate product IDs
          const menu = await this.productsService.findAll({ locationId });
          const validProductIds = new Set(menu.map(product => product.id));
          
          const invalidProducts = functionArgs.items.filter(
            item => !validProductIds.has(item.productId)
          );

          if (invalidProducts.length > 0) {
            // Add error to conversation history
            const conversation = this.conversations.get(locationId);
            if (conversation) {
              // Create a more detailed error message with menu data
              const errorMessage = {
                error: true,
                message: `Error: Invalid product IDs found: ${invalidProducts.map(p => p.productId).join(', ')}. Please use the exact product IDs from the menu below:`,
                menu: menu.map(product => ({
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  category: product.category?.name
                }))
              };

              conversation.push({
                role: 'function',
                name: functionName,
                content: JSON.stringify(errorMessage)
              });

              // Get a new response from OpenAI with the error context
              const retryCompletion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini-2024-07-18',
                messages: [
                  ...conversation,
                  {
                    role: 'system',
                    content: 'You made a mistake with the product IDs. Please review the menu data carefully and create the order again using the exact product IDs provided. Do not modify or generate new IDs.'
                  }
                ],
                functions: restaurantAssistantFunctions,
                function_call: 'auto',
              });

              const retryResponse = retryCompletion.choices[0].message;
              
              // Add the retry response to conversation history
              conversation.push({
                role: 'assistant',
                content: retryResponse.content,
              });

              // If there's a new function call, execute it
              if (retryResponse.function_call) {
                const retryFunctionName = retryResponse.function_call.name;
                const retryFunctionArgs = JSON.parse(retryResponse.function_call.arguments);
                
                // Add the retry function call to conversation history
                conversation.push({
                  role: 'assistant',
                  content: null,
                  function_call: {
                    name: retryFunctionName,
                    arguments: retryResponse.function_call.arguments,
                  },
                });

                // Execute the retry function
                return this.executeFunction(retryFunctionName, retryFunctionArgs, locationId, chatType);
              }

              return {
                message: retryResponse.content || 'Error processing order'
              };
            }
            throw new Error(`Invalid product IDs found: ${invalidProducts.map(p => p.productId).join(', ')}`);
          }

          // Create the order with the correct type
          const order = await this.ordersService.create({
            ...functionArgs,
            locationId,
            type: 'DELIVERY', // Always set to DELIVERY for AI orders
            status: 'PENDING',
            tableId: undefined // Ensure tableId is not set for delivery orders
          });

          return {
            message: `¡Orden para llevar creada exitosamente para ${functionArgs.customerName}! Número de orden: ${order.id}`
          };
        } catch (error) {
          console.error('Error in create_order function:', error);
          return {
            message: `Error creating order: ${error.message}`
          };
        }

      default:
        return {
          message: `Unknown function: ${functionName}`
        };
    }
  }

  @SubscribeMessage('transcribe_audio')
  async handleAudioTranscription(client: Socket, payload: { audio: Buffer, mimeType: string }): Promise<void> {
    try {
      const transcription = await this.sttService.transcribeAudio(payload.audio);
      client.emit('transcription_result', { text: transcription });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      client.emit('error', {
        message: 'Error transcribing audio',
        details: error.message
      });
    }
  }
} 