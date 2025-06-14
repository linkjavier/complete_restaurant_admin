import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { TablesModule } from './tables/tables.module';
import { LocationsModule } from './locations/locations.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InventoryModule } from './inventory/inventory.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ProductionModule } from './production/production.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { AIModule } from './ai/ai.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { SettingsModule } from './settings/settings.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    TablesModule,
    LocationsModule,
    CategoriesModule,
    OrdersModule,
    PaymentsModule,
    NotificationsModule,
    InventoryModule,
    IngredientsModule,
    WebsocketModule,
    ProductionModule,
    KitchenModule,
    AIModule,
    WhatsappModule,
    SettingsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}