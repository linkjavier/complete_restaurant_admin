import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosShiftService } from './pos-shift.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PosController],
  providers: [PosService, PosShiftService],
  exports: [PosService, PosShiftService],
})
export class PosModule {} 