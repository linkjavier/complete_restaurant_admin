import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User } from '@prisma/client';
import { QrMenuService } from './qr-menu.service';

@ApiTags('qr-menu')
@Controller('qr-menu')
export class QrMenuController {
  constructor(private readonly qrMenuService: QrMenuService) {}

  @Get('manage/:locationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getManagerConfiguration(
    @Param('locationId') locationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    this.assertLocationAccess(locationId, user);
    return this.qrMenuService.getManagerConfiguration(
      locationId,
      tenantId,
    );
  }

  @Patch('manage/:locationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  updateManagerConfiguration(
    @Param('locationId') locationId: string,
    @Body() input: Parameters<QrMenuService['updateManagerConfiguration']>[2],
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    this.assertLocationAccess(locationId, user);
    return this.qrMenuService.updateManagerConfiguration(
      locationId,
      tenantId,
      input,
    );
  }

  @Public()
  @Get('public/:locationId')
  getPublicMenu(@Param('locationId') locationId: string) {
    return this.qrMenuService.getPublicMenu(locationId);
  }

  private assertLocationAccess(locationId: string, user: User) {
    if (user.role === 'MANAGER' && user.locationId !== locationId) {
      throw new ForbiddenException('No tienes acceso a esta ubicación');
    }
  }
}
