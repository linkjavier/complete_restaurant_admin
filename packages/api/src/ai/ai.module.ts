import { Module } from '@nestjs/common';
import { AIGateway } from './ai.gateway';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    ProductsModule,
    OrdersModule,
  ],
  providers: [AIGateway],
  exports: [AIGateway],
})
export class AIModule {} 