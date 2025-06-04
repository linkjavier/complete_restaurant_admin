import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
  ],
  providers: [WhatsappService, WhatsappGateway, PrismaService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {} 