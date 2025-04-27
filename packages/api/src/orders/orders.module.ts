import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { KitchenController } from './kitchen.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersGateway } from './orders.gateway';
import { OrdersWorkersModule } from './orders-workers/orders-workers.module';
import { OrdersQueueService } from './orders-workers/orders-queue.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    PrismaModule,
    OrdersWorkersModule,
    BullModule.registerQueue(
      { name: 'orders' },
      { name: 'inventory-updates' },
      { name: 'notifications' }
    ),
  ],
  controllers: [OrdersController, KitchenController],
  providers: [
    OrdersService,
    OrdersGateway,
    OrdersQueueService,
  ],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {} 