import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { getRestaurantAssistantRole } from '../roles/restaurant-assistant.role';
import { getAdminAssistantRole } from '../roles/admin-assistant.role';
import { ProductsService } from '../../products/products.service';
import { SettingsService } from '../../settings/settings.service';
import { CustomersService } from '../../customers/customers.service';

export interface ConversationContext {
  locationId: string;
  tenantId: string;
  chatType: 'whatsapp' | 'ai' | 'admin';
  chatId: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNeighborhood?: string;
}

@Injectable()
export class ConversationService {
  private conversations: Map<string, OpenAI.Chat.ChatCompletionMessageParam[]> = new Map();

  constructor(
    private productsService: ProductsService,
    private settingsService: SettingsService,
    private customersService: CustomersService,
  ) {}

  getConversationId(locationId: string, chatType: string, chatId: string): string {
    return `${locationId}:${chatType}:${chatId}`;
  }

  async getOrCreateConversation(context: ConversationContext): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
    const conversationId = this.getConversationId(context.locationId, context.chatType, context.chatId);
    
    if (!this.conversations.has(conversationId)) {
      const systemMessage = await this.createSystemMessage(context);
      this.conversations.set(conversationId, [systemMessage]);
    }

    return this.conversations.get(conversationId);
  }

  async updateConversationContext(context: ConversationContext): Promise<void> {
    const conversationId = this.getConversationId(context.locationId, context.chatType, context.chatId);
    const conversation = this.conversations.get(conversationId);
    
    if (conversation && conversation.length > 0 && conversation[0].role === 'system') {
      const updatedSystemMessage = await this.createSystemMessage(context);
      conversation[0] = updatedSystemMessage;
      this.conversations.set(conversationId, conversation);
    }
  }

  private async createSystemMessage(context: ConversationContext): Promise<OpenAI.Chat.ChatCompletionMessageParam> {
    const aiSettings = await this.settingsService.getAISettings();
    const businessSettings = await this.settingsService.getBusinessSettings();
    const businessName = businessSettings.name;

    if (context.chatType === 'admin') {
      return {
        role: 'system',
        content: getAdminAssistantRole({
          aiSettings,
          locationId: context.locationId,
          chatId: context.chatId,
          businessName,
        }),
      };
    } else {
      const menu = await this.productsService.findAll({
        locationId: context.locationId,
        tenantId: context.tenantId,
      });
      
      return {
        role: 'system',
        content: getRestaurantAssistantRole({
          aiSettings,
          locationId: context.locationId,
          chatId: context.chatId,
          menu,
          businessName,
          customerName: context.customerName || '',
          customerPhone: context.customerPhone || '',
          customerAddress: context.customerAddress || '',
          customerNeighborhood: context.customerNeighborhood || '',
        }),
      };
    }
  }

  addMessage(conversationId: string, message: OpenAI.Chat.ChatCompletionMessageParam): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.push(message);
      this.conversations.set(conversationId, conversation);
    }
  }

  deleteConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  getLastAssistantMessage(conversationId: string): string {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return '';

    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].role === 'assistant' && conversation[i].content) {
        return conversation[i].content as string;
      }
    }
    return '';
  }
} 