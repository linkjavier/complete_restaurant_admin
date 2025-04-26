import { Module, forwardRef } from '@nestjs/common';
import { OrderGateway } from './order.gateway';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { WsAuthGuard } from './ws-auth.guard';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    AuthModule
  ],
  providers: [OrderGateway, WsAuthGuard],
  exports: [OrderGateway],
})
export class WebsocketModule {} 