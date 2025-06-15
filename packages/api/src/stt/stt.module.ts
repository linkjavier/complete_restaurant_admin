import { Module } from '@nestjs/common';
import { STTService } from './stt.service';

@Module({
  providers: [STTService],
  exports: [STTService],
})
export class STTModule {} 