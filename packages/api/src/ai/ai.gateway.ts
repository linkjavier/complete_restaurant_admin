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
  private chatTypes: Map<string, 'whatsapp' | 'ai'> = new Map();

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    private settingsService: SettingsService,
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
      description: 'Create a new delivery order with specified items',
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
          deliveryAddress: {
            type: 'string',
            description: 'Delivery address for the order',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
          neighborhood: {
            type: 'string',
            description: 'Customer neighborhood',
          },
          paymentMethod: {
            type: 'string',
            description: 'Payment method for the order',
            enum: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER'],
          },
        },
        required: ['items', 'locationId', 'customerName', 'deliveryAddress', 'phone', 'neighborhood', 'paymentMethod'],
      },
    },
  ];

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const locationId = client.handshake.query.locationId as string;
    const chatType = client.handshake.query.chatType as 'whatsapp' | 'ai';
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
      // Get menu for this location
      const menu = await this.productsService.findAll({
        locationId,
      });

      // Get AI settings
      const aiSettings = await this.settingsService.getAISettings();

      // Create a unique conversation ID combining location, chat type and chat ID
      const conversationId = `${locationId}:${chatType}:${chatId}`;

      // Initialize conversation history for this specific chat if it doesn't exist
      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, [
          {
            role: 'system',
            content: `You are a helpful restaurant colombian assistant that helps with delivery orders. Your name is "${aiSettings.name}" and you are ${aiSettings.gender === 'female' ? 'a woman' : 'a man'}. You can ONLY help customers with delivery orders and showing them the menu, recommendations, and general info about the menú. You must NOT engage in any other topics or conversations.

IMPORTANT: You can only create ONE order per conversation. After creating an order, you must inform the customer that the conversation is complete and they need to start a new conversation if they want to place another order.

1. First, help them select items from the menu
2. Then ask for the customer's information. Start with the name.
3. Then ask for their delivery address
4. Then ask for their phone number
5. Then ask for their neighborhood
6. Then ask for their preferred payment method (CASH, CREDIT_CARD, DEBIT_CARD, or TRANSFER)
7. VERY IMPORTANT: It is strictly necessary to show the customer the order summary with the prices before creating the order. Be careful.


The current location ID is ${locationId}.
The current chat ID is ${chatId}.

CRITICAL INSTRUCTION ABOUT PRODUCT IDs:
When creating orders, you MUST use the EXACT product IDs from the menu data below. Each product has a unique 'id' field that must be used as the 'productId' when creating orders. DO NOT modify, guess, or generate new IDs. Copy and paste the exact IDs from the menu data.

CRITICAL INSTRUCTION ABOUT PRICES:
1. ALWAYS use the exact prices from the menu data
2. Calculate the subtotal for each item by multiplying the item's price by its quantity
3. Sum up all subtotals to get the total order amount
4. Double-check all calculations before creating the order
5. Show the breakdown of the order with (Excel TABLE format):
   - Item name
   - Quantity
   - Price per unit
   - Subtotal per item
   - Total order amount

Here is the current menu data:
${JSON.stringify(menu, null, 2)}

Your responses must be in whatsapp format. You can use Bold, Italic, or Monospace.

When showing the menu to customers, always use this exact format:
## [Category Name]
1. [Product Name] - $[Price]
2. [Product Name] - $[Price]
3. [Product Name] - $[Price]
...

When customers want to order, they should respond with the number of the item they want, followed by the quantity. For example:
- "1" for one unit of item #1
- "2 3" for three units of item #2
- "1 2, 3 1" for two units of item #1 and one unit of item #3

IMPORTANT: When showing the menu, you must:
1. Number each item sequentially starting from 1
2. Keep track of the item numbers and their corresponding product IDs
3. When processing orders, convert the customer's number selections to the correct product IDs
4. Verify that the numbers selected by the customer correspond to valid menu items

For delivery orders:
1. Always collect ALL required information in this order:
   - Customer name
   - Delivery address
   - Phone number
   - Neighborhood (Barrio o Sector)
   - Payment method (Efectivo, Tarjeta de Crédito, Tarjeta Débito, o Transferencia)
2. IMPORTANT: Confirm the order details before creating it
3. Use DELIVERY (Domicilio) as the order type
4. Include the order number in your response
5. Include the list of items in your response with (Excel TABLE format):
   - Item name
   - Quantity
   - Price per unit
   - Subtotal per item
6. Include the exact total amount of the order in your response
7. ALWAYS use the exact product IDs from the menu data when creating orders
8. DOUBLE CHECK all product IDs before creating the order
9. VERIFY all price calculations before creating the order
10. After creating an order, inform the customer that the conversation is complete and they need to start a new conversation if they want to place another order.`,
          },
        ]);
      }

      // Send welcome message
      client.emit('ai_response', {
        type: 'text',
        content: `¡Hola! Soy ${aiSettings.name}, tu asistente virtual. ¿En qué puedo ayudarte hoy?`,
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
        // Get menu for this location
        const menu = await this.productsService.findAll({
          locationId,
        });

        // Get AI settings
        const aiSettings = await this.settingsService.getAISettings();

        // Initialize conversation with system message
        conversation = [
          {
            role: 'system',
            content: `You are a helpful restaurant colombian assistant that helps with delivery orders. Your name is "${aiSettings.name}" and you are ${aiSettings.gender === 'female' ? 'a woman' : 'a man'}. You can ONLY help customers with delivery orders and showing them the menu, recommendations, and general info about the menú. You must NOT engage in any other topics or conversations.

IMPORTANT: You can only create ONE order per conversation. After creating an order, you must inform the customer that the conversation is complete and they need to start a new conversation if they want to place another order.

1. First, help them select items from the menu
2. Then ask for the customer's information. Start with the name.
3. Then ask for their delivery address
4. Then ask for their phone number
5. Then ask for their neighborhood
6. Then ask for their preferred payment method (CASH, CREDIT_CARD, DEBIT_CARD, or TRANSFER)
7. VERY IMPORTANT: It is strictly necessary to show the customer the order summary with the prices before creating the order. Be careful.


The current location ID is ${locationId}.
The current chat ID is ${chatId}.

CRITICAL INSTRUCTION ABOUT PRODUCT IDs:
When creating orders, you MUST use the EXACT product IDs from the menu data below. Each product has a unique 'id' field that must be used as the 'productId' when creating orders. DO NOT modify, guess, or generate new IDs. Copy and paste the exact IDs from the menu data.

CRITICAL INSTRUCTION ABOUT PRICES:
1. ALWAYS use the exact prices from the menu data
2. Calculate the subtotal for each item by multiplying the item's price by its quantity
3. Sum up all subtotals to get the total order amount
4. Double-check all calculations before creating the order
5. Show the breakdown of the order with:
   - Item name
   - Quantity
   - Price per unit
   - Subtotal per item
   - Total order amount

Here is the current menu data:
${JSON.stringify(menu, null, 2)}

Your responses must be in whatsapp format. You can use Bold, Italic, or Monospace.

When showing the menu to customers, always use this exact format:
## [Category Name]
1. [Product Name] - $[Price]
2. [Product Name] - $[Price]
3. [Product Name] - $[Price]
...

When customers want to order, they should respond with the number of the item they want, followed by the quantity. For example:
- "1" for one unit of item #1
- "2 3" for three units of item #2
- "1 2, 3 1" for two units of item #1 and one unit of item #3

IMPORTANT: When showing the menu, you must:
1. Number each item sequentially starting from 1
2. Keep track of the item numbers and their corresponding product IDs
3. When processing orders, convert the customer's number selections to the correct product IDs
4. Verify that the numbers selected by the customer correspond to valid menu items

For delivery orders:
1. Always collect ALL required information in this order:
   - Customer name
   - Delivery address
   - Phone number
   - Neighborhood (Barrio o Sector)
   - Payment method (Efectivo, Tarjeta de Crédito, Tarjeta Débito, o Transferencia)
2. IMPORTANT: Confirm the order details before creating it
3. Use DELIVERY (Domicilio) as the order type
4. Include the order number in your response
5. Include the list of items in your response with:
   - Item name
   - Quantity
   - Price per unit
   - Subtotal per item
6. Include the exact total amount of the order in your response
7. ALWAYS use the exact product IDs from the menu data when creating orders
8. DOUBLE CHECK all product IDs before creating the order
9. VERIFY all price calculations before creating the order
10. After creating an order, inform the customer that the conversation is complete and they need to start a new conversation if they want to place another order.`,
          },
        ];

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
        functions: this.functions,
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
        const functionResult = await this.executeFunction(functionName, functionArgs, locationId);
        
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

  private async executeFunction(functionName: string, functionArgs: any, locationId: string): Promise<{ message: string }> {
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
                functions: this.functions,
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
                return this.executeFunction(retryFunctionName, retryFunctionArgs, locationId);
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
} 