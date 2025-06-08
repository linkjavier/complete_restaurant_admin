import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AISettings } from './types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async updateAISettings(settings: AISettings): Promise<AISettings> {
    // Get or create settings record
    const existingSettings = await this.prisma.settings.findFirst();
    
    if (existingSettings) {
      // Update existing settings
      const updated = await this.prisma.settings.update({
        where: { id: existingSettings.id },
        data: {
          aiName: settings.name,
          aiGender: settings.gender,
          aiEnabled: settings.enabled,
        },
      });
      
      return {
        name: updated.aiName,
        gender: updated.aiGender,
        enabled: updated.aiEnabled,
      };
    } else {
      // Create new settings
      const created = await this.prisma.settings.create({
        data: {
          aiName: settings.name,
          aiGender: settings.gender,
          aiEnabled: settings.enabled,
        },
      });
      
      return {
        name: created.aiName,
        gender: created.aiGender,
        enabled: created.aiEnabled,
      };
    }
  }

  async getAISettings(): Promise<AISettings> {
    const settings = await this.prisma.settings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      const defaultSettings = await this.prisma.settings.create({
        data: {
          aiName: 'Sandra',
          aiGender: 'female',
          aiEnabled: false,
        },
      });
      
      return {
        name: defaultSettings.aiName,
        gender: defaultSettings.aiGender,
        enabled: defaultSettings.aiEnabled,
      };
    }
    
    return {
      name: settings.aiName,
      gender: settings.aiGender,
      enabled: settings.aiEnabled,
    };
  }
} 