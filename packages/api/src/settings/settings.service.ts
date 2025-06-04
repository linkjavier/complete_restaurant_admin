import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AISettings } from './types';

@Injectable()
export class SettingsService {
  private aiSettings: AISettings = {
    name: 'Sandra',
    gender: 'female',
  };

  constructor(private configService: ConfigService) {}

  async updateAISettings(settings: AISettings): Promise<AISettings> {
    this.aiSettings = settings;
    return this.aiSettings;
  }

  async getAISettings(): Promise<AISettings> {
    return this.aiSettings;
  }
} 