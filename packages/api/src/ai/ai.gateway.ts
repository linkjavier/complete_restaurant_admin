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
import { Inject, forwardRef } from '@nestjs/common';

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

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
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

  private readonly functions = [
    {
      name: 'create_order',
      description: 'Create a new order with specified items',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'List of items to order',
            items: {
              type: 'object',
              properties: {
                productId: {
                  type: 'string',
                  description: 'ID of the product to order',
                },
                quantity: {
                  type: 'integer',
                  description: 'Quantity of the product',
                  minimum: 1,
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes for the order item',
                },
              },
              required: ['productId', 'quantity'],
            },
          },
          locationId: {
            type: 'string',
            description: 'ID of the location where the order is being placed',
          },
          customerName: {
            type: 'string',
            description: 'Name of the customer',
          },
        },
        required: ['items', 'locationId', 'customerName'],
      },
    },
  ];

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const locationId = client.handshake.query.locationId as string;
    
    if (!locationId) {
      console.error(`No locationId provided for client ${client.id}`);
      client.emit('error', {
        message: 'No location ID provided',
        details: 'A location ID is required to connect'
      });
      client.disconnect();
      return;
    }

    console.log(`Client ${client.id} connected with locationId: ${locationId}`);
    this.locationIds.set(client.id, locationId);
    
    try {
      // Get menu for this location
      const menu = await this.productsService.findAll({
        locationId,
      });

      // Initialize conversation history for this location if it doesn't exist
      if (!this.conversations.has(locationId)) {
        this.conversations.set(locationId, [
          {
            role: 'system',
            content: `You are a helpful restaurant assistant that helps with orders and customer service. Your name is "Paola" and you are a woman. You can help customers by showing them the menu and taking their orders. Always first ask for the customer's nameThe current location ID is ${locationId}.

Here is the current menu data:
${JSON.stringify(menu, null, 2)}

IMPORTANT: When creating orders, you MUST use the exact product IDs from the menu data above. Each product has a unique 'id' field that must be used as the 'productId' when creating orders.

When showing the menu to customers, always use this exact format:
## [Category Name]
- [Product Name] - $[Price]

For takeout orders:
1. Always ask for the customer's name
2. Don't ask for table number
3. Confirm the order details before creating it
4. Use TAKEOUT as the order type
5. Include the order number in your response
6. Include the list of items in your response. 
7. Include the exact total amount of the order in your response.
8. ALWAYS use the exact product IDs from the menu data when creating orders`,
          },
        ]);
      }

      // Send welcome message
      client.emit('ai_response', {
        type: 'text',
        content: '¡Hola! Soy Paola, tu asistente virtual. ¿En qué puedo ayudarte hoy?'
      });
    } catch (error) {
      console.error('Error initializing conversation:', error);
      client.emit('error', {
        message: 'Error initializing conversation',
        details: error.message
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const locationId = this.locationIds.get(client.id);
    if (locationId) {
      this.locationIds.delete(client.id);
      // No eliminamos la conversación para mantener el contexto
    }
  }

  @SubscribeMessage('input_text')
  async handleTextInput(client: Socket | { text: string, locationId: string }, payload?: { text: string }) {
    try {
      let socket: Socket;
      let locationId: string;
      let text: string;

      if ('id' in client) {
        // Es un Socket
        socket = client;
        text = payload.text;
        locationId = this.locationIds.get(socket.id);
        if (!locationId) {
          throw new Error('No location ID found for this client');
        }
      } else {
        // Es un objeto con text y locationId
        text = client.text;
        locationId = client.locationId;
      }

      console.log(`Processing message: ${text} for location: ${locationId}`);
      
      const conversation = this.conversations.get(locationId);
      if (!conversation) {
        console.error(`No conversation found for location ${locationId}`);
        throw new Error('No conversation found for location');
      }

      // Add user message to conversation history
      conversation.push({
        role: 'user',
        content: text,
      });

      console.log('Current conversation history:', conversation);
      console.log('Sending request to OpenAI...');
      
      // Get response from OpenAI with function calling
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: conversation,
        temperature: 0.7,
        functions: this.functions,
        function_call: 'auto',
      });

      const response = completion.choices[0].message;
      console.log('Received response from OpenAI:', response);

      if (response.function_call) {
        // Handle function call
        const functionName = response.function_call.name;
        const functionArgs = JSON.parse(response.function_call.arguments);

        console.log(`Executing function: ${functionName} with args:`, functionArgs);

        // Add assistant's function call to conversation history
        conversation.push({
          role: 'assistant',
          content: null,
          function_call: {
            name: functionName,
            arguments: response.function_call.arguments,
          },
        });

        // Execute the function
        const functionResult = await this.executeFunction(functionName, functionArgs, locationId);

        // Add function result to conversation history
        conversation.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult),
        });

        // Get final response from OpenAI
        const finalCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini-2024-07-18',
          messages: conversation,
          temperature: 0.7,
        });

        const finalResponse = finalCompletion.choices[0].message;

        // Add final response to conversation history
        conversation.push({
          role: 'assistant',
          content: finalResponse.content,
        });

        // Send response to client if it's a socket
        if (socket) {
          socket.emit('ai_response', {
            type: 'text',
            content: finalResponse.content,
          });
        }

        return finalResponse.content;
      } else {
        // Regular text response
        conversation.push({
          role: 'assistant',
          content: response.content,
        });

        // Send response to client if it's a socket
        if (socket) {
          socket.emit('ai_response', {
            type: 'text',
            content: response.content,
          });
        }

        return response.content;
      }

    } catch (error) {
      console.error('Error processing message:', error);
      if ('id' in client) {
        client.emit('error', { 
          message: 'Error processing your message',
          details: error.message 
        });
      }
      throw error;
    }
  }

  private async executeFunction(functionName: string, functionArgs: any, locationId: string) {
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
            throw new Error(`Invalid product IDs found: ${invalidProducts.map(p => p.productId).join(', ')}`);
          }

          // Create the order with the correct type
          const order = await this.ordersService.create({
            ...functionArgs,
            locationId,
            type: 'TAKEOUT', // Always set to TAKEOUT for AI orders
            status: 'PENDING',
            tableId: undefined // Ensure tableId is not set for takeout orders
          });

          return {
            success: true,
            orderId: order.id,
            message: `¡Orden para llevar creada exitosamente para ${functionArgs.customerName}! Número de orden: ${order.id}`
          };
        } catch (error) {
          console.error('Error in create_order function:', error);
          throw new Error(`Error creating order: ${error.message}`);
        }

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }
} 