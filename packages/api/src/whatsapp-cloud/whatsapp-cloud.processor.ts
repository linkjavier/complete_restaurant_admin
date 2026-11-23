import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { WHATSAPP_CLOUD_QUEUE } from './whatsapp-cloud.constants';
import { WhatsappCloudService } from './whatsapp-cloud.service';

@Processor(WHATSAPP_CLOUD_QUEUE)
export class WhatsappCloudProcessor {
  constructor(private readonly whatsappCloudService: WhatsappCloudService) {}

  @Process('process-webhook')
  async processWebhook(job: Job<{ payload: unknown }>) {
    await this.whatsappCloudService.processWebhook(job.data.payload);
  }
}
