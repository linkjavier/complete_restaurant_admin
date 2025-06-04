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
    private productsService: ProductsService,
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
      name: 'get_menu',
      description: 'Get the list of available products in the menu',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional category to filter products',
          },
        },
      },
    },
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
          tableId: {
            type: 'string',
            description: 'ID of the table where the order is being placed',
          },
          locationId: {
            type: 'string',
            description: 'ID of the location where the order is being placed',
          },
          type: {
            type: 'string',
            description: 'Type of the order (DINE_IN, TAKEAWAY, DELIVERY)',
            enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
          },
          customerName: {
            type: 'string',
            description: 'Optional name of the customer',
          },
        },
        required: ['items', 'tableId', 'locationId', 'type'],
      },
    },
  ];

  handleConnection(client: Socket) {
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
    
    // Initialize conversation history for new client
    this.conversations.set(client.id, [
      {
        role: 'system',
        content: `You are a helpful restaurant assistant that helps with orders and customer service. Your name is "Paola" and you are a woman. You can help customers by showing them the menu and taking their orders. The current location ID is ${locationId}.`,
      },
    ]);

    // Send welcome message
    client.emit('ai_response', {
      type: 'text',
      content: '¡Hola! Soy Paola, tu asistente virtual. ¿En qué puedo ayudarte hoy?'
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.conversations.delete(client.id);
    this.locationIds.delete(client.id);
  }

  @SubscribeMessage('input_text')
  async handleTextInput(client: Socket, payload: { text: string }) {
    try {
      console.log(`Received message from client ${client.id}:`, payload.text);
      
      const conversation = this.conversations.get(client.id);
      if (!conversation) {
        console.error(`No conversation found for client ${client.id}`);
        throw new Error('No conversation found for client');
      }

      const locationId = this.locationIds.get(client.id);
      if (!locationId) {
        console.error(`No locationId found for client ${client.id}`);
        throw new Error('No location ID found for this client');
      }

      console.log(`Using locationId: ${locationId} for client ${client.id}`);

      // Add user message to conversation history
      conversation.push({
        role: 'user',
        content: payload.text,
      });

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

      // Handle function calls
      if (response.function_call) {
        const functionName = response.function_call.name;
        const functionArgs = response.function_call.arguments;

        let functionResult;
        console.log(`Executing function ${functionName} with args:`, functionArgs);

        switch (functionName) {
          case 'get_menu':
            try {
              // Parse arguments safely, defaulting to empty object if invalid
              const menuArgs = functionArgs ? JSON.parse(functionArgs) : {};
              console.log('Parsed menu args:', menuArgs);
              console.log('Using locationId:', locationId);
              
              functionResult = await this.productsService.findAll({
                locationId,
                categoryId: menuArgs.category || undefined,
              });
              console.log('Menu result:', functionResult);

              // Agregar el resultado a la conversación con un formato más descriptivo
              conversation.push({
                role: 'function',
                name: functionName,
                content: JSON.stringify({
                  message: "Aquí está el menú completo:",
                  menu: functionResult
                }),
              });

              // Obtener una nueva respuesta de OpenAI con el resultado formateado
              const menuCompletion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini-2024-07-18',
                messages: [
                  ...conversation,
                  {
                    role: 'system',
                    content: `Eres un asistente de restaurante. Cuando te pidan el menú, responde SOLO con el nombre del producto y su precio, organizados por categorías.
                    Usa este formato exacto:
                    ## [Nombre de la Categoría]
                    - [Nombre del Producto] - $[Precio]
                    
                    No incluyas descripciones, imágenes ni información adicional.
                    Mantén el formato markdown con ## para categorías y - para productos.
                    Al final, agrega una línea en blanco y "¿En qué más puedo ayudarte?"`
                  }
                ],
                temperature: 0.7,
              });

              const menuResponse = menuCompletion.choices[0].message;
              conversation.push({
                role: 'assistant',
                content: menuResponse.content,
              });

              // Enviar respuesta al cliente
              client.emit('ai_response', {
                type: 'text',
                content: menuResponse.content,
              });
              return;
            } catch (error) {
              console.error('Error in get_menu function:', error);
              throw new Error('Error retrieving menu');
            }
          case 'create_order':
            try {
              const orderArgs = JSON.parse(functionArgs);
              console.log('Creating order with args:', orderArgs);
              
              // Ensure locationId is present
              if (!locationId) {
                throw new Error('No location ID found for this client');
              }

              // Create the order with the correct type
              const order = await this.ordersService.create({
                ...orderArgs,
                locationId,
                type: orderArgs.type === 'TAKEAWAY' ? 'TAKEOUT' : orderArgs.type, // Convert TAKEAWAY to TAKEOUT
                status: 'PENDING'
              });

              return {
                content: `¡Orden creada exitosamente! Número de orden: ${order.id}`
              };
            } catch (error) {
              console.error('Error in create_order function:', error);
              throw new Error('Error creating order');
            }
            break;
          default:
            throw new Error(`Unknown function: ${functionName}`);
        }

        // Add function result to conversation
        conversation.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult),
        });

        // Get a new completion with the function result
        const secondCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini-2024-07-18',
          messages: conversation,
          temperature: 0.7,
        });

        const secondResponse = secondCompletion.choices[0].message;
        conversation.push({
          role: 'assistant',
          content: secondResponse.content,
        });

        // Send response to client
        client.emit('ai_response', {
          type: 'text',
          content: secondResponse.content,
        });
      } else {
        // Regular text response
        conversation.push({
          role: 'assistant',
          content: response.content,
        });

        // Send response to client
        client.emit('ai_response', {
          type: 'text',
          content: response.content,
        });
      }

    } catch (error) {
      console.error('Error processing message:', error);
      client.emit('error', { 
        message: 'Error processing your message',
        details: error.message 
      });
    }
  }

  @SubscribeMessage('request_signature')
  async handleSignatureRequest(client: Socket, payload: { meetingNumber: string, meetingPassCode: string }) {
    try {
      // Aquí implementarías la lógica para generar la firma de Zoom
      // Por ahora, enviamos una respuesta simulada
      client.emit('signature', {
        type: 'signature',
        data: 'simulated_signature_data'
      });
    } catch (error) {
      console.error('Error generating signature:', error);
      client.emit('error', { 
        message: 'Error generating signature',
        details: error.message 
      });
    }
  }
} 