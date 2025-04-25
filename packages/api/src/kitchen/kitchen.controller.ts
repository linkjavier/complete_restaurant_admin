import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, OrderItemStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('kitchen')
@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  @Roles(UserRole.WAITER)
  @ApiOperation({ summary: 'Get all active orders for kitchen' })
  @ApiResponse({ status: 200, description: 'Returns all active orders' })
  async getActiveOrders() {
    return this.kitchenService.getActiveOrders();
  }

  @Post('orders/items/:id/status')
  @Roles(UserRole.CHEF)
  @ApiOperation({ summary: 'Update order item status in kitchen' })
  @ApiResponse({ status: 200, description: 'Order item status updated successfully' })
  async updateOrderItemStatus(
    @Param('id') id: string,
    @Body('status') status: OrderItemStatus,
  ) {
    return this.kitchenService.updateOrderItemStatus(id, status);
  }

  @Post('orders/:id/print')
  @Roles(UserRole.CHEF)
  @ApiOperation({ summary: 'Print kitchen ticket for an order' })
  @ApiResponse({ status: 200, description: 'Kitchen ticket printed successfully' })
  async printKitchenTicket(@Param('id') id: string) {
    await this.kitchenService.printKitchenTicket(id);
    return { success: true };
  }
} 