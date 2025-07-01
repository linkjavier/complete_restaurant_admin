import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, PaymentMethod } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

class ProcessPaymentDto {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}

class SplitPaymentDto {
  orderId: string;
  payments: {
    amount: number;
    method: PaymentMethod;
  }[];
}

@ApiTags('pos')
@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('orders')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Get all active orders for POS' })
  @ApiResponse({ status: 200, description: 'Returns all active orders' })
  async getActiveOrders(@Query('tableId') tableId?: string) {
    return this.posService.getActiveOrders(tableId);
  }

  @Get('waiter-calls')
  @Roles(UserRole.CASHIER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get all active waiter calls' })
  @ApiResponse({ status: 200, description: 'Returns all active waiter calls' })
  async getActiveWaiterCalls() {
    return this.posService.getActiveWaiterCalls();
  }

  @Get('orders/:id')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Get order details with payment information' })
  @ApiResponse({ status: 200, description: 'Returns order details' })
  async getOrderDetails(@Param('id') id: string) {
    return this.posService.getOrderDetails(id);
  }

  @Post('orders/:id/payment')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Process payment for an order' })
  @ApiResponse({ status: 201, description: 'Payment processed successfully' })
  async processPayment(
    @Param('id') orderId: string,
    @Body() paymentData: ProcessPaymentDto,
  ) {
    const order = await this.posService['prisma'].order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    return this.posService.processPayment(
      orderId,
      paymentData.amount,
      paymentData.method,
      order.tenantId,
    );
  }

  @Post('orders/:id/split-payment')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Process split payment for an order' })
  @ApiResponse({ status: 201, description: 'Split payment processed successfully' })
  async processSplitPayment(
    @Param('id') orderId: string,
    @Body() splitPaymentData: SplitPaymentDto,
  ) {
    return this.posService.processSplitPayment({
      orderId,
      payments: splitPaymentData.payments,
    });
  }

  @Post('waiter-calls/:id/resolve')
  @Roles(UserRole.CASHIER, UserRole.WAITER)
  @ApiOperation({ summary: 'Mark a waiter call as resolved' })
  @ApiResponse({ status: 200, description: 'Waiter call marked as resolved' })
  async resolveWaiterCall(@Param('id') id: string) {
    await this.posService.markWaiterCallAsResolved(id);
    return { success: true };
  }
} 