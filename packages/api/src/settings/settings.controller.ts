import { Controller, Post, Body, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AISettings } from './types';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post('ai')
  async updateAISettings(@Body() settings: AISettings): Promise<AISettings> {
    return this.settingsService.updateAISettings(settings);
  }

  @Get('ai')
  async getAISettings(): Promise<AISettings> {
    return this.settingsService.getAISettings();
  }
} 