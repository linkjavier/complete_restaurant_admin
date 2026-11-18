import { Module } from '@nestjs/common';
import { QrMenuController } from './qr-menu.controller';
import { QrMenuService } from './qr-menu.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [QrMenuController],
  providers: [QrMenuService],
})
export class QrMenuModule {}
