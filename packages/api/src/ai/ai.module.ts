import { Module, forwardRef } from '@nestjs/common';
import { AIGateway } from './ai.gateway';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { STTModule } from '../stt/stt.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => OrdersModule),
    SettingsModule,
    STTModule,
  ],
  providers: [AIGateway],
  exports: [AIGateway],
})
export class AIModule {} 