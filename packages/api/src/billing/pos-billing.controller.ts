import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  DeclineSplitPaymentInvoiceDto,
  DeclineTableInvoiceDto,
  IssueSplitPaymentInvoiceDto,
  IssuePosInvoiceDto,
} from './dto/issue-pos-invoice.dto';
import { PosBillingService } from './pos-billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.CASHIER)
export class PosBillingController {
  constructor(private readonly posBillingService: PosBillingService) {}

  @Post('orders')
  issueForOrders(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Body() input: IssuePosInvoiceDto,
  ) {
    return this.posBillingService.issueForOrders(tenantId, user, input.orderIds, input.customer);
  }

  @Post('tables/:tableId')
  issueForTable(
    @Param('tableId') tableId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Body() input: IssuePosInvoiceDto,
  ) {
    return this.posBillingService.issueForTable(
      tenantId,
      user,
      tableId,
      input.orderIds,
      input.customer,
    );
  }

  @Post('tables/:tableId/decline')
  declineTableInvoice(
    @Param('tableId') tableId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Body() input: DeclineTableInvoiceDto,
  ) {
    return this.posBillingService.declineTableInvoice(tenantId, user, tableId, input.orderIds);
  }

  @Post('tables/:tableId/payments')
  issueForTablePayments(
    @Param('tableId') tableId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Body() input: IssueSplitPaymentInvoiceDto,
  ) {
    return this.posBillingService.issueForTablePayments(
      tenantId,
      user,
      tableId,
      input.paymentIds,
      input.customer,
    );
  }

  @Post('tables/:tableId/payments/decline')
  declineTablePaymentInvoice(
    @Param('tableId') tableId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Body() input: DeclineSplitPaymentInvoiceDto,
  ) {
    return this.posBillingService.declineTablePaymentInvoice(
      tenantId,
      user,
      tableId,
      input.paymentIds,
    );
  }

  @Post('documents/:documentId/retry')
  retryDocument(
    @Param('documentId') documentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.posBillingService.retryDocument(tenantId, user, documentId);
  }
}
