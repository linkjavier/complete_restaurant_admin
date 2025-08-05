import { Controller, Post, Body, Get, Req, Query } from '@nestjs/common';
import { SettingsService, BusinessSettings } from './settings.service';
import { AISettings } from './types';
import { Request } from 'express';

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
} 