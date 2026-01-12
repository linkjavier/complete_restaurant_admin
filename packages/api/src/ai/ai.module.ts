import { Module, forwardRef } from '@nestjs/common';
import { AIGateway } from './ai.gateway';
import { AIImportController } from './ai-import.controller';
import { ConversationService } from './services/conversation.service';
import { OrderStateService } from './services/order-state.service';
import { CustomerContextService } from './services/customer-context.service';
import { MessageHandlerService } from './services/message-handler.service';
import { MenuHandlerService } from './services/menu-handler.service';
import { OrderHandlerService } from './services/order-handler.service';
import { FunctionExecutorService } from './services/function-executor.service';
import { ParserService } from './services/parser.service';
import { HereService } from './services/here.service';
import { CoordinatorService } from './services/coordinator.service';
import { BreakfastAgent } from './agents/breakfast.agent';
import { LunchAgent } from './agents/lunch.agent';
import { DataAnalysisAgent } from './agents/data-analysis.agent';
import { CustomAgent } from './agents/custom.agent';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { STTModule } from '../stt/stt.module';
import { CategoriesModule } from '../categories/categories.module';
import { CustomersModule } from '../customers/customers.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => OrdersModule),
    SettingsModule,
    STTModule,
    CategoriesModule,
    forwardRef(() => CustomersModule),
    forwardRef(() => LocationsModule),
  ],
  controllers: [AIImportController],
  providers: [
    AIGateway,
    ConversationService,
    OrderStateService,
    CustomerContextService,
    MessageHandlerService,
    MenuHandlerService,
    OrderHandlerService,
    FunctionExecutorService,
    ParserService,
    HereService,
    CoordinatorService,
    BreakfastAgent,
    LunchAgent,
    DataAnalysisAgent,
    CustomAgent,
  ],
  exports: [AIGateway, CustomerContextService, HereService],
})
export class AIModule { }
