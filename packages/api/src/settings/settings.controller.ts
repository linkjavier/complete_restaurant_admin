import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SettingsService, BusinessSettings } from './settings.service';
import { AISettings } from './types';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User, UserRole } from '@prisma/client';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post('ai')
  async updateAISettings(
    @Body() settings: AISettings & { locationId: string },
    @Req() req: Request
  ): Promise<AISettings> {
    const tenantId = (req as any).tenantId;
    return this.settingsService.updateAISettings(tenantId, settings.locationId, settings);
  }

  @Get('ai')
  async getAISettings(
    @Req() req: Request,
    @Query('locationId') locationId: string
  ): Promise<AISettings> {
    const tenantId = (req as any).tenantId;
    return this.settingsService.getAISettings(tenantId, locationId);
  }

  @Get('business')
  async getBusinessSettings(
    @Req() req: Request,
    @Query('locationId') locationId: string
  ): Promise<BusinessSettings> {
    // Si no hay tenantId (usuario no autenticado), usar un tenant por defecto
    const tenantId = (req as any).tenantId || 'default-tenant';
    return this.settingsService.getBusinessSettings(tenantId, locationId || 'default-location');
  }

  @Post('business')
  async updateBusinessSettings(
    @Body() settings: BusinessSettings & { locationId: string },
    @Req() req: Request
  ): Promise<BusinessSettings> {
    const tenantId = (req as any).tenantId;
    return this.settingsService.updateBusinessSettings(tenantId, settings.locationId, settings);
  }

  @Get('cash-shift')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async getCashShiftSettings(
    @Query('locationId') locationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    if (!locationId) {
      throw new BadRequestException('Location ID is required.');
    }
    return this.settingsService.getCashShiftSettings(tenantId, user, locationId);
  }

  @Post('cash-shift')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async updateCashShiftSettings(
    @Body() settings: { locationId: string; defaultOpeningCash: number },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    if (!settings.locationId) {
      throw new BadRequestException('Location ID is required.');
    }
    return this.settingsService.updateCashShiftSettings(
      tenantId,
      user,
      settings.locationId,
      settings.defaultOpeningCash,
    );
  }
} 