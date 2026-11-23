import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  WhatsappCloudMessageDirection,
  WhatsappCloudMessageStatus,
  WhatsappCloudProcessingStatus,
} from '@prisma/client';
import axios from 'axios';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AIGateway } from '../ai/ai.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { STTService } from '../stt/stt.service';
import { SaveWhatsappCloudIntegrationDto } from './whatsapp-cloud.dto';

interface MetaContact {
  profile?: { name?: string };
  wa_id?: string;
  user_id?: string;
}

interface MetaIncomingMessage {
  from?: string;
  from_user_id?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  audio?: {
    id?: string;
    mime_type?: string;
    voice?: boolean;
  };
}

interface MetaMessageStatus {
  id?: string;
  status?: string;
  timestamp?: string;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: MetaContact[];
        messages?: MetaIncomingMessage[];
        statuses?: MetaMessageStatus[];
      };
    }>;
  }>;
}

interface MetaPhoneNumberDetails {
  display_phone_number?: string;
  verified_name?: string;
}

@Injectable()
export class WhatsappCloudService {
  private readonly logger = new Logger(WhatsappCloudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiGateway: AIGateway,
    private readonly sttService: STTService,
  ) {}

  async getIntegration(tenantId: string, locationId: string) {
    await this.assertLocation(tenantId, locationId);
    const integration = await this.prisma.whatsappCloudIntegration.findUnique({
      where: { locationId },
      select: {
        id: true,
        phoneNumberId: true,
        wabaId: true,
        displayPhoneNumber: true,
        verifiedName: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      configured: Boolean(integration),
      integration,
    };
  }

  async saveIntegration(tenantId: string, data: SaveWhatsappCloudIntegrationDto) {
    await this.assertLocation(tenantId, data.locationId);
    const phoneDetails = await this.verifyMetaCredentials(data.phoneNumberId, data.accessToken);
    const accessTokenEncrypted = this.encryptToken(data.accessToken);

    let integration: {
      id: string;
      phoneNumberId: string;
      wabaId: string;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      isActive: boolean;
      updatedAt: Date;
    };
    try {
      integration = await this.prisma.whatsappCloudIntegration.upsert({
        where: { locationId: data.locationId },
        create: {
          tenantId,
          locationId: data.locationId,
          phoneNumberId: data.phoneNumberId,
          wabaId: data.wabaId,
          accessTokenEncrypted,
          displayPhoneNumber: phoneDetails.display_phone_number ?? null,
          verifiedName: phoneDetails.verified_name ?? null,
        },
        update: {
          tenantId,
          phoneNumberId: data.phoneNumberId,
          wabaId: data.wabaId,
          accessTokenEncrypted,
          displayPhoneNumber: phoneDetails.display_phone_number ?? null,
          verifiedName: phoneDetails.verified_name ?? null,
          isActive: true,
        },
        select: {
          id: true,
          phoneNumberId: true,
          wabaId: true,
          displayPhoneNumber: true,
          verifiedName: true,
          isActive: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'This Meta phone number is already connected to another location',
        );
      }
      throw error;
    }

    return { configured: true, integration };
  }

  async listConversations(tenantId: string, locationId: string) {
    await this.assertLocation(tenantId, locationId);
    return this.prisma.whatsappCloudConversation.findMany({
      where: { tenantId, locationId },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        contactId: true,
        phoneNumber: true,
        profileName: true,
        aiEnabled: true,
        lastMessageText: true,
        lastMessageAt: true,
        updatedAt: true,
      },
    });
  }

  async listMessages(tenantId: string, locationId: string, conversationId: string) {
    await this.assertLocation(tenantId, locationId);
    const conversation = await this.prisma.whatsappCloudConversation.findFirst({
      where: { id: conversationId, tenantId, locationId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException('WhatsApp conversation not found');
    }

    return this.prisma.whatsappCloudMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      take: 200,
      select: {
        id: true,
        providerMessageId: true,
        direction: true,
        type: true,
        body: true,
        status: true,
        timestamp: true,
        isVoiceNote: true,
      },
    });
  }

  async setConversationAi(
    tenantId: string,
    locationId: string,
    conversationId: string,
    aiEnabled: boolean,
  ) {
    await this.assertLocation(tenantId, locationId);
    const updated = await this.prisma.whatsappCloudConversation.updateMany({
      where: { id: conversationId, tenantId, locationId },
      data: { aiEnabled },
    });
    if (updated.count === 0) {
      throw new NotFoundException('WhatsApp conversation not found');
    }

    return this.prisma.whatsappCloudConversation.findFirst({
      where: { id: conversationId, tenantId, locationId },
      select: { id: true, aiEnabled: true },
    });
  }

  async sendManualMessage(
    tenantId: string,
    locationId: string,
    conversationId: string,
    body: string,
  ) {
    const text = body.trim();
    if (!text || text.length > 4096) {
      throw new BadRequestException('Message must contain between 1 and 4096 characters');
    }

    await this.assertLocation(tenantId, locationId);
    const conversation = await this.prisma.whatsappCloudConversation.findFirst({
      where: { id: conversationId, tenantId, locationId },
      include: { integration: true },
    });
    if (!conversation) {
      throw new NotFoundException('WhatsApp conversation not found');
    }

    return this.sendText(conversation.integration, conversation, text);
  }

  async processWebhook(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Meta webhook payload must be an object');
    }
    const webhook = payload as MetaWebhookPayload;
    if (!Array.isArray(webhook.entry)) {
      throw new BadRequestException('Meta webhook payload has no entry array');
    }
    for (const entry of webhook.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const integration = await this.prisma.whatsappCloudIntegration.findUnique({
          where: { phoneNumberId },
        });
        if (!integration || !integration.isActive) {
          throw new NotFoundException(
            `No active WhatsApp Cloud integration for phone number ${phoneNumberId}`,
          );
        }

        for (const status of value?.statuses ?? []) {
          await this.updateMessageStatus(integration.id, status);
        }
        for (const message of value?.messages ?? []) {
          await this.processIncomingMessage(integration, value?.contacts ?? [], message);
        }
      }
    }
  }

  private async processIncomingMessage(
    integration: {
      id: string;
      tenantId: string;
      locationId: string;
      phoneNumberId: string;
      accessTokenEncrypted: string;
      isActive: boolean;
    },
    contacts: MetaContact[],
    message: MetaIncomingMessage,
  ) {
    if (!message.id || (!message.from && !message.from_user_id)) {
      throw new BadRequestException('Meta message is missing its sender or ID');
    }

    const contactId = message.from_user_id || message.from!;
    const contact = contacts.find(
      (candidate) => candidate.user_id === message.from_user_id || candidate.wa_id === message.from,
    );
    const phoneNumber = message.from ?? null;
    const conversation = await this.prisma.whatsappCloudConversation.upsert({
      where: {
        integrationId_contactId: {
          integrationId: integration.id,
          contactId,
        },
      },
      create: {
        integrationId: integration.id,
        tenantId: integration.tenantId,
        locationId: integration.locationId,
        contactId,
        phoneNumber,
        profileName: contact?.profile?.name ?? null,
      },
      update: {
        phoneNumber,
        profileName: contact?.profile?.name ?? undefined,
      },
    });

    let inbound = await this.prisma.whatsappCloudMessage.findUnique({
      where: {
        integrationId_providerMessageId: {
          integrationId: integration.id,
          providerMessageId: message.id,
        },
      },
    });
    if (
      inbound?.processingStatus ===
      WhatsappCloudProcessingStatus.COMPLETED
    ) {
      return;
    }

    let body =
      inbound?.body ??
      (message.type === 'text' ? (message.text?.body ?? null) : null);
    const mediaId = message.type === 'audio' ? (message.audio?.id ?? null) : null;
    const mimeType = message.type === 'audio' ? (message.audio?.mime_type ?? null) : null;
    const isVoiceNote = message.type === 'audio' ? message.audio?.voice === true : false;

    if (!inbound && message.type === 'audio' && mediaId && mimeType) {
      const audio = await this.downloadMedia(
        integration.phoneNumberId,
        mediaId,
        this.decryptToken(integration.accessTokenEncrypted),
      );
      body = await this.sttService.transcribeAudio(audio, mimeType);
    }

    const timestamp = Number(message.timestamp);
    const messageTimestamp = Number.isFinite(timestamp) ? new Date(timestamp * 1000) : new Date();
    if (!inbound) {
      try {
        inbound = await this.prisma.whatsappCloudMessage.create({
          data: {
            integrationId: integration.id,
            conversationId: conversation.id,
            providerMessageId: message.id,
            direction: WhatsappCloudMessageDirection.INBOUND,
            type: message.type ?? 'unknown',
            body,
            status: WhatsappCloudMessageStatus.RECEIVED,
            processingStatus: WhatsappCloudProcessingStatus.PENDING,
            timestamp: messageTimestamp,
            mediaId,
            mimeType,
            isVoiceNote,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return;
        }
        throw error;
      }
    }

    await this.prisma.whatsappCloudConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageText: body ?? `[${message.type ?? 'message'}]`,
        lastMessageAt: messageTimestamp,
      },
    });

    if (!body?.trim() || !conversation.aiEnabled || !integration.isActive) {
      await this.prisma.whatsappCloudMessage.update({
        where: { id: inbound.id },
        data: { processingStatus: WhatsappCloudProcessingStatus.COMPLETED },
      });
      return;
    }

    if (inbound.processingStatus === WhatsappCloudProcessingStatus.PENDING) {
      const chatId = phoneNumber ? `${phoneNumber}@c.us` : contactId;
      const response = await this.aiGateway.handleTextInput({
        text: body,
        locationId: integration.locationId,
        chatType: 'whatsapp',
        chatId,
      });
      const assistantResponse =
        typeof response === 'string' ? response.trim() : '';
      if (!assistantResponse) {
        await this.prisma.whatsappCloudMessage.update({
          where: { id: inbound.id },
          data: { processingStatus: WhatsappCloudProcessingStatus.COMPLETED },
        });
        return;
      }

      inbound = await this.prisma.whatsappCloudMessage.update({
        where: { id: inbound.id },
        data: {
          assistantResponse,
          processingStatus: WhatsappCloudProcessingStatus.RESPONSE_READY,
        },
      });
    }

    if (
      inbound.processingStatus !==
        WhatsappCloudProcessingStatus.RESPONSE_READY ||
      !inbound.assistantResponse
    ) {
      return;
    }

    const alreadySent = await this.prisma.whatsappCloudMessage.findFirst({
      where: {
        integrationId: integration.id,
        replyToProviderMessageId: inbound.providerMessageId,
      },
      select: { id: true },
    });
    if (!alreadySent) {
      await this.sendText(
        integration,
        conversation,
        inbound.assistantResponse,
        inbound.providerMessageId,
      );
    }
    await this.prisma.whatsappCloudMessage.update({
      where: { id: inbound.id },
      data: { processingStatus: WhatsappCloudProcessingStatus.COMPLETED },
    });
  }

  private async sendText(
    integration: {
      id: string;
      phoneNumberId: string;
      accessTokenEncrypted: string;
    },
    conversation: {
      id: string;
      contactId: string;
      phoneNumber: string | null;
    },
    body: string,
    replyToProviderMessageId?: string,
  ) {
    const accessToken = this.decryptToken(integration.accessTokenEncrypted);
    const recipient = conversation.phoneNumber || conversation.contactId;
    let providerMessageId: string | undefined;

    try {
      const result = await axios.post<{
        messages?: Array<{ id?: string }>;
      }>(
        `${this.graphApiBase()}/${integration.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: { preview_url: false, body },
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        },
      );
      providerMessageId = result.data.messages?.[0]?.id;
    } catch (error) {
      this.logger.error(
        `Meta message request failed with status ${axios.isAxiosError(error) ? (error.response?.status ?? 'unknown') : 'unknown'}`,
      );
      throw new BadGatewayException(
        this.getMetaErrorMessage(error, 'Meta could not send the WhatsApp message'),
      );
    }

    if (!providerMessageId) {
      throw new BadGatewayException('Meta returned no message identifier');
    }

    const sentAt = new Date();
    const savedMessage = await this.prisma.whatsappCloudMessage.create({
      data: {
        integrationId: integration.id,
        conversationId: conversation.id,
        providerMessageId,
        direction: WhatsappCloudMessageDirection.OUTBOUND,
        type: 'text',
        body,
        status: WhatsappCloudMessageStatus.SENT,
        processingStatus: WhatsappCloudProcessingStatus.COMPLETED,
        replyToProviderMessageId,
        timestamp: sentAt,
      },
      select: {
        id: true,
        providerMessageId: true,
        direction: true,
        type: true,
        body: true,
        status: true,
        timestamp: true,
        isVoiceNote: true,
      },
    });

    await this.prisma.whatsappCloudConversation.update({
      where: { id: conversation.id },
      data: { lastMessageText: body, lastMessageAt: sentAt },
    });
    return savedMessage;
  }

  private async updateMessageStatus(integrationId: string, statusUpdate: MetaMessageStatus) {
    if (!statusUpdate.id) return;
    const statusMap: Record<string, WhatsappCloudMessageStatus> = {
      sent: WhatsappCloudMessageStatus.SENT,
      delivered: WhatsappCloudMessageStatus.DELIVERED,
      read: WhatsappCloudMessageStatus.READ,
      failed: WhatsappCloudMessageStatus.FAILED,
    };
    const status = statusMap[statusUpdate.status ?? ''];
    if (!status) return;

    await this.prisma.whatsappCloudMessage.updateMany({
      where: {
        integrationId,
        providerMessageId: statusUpdate.id,
        direction: WhatsappCloudMessageDirection.OUTBOUND,
      },
      data: { status },
    });
  }

  private async verifyMetaCredentials(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<MetaPhoneNumberDetails> {
    try {
      const response = await axios.get<MetaPhoneNumberDetails>(
        `${this.graphApiBase()}/${encodeURIComponent(phoneNumberId)}`,
        {
          params: { fields: 'display_phone_number,verified_name' },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.warn(
        `Meta credential validation failed with status ${axios.isAxiosError(error) ? (error.response?.status ?? 'unknown') : 'unknown'}`,
      );
      throw new BadGatewayException('Meta could not validate the phone number ID and access token');
    }
  }

  private async downloadMedia(
    phoneNumberId: string,
    mediaId: string,
    accessToken: string,
  ): Promise<Buffer> {
    try {
      const metadata = await axios.get<{ url?: string; mime_type?: string }>(
        `${this.graphApiBase()}/${encodeURIComponent(mediaId)}`,
        {
          params: { phone_number_id: phoneNumberId },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        },
      );
      if (!metadata.data.url) {
        throw new BadGatewayException('Meta returned no media URL');
      }
      const downloaded = await axios.get<ArrayBuffer>(metadata.data.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer',
        maxContentLength: 25 * 1024 * 1024,
        timeout: 20000,
      });
      return Buffer.from(downloaded.data);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.error(
        `Meta media download failed with status ${axios.isAxiosError(error) ? (error.response?.status ?? 'unknown') : 'unknown'}`,
      );
      throw new BadGatewayException('Meta audio media could not be downloaded');
    }
  }

  private async assertLocation(tenantId: string, locationId: string) {
    if (!tenantId || !locationId) {
      throw new BadRequestException('tenantId and locationId are required');
    }
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found for this tenant');
    }
  }

  private encryptToken(accessToken: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(accessToken, 'utf8'), cipher.final()]);
    return [
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  private decryptToken(value: string): string {
    const [encodedIv, encodedTag, encodedData] = value.split('.');
    if (!encodedIv || !encodedTag || !encodedData) {
      throw new ServiceUnavailableException(
        'Stored WhatsApp token has an invalid encrypted format',
      );
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(encodedIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedData, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('WHATSAPP_CLOUD_TOKEN_ENCRYPTION_KEY');
    const decoded = key ? Buffer.from(key, 'base64') : Buffer.alloc(0);
    if (decoded.length !== 32) {
      throw new ServiceUnavailableException(
        'WHATSAPP_CLOUD_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      );
    }
    return decoded;
  }

  private graphApiBase(): string {
    const version = this.configService.get<string>('WHATSAPP_CLOUD_GRAPH_API_VERSION') ?? 'v27.0';
    if (!/^v\d+\.\d+$/.test(version)) {
      throw new ServiceUnavailableException('WHATSAPP_CLOUD_GRAPH_API_VERSION is invalid');
    }
    return `https://graph.facebook.com/${version}`;
  }

  private getMetaErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const data = error.response?.data;
    if (!data || typeof data !== 'object' || !('error' in data)) {
      return fallback;
    }

    const metaError = data.error as { code?: unknown; message?: unknown };
    if (typeof metaError.message !== 'string') return fallback;
    const code = typeof metaError.code === 'number' ? ` (Meta error ${metaError.code})` : '';
    return `${fallback}${code}: ${metaError.message.slice(0, 300)}`;
  }
}
