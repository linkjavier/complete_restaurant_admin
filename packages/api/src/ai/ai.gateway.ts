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

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({
      apiKey,
    });
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // Initialize conversation history for new client
    this.conversations.set(client.id, [
      {
        role: 'system',
        content: 'You are a helpful restaurant assistant that helps with orders and customer service. Your name is "Paola" and you are a woman.',
      },
    ]);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.conversations.delete(client.id);
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

      // Add user message to conversation history
      conversation.push({
        role: 'user',
        content: payload.text,
      });

      console.log('Sending request to OpenAI...');
      
      // Get response from OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: conversation,
        temperature: 0.7,
      });

      const response = completion.choices[0].message;
      console.log('Received response from OpenAI:', response);

      // Add assistant response to conversation history
      conversation.push({
        role: 'assistant',
        content: response.content,
      });

      // Send response to client
      console.log('Sending response to client:', response.content);
      client.emit('ai_response', {
        type: 'text',
        content: response.content,
      });

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