import {
  Controller,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('kitchen')
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders/items/:itemId/status')
  updateOrderItemStatus(
    @Param('itemId') itemId: string,
    @Body('status') status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED',
  ) {
    // Find the order that contains this item
    // This is a simplified version - in a real app, you'd first find the order containing the item
    // For demo purposes, we're assuming the item has a direct relationship with the order
    return this.ordersService.updateItemStatus('', itemId, status);
  }

  @Post('orders/:orderId/print')
  printKitchenTicket(@Param('orderId') orderId: string) {
    // In a real implementation, this would connect to a printer service
    // For now, we'll just simulate success
    console.log(`Printing kitchen ticket for order ${orderId}`);
    return { success: true, message: 'Ticket sent to printer' };
  }
} 