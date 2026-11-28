import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SalesReportQueryDto } from './sales-report.dto';
import { SalesReportService } from './sales-report.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class SalesReportController {
  constructor(private readonly salesReportService: SalesReportService) {}

  @Get('sales')
  getSalesReport(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Query() query: SalesReportQueryDto,
  ) {
    return this.salesReportService.getReport(tenantId, user, query);
  }
}
