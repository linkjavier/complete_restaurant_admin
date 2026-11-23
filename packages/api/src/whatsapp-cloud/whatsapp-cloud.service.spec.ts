import { ConfigService } from '@nestjs/config';
import { WhatsappCloudProcessingStatus } from '@prisma/client';
import axios from 'axios';
import { createCipheriv, randomBytes } from 'crypto';
import { AIGateway } from '../ai/ai.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { STTService } from '../stt/stt.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';

describe('WhatsappCloudService webhook retries', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resends a saved response without rerunning the agent and deduplicates completion', async () => {
    const encryptionKey = Buffer.alloc(32, 7);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encryptedToken = Buffer.concat([
      cipher.update('meta-test-token', 'utf8'),
      cipher.final(),
    ]);
    const accessTokenEncrypted = [
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encryptedToken.toString('base64'),
    ].join('.');
    const inboundMessage = {
      id: 'inbound-row',
      providerMessageId: 'wamid.inbound',
      processingStatus: WhatsappCloudProcessingStatus.RESPONSE_READY,
      assistantResponse: 'Hola, ¿qué te gustaría pedir?',
      body: 'Hola',
    };
    const conversation = {
      id: 'conversation-id',
      contactId: '573001112233',
      phoneNumber: '573001112233',
      aiEnabled: true,
    };
    let outboundMessage: { id: string } | null = null;
    const prisma = {
      whatsappCloudIntegration: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'integration-id',
          tenantId: 'tenant-id',
          locationId: 'location-id',
          phoneNumberId: 'phone-number-id',
          accessTokenEncrypted,
          isActive: true,
        }),
      },
      whatsappCloudConversation: {
        upsert: jest.fn().mockResolvedValue(conversation),
        update: jest.fn().mockResolvedValue({}),
      },
      whatsappCloudMessage: {
        findUnique: jest.fn().mockResolvedValue(inboundMessage),
        findFirst: jest.fn().mockImplementation(() => outboundMessage),
        create: jest.fn().mockImplementation(async ({ data }) => {
          outboundMessage = { id: data.providerMessageId };
          return {
            id: 'outbound-row',
            ...data,
          };
        }),
        update: jest.fn().mockImplementation(async ({ data }) => {
          Object.assign(inboundMessage, data);
          return inboundMessage;
        }),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((key: string) =>
        key === 'WHATSAPP_CLOUD_TOKEN_ENCRYPTION_KEY'
          ? encryptionKey.toString('base64')
          : 'v27.0',
      ),
    } as unknown as ConfigService;
    const aiGateway = {
      handleTextInput: jest.fn(),
    } as unknown as AIGateway;
    const sttService = {} as STTService;
    const service = new WhatsappCloudService(
      prisma,
      configService,
      aiGateway,
      sttService,
    );
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { messages: [{ id: 'wamid.reply' }] },
    } as never);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'phone-number-id' },
                contacts: [{ wa_id: '573001112233' }],
                messages: [
                  {
                    id: 'wamid.inbound',
                    from: '573001112233',
                    timestamp: '1795363200',
                    type: 'text',
                    text: { body: 'Hola' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await service.processWebhook(payload);
    await service.processWebhook(payload);

    expect(aiGateway.handleTextInput).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(inboundMessage.processingStatus).toBe(
      WhatsappCloudProcessingStatus.COMPLETED,
    );
  });
});
