import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateBillingLocationConfigurationDto } from './dto/update-billing-location-configuration.dto';
import { BillingService } from './billing.service';
import {
  BillingLocationConfigurationService,
  BillingLocationConfigurationView,
} from './billing-location-configuration.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/configuration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BillingLocationConfigurationController {
  constructor(
    private readonly configurationService: BillingLocationConfigurationService,
    private readonly billingService: BillingService,
  ) {}

  @Get(':locationId')
  getForLocation(
    @CurrentTenant() tenantId: string,
    @Param('locationId') locationId: string,
  ): Promise<BillingLocationConfigurationView> {
    return this.configurationService.getForLocation(tenantId, locationId);
  }

  @Put(':locationId')
  updateForLocation(
    @CurrentTenant() tenantId: string,
    @Param('locationId') locationId: string,
    @Body() input: UpdateBillingLocationConfigurationDto,
  ): Promise<BillingLocationConfigurationView> {
    return this.configurationService.updateForLocation(tenantId, locationId, input);
  }

  @Post(':locationId/test-connection')
  testConnection(
    @CurrentTenant() tenantId: string,
    @Param('locationId') locationId: string,
  ): Promise<{ connected: true }> {
    return this.billingService.testConnection(tenantId, locationId);
  }
}
