import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AIModule } from '../ai/ai.module';
import { STTModule } from '../stt/stt.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => AIModule),
    STTModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway],
  exports: [WhatsappService],
})
export class WhatsappModule {} 