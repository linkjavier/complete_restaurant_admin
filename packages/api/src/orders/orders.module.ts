import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bull';
import { OrdersProcessor } from './orders.processor';
import { OrdersQueueService } from './orders-workers/orders-queue.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    BullModule.registerQueue(
      {
        name: 'orders',
      },
      {
        name: 'inventory-updates',
      },
      {
        name: 'notifications',
      }
    ),
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway, OrdersProcessor, OrdersQueueService],
  exports: [OrdersService],
})
export class OrdersModule {}