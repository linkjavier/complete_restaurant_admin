import { Module, forwardRef } from '@nestjs/common';
import { AIGateway } from './ai.gateway';
import { ConversationService } from './services/conversation.service';
import { OrderStateService } from './services/order-state.service';
import { CustomerContextService } from './services/customer-context.service';
import { MessageHandlerService } from './services/message-handler.service';
import { MenuHandlerService } from './services/menu-handler.service';
import { OrderHandlerService } from './services/order-handler.service';
import { FunctionExecutorService } from './services/function-executor.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { STTModule } from '../stt/stt.module';
import { CategoriesModule } from '../categories/categories.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => OrdersModule),
    SettingsModule,
    STTModule,
    CategoriesModule,
    forwardRef(() => CustomersModule),
  ],
  providers: [
    AIGateway,
    ConversationService,
    OrderStateService,
    CustomerContextService,
    MessageHandlerService,
    MenuHandlerService,
    OrderHandlerService,
    FunctionExecutorService,
  ],
  exports: [AIGateway, CustomerContextService],
})
export class AIModule {} 