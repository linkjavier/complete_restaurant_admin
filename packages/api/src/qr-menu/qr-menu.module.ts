import { Module } from '@nestjs/common';
import { QrMenuController } from './qr-menu.controller';
import { QrMenuService } from './qr-menu.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [QrMenuController],
  providers: [QrMenuService],
})
export class QrMenuModule {}
