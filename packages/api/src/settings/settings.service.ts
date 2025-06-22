import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AISettings } from './types';
import { PrismaService } from '../prisma/prisma.service';

export interface BusinessSettings {
  name: string;
  logo: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async updateBusinessSettings(settings: BusinessSettings): Promise<BusinessSettings> {
    const existingSettings = await this.prisma.settings.findFirst();
    if (existingSettings) {
      const updated = await this.prisma.settings.update({
        where: { id: existingSettings.id },
        data: {
          businessName: settings.name,
          businessLogo: settings.logo,
        },
      });
      return {
        name: updated.businessName,
        logo: updated.businessLogo || null,
      };
    } else {
      const created = await this.prisma.settings.create({
        data: {
          businessName: settings.name,
          businessLogo: settings.logo,
        },
      });
      return {
        name: created.businessName,
        logo: created.businessLogo || null,
      };
    }
  }

  async getBusinessSettings(): Promise<BusinessSettings> {
    const settings = await this.prisma.settings.findFirst();
    if (!settings) {
      const defaultSettings = await this.prisma.settings.create({
        data: {
          businessName: 'Kutchen AI App',
          businessLogo: null,
        },
      });
      return {
        name: defaultSettings.businessName,
        logo: defaultSettings.businessLogo || null,
      };
    }
    return {
      name: settings.businessName,
      logo: settings.businessLogo || null,
    };
  }

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