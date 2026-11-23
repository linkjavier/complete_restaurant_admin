import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { WHATSAPP_CLOUD_QUEUE } from './whatsapp-cloud.constants';
import { isValidMetaWebhookSignature, isValidWebhookChallenge } from './meta-webhook-security';

@Controller('webhooks/meta/whatsapp')
export class MetaWhatsappWebhookController {
  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(WHATSAPP_CLOUD_QUEUE)
    private readonly webhookQueue: Queue,
  ) {}

  @Public()
  @Get()
  verify(@Query() query: Record<string, string>, @Res() response: Response) {
    const verifyToken = this.configService.get<string>('WHATSAPP_CLOUD_VERIFY_TOKEN');
    if (!verifyToken) {
      throw new ServiceUnavailableException('WhatsApp webhook verification is not configured');
    }

    if (
      !isValidWebhookChallenge(query['hub.mode'], query['hub.verify_token'], verifyToken) ||
      !query['hub.challenge']
    ) {
      throw new ForbiddenException('Invalid webhook verification request');
    }
    return response.type('text/plain').status(200).send(query['hub.challenge']);
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    const rawBody = request.rawBody;
    const appSecret = this.configService.get<string>('WHATSAPP_CLOUD_APP_SECRET');
    if (!appSecret) {
      throw new ServiceUnavailableException(
        'WhatsApp webhook signature validation is not configured',
      );
    }
    if (!isValidMetaWebhookSignature(rawBody, signature, appSecret)) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature');
    }
    const payload = request.body as unknown;
    const jobId = createHash('sha256').update(rawBody).digest('hex').slice(0, 40);

    await this.webhookQueue.add(
      'process-webhook',
      { payload },
      {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
    return { received: true };
  }
}
