import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  PosService,
  TableSettlementRequest,
} from './pos.service';
import { PosShiftService } from './pos-shift.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, PaymentMethod } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User } from '@prisma/client';

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
  constructor(
    private readonly posService: PosService,
    private readonly posShiftService: PosShiftService,
  ) {}

  @Get('shifts/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.CASHIER,
  )
  async getShiftStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Query('locationId') locationId?: string,
  ) {
    return this.posShiftService.getStatus(tenantId, user, locationId);
  }

  @Post('shifts/open')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.CASHIER,
  )
  async openShift(
    @Body() data: { locationId: string; openingCash: number },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.posShiftService.openShift(
      tenantId,
      user,
      data.locationId,
      data.openingCash,
    );
  }

  @Get('shifts/:shiftId/summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.CASHIER,
  )
  async getShiftSummary(
    @Param('shiftId') shiftId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.posShiftService.getShiftSummary(tenantId, user, shiftId);
  }

  @Post('shifts/:shiftId/close')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.CASHIER,
  )
  async closeShift(
    @Param('shiftId') shiftId: string,
    @Body()
    data: {
      declaredAmounts: Partial<Record<PaymentMethod, number>>;
      discrepancyNote?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.posShiftService.closeShift(
      tenantId,
      user,
      shiftId,
      data.declaredAmounts,
      data.discrepancyNote,
    );
  }

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
    @CurrentTenant() tenantId: string,
  ) {
    return this.posService.processPayment(
      orderId,
      paymentData.amount,
      paymentData.method,
      tenantId,
    );
  }

  @Post('orders/:id/split-payment')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Process split payment for an order' })
  @ApiResponse({ status: 201, description: 'Split payment processed successfully' })
  async processSplitPayment(
    @Param('id') orderId: string,
    @Body() splitPaymentData: SplitPaymentDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.posService.processSplitPayment({
      orderId,
      payments: splitPaymentData.payments,
    }, tenantId);
  }

  @Post('tables/:tableId/settle')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Settle or split the active account for a table' })
  async settleTableAccount(
    @Param('tableId') tableId: string,
    @Body() data: TableSettlementRequest,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.posService.settleTableAccount(tenantId, user, tableId, data);
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