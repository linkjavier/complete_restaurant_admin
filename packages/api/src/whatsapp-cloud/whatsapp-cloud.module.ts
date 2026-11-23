import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { STTModule } from '../stt/stt.module';
import { WhatsappCloudController } from './whatsapp-cloud.controller';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { MetaWhatsappWebhookController } from './meta-whatsapp-webhook.controller';
import { WhatsappCloudProcessor } from './whatsapp-cloud.processor';
import { WHATSAPP_CLOUD_QUEUE } from './whatsapp-cloud.constants';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AIModule),
    STTModule,
    BullModule.registerQueue({ name: WHATSAPP_CLOUD_QUEUE }),
  ],
  controllers: [WhatsappCloudController, MetaWhatsappWebhookController],
  providers: [WhatsappCloudService, WhatsappCloudProcessor],
  exports: [WhatsappCloudService],
})
export class WhatsappCloudModule {}
