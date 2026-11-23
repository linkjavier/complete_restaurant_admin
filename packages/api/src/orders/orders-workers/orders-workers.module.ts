import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { OrdersProcessorService } from './orders-processor.service';
import { InventoryProcessorService } from './inventory-processor.service';
import { NotificationsProcessorService } from './notifications-processor.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    InventoryModule,
    BullModule.registerQueue(
      {
        name: 'orders',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: 'inventory-updates',
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2 seconds
          },
          priority: 2, // Lower priority than orders processing
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: 'notifications',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000, // 1 second
          },
          priority: 3, // Lowest priority
          removeOnComplete: true,
          removeOnFail: true,
        },
      }
    ),
  ],
  providers: [
    OrdersProcessorService,
    InventoryProcessorService,
    NotificationsProcessorService,
  ],
  exports: [
    OrdersProcessorService,
    InventoryProcessorService,
    NotificationsProcessorService,
  ],
})
export class OrdersWorkersModule {} 