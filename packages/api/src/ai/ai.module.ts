import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIGateway } from './ai.gateway';

@Module({
  imports: [ConfigModule],
  providers: [AIGateway],
  exports: [AIGateway],
})
export class AIModule {} 