import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingDocumentsService } from './billing-documents.service';
import { ListBillingDocumentsDto } from './dto/list-billing-documents.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.STAFF,
  UserRole.CASHIER,
)
export class BillingDocumentsController {
  constructor(private readonly billingDocumentsService: BillingDocumentsService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Query() query: ListBillingDocumentsDto,
  ) {
    return this.billingDocumentsService.list(tenantId, user, query);
  }

  @Get(':documentId')
  getOne(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Param('documentId') documentId: string,
  ) {
    return this.billingDocumentsService.getOne(tenantId, user, documentId);
  }
}
