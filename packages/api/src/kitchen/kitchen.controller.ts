import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { UserRole, OrderItemStatus } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('kitchen')
@Controller('kitchen')
@UseGuards(JwtAuthGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  async getActiveOrders() {
    return this.kitchenService.getActiveOrders();
  }

  @Post('orders/items/:itemId/status')
  async updateOrderItemStatus(
    @Param('itemId') itemId: string,
    @Body('status') status: OrderItemStatus,
  ) {
    console.log(`Kitchen Controller: Updating item ${itemId} to status ${status}`);
    return this.kitchenService.updateOrderItemStatus(itemId, status);
  }

  @Post('orders/:orderId/print')
  async printKitchenTicket(@Param('orderId') orderId: string) {
    await this.kitchenService.printKitchenTicket(orderId);
    return { success: true };
  }
}