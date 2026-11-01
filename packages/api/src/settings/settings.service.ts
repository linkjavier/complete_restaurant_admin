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

  async updateBusinessSettings(tenantId: string, locationId: string, settings: BusinessSettings): Promise<BusinessSettings> {
    const existingSettings = await this.prisma.settings.findFirst({ where: { tenantId, locationId } });
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
          tenantId,
          locationId,
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

  async getBusinessSettings(tenantId: string, locationId: string): Promise<BusinessSettings> {
    try {
      let settings = await this.prisma.settings.findFirst({ where: { tenantId, locationId } });
      let tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        tenant = await this.prisma.tenant.create({
          data: {
            id: tenantId,
            name: 'default-tenant',
          },
        });
      }

      const defaultBusinessName =
        tenantId === 'default-tenant' ? 'Kutchen AI App' : tenant.name;

      if (!settings) {
        // Verificar si la location existe, si no, crear una por defecto
        let location = await this.prisma.location.findUnique({ where: { id: locationId } });
        if (!location) {
          location = await this.prisma.location.create({
            data: {
              id: locationId,
              name: 'Default Location',
              address: 'Default Address',
              phone: '+1234567890',
              tenantId: tenantId,
            }
          });
        }
        
        settings = await this.prisma.settings.create({
          data: {
            tenantId,
            locationId,
            businessName: defaultBusinessName,
            businessLogo: null,
          },
        });
      } else if (
        tenantId !== 'default-tenant' &&
        settings.businessName === 'Kutchen AI App'
      ) {
        settings = await this.prisma.settings.update({
          where: { id: settings.id },
          data: { businessName: tenant.name },
        });
      }
      return {
        name: settings.businessName,
        logo: settings.businessLogo || null,
      };
    } catch (error) {
      // Si hay algún error, devolver configuración por defecto
      console.error('Error getting business settings:', error);
      return {
        name: 'Kutchen AI App',
        logo: null,
      };
    }
  }

  async updateAISettings(tenantId: string, locationId: string, settings: AISettings): Promise<AISettings> {
    const existingSettings = await this.prisma.settings.findFirst({ where: { tenantId, locationId } });
    if (existingSettings) {
      const updated = await this.prisma.settings.update({
        where: { id: existingSettings.id },
        data: {
          aiName: settings.name,
          aiGender: settings.gender,
          aiEnabled: settings.enabled,
          deliveryFee: settings.deliveryFee,
        },
      });
      return {
        name: updated.aiName,
        gender: updated.aiGender,
        enabled: updated.aiEnabled,
        deliveryFee: updated.deliveryFee ?? 0,
      };
    } else {
      const created = await this.prisma.settings.create({
        data: {
          tenantId,
          locationId,
          aiName: settings.name,
          aiGender: settings.gender,
          aiEnabled: settings.enabled,
          deliveryFee: settings.deliveryFee,
        },
      });
      return {
        name: created.aiName,
        gender: created.aiGender,
        enabled: created.aiEnabled,
        deliveryFee: created.deliveryFee ?? 0,
      };
    }
  }

  async getAISettings(tenantId: string, locationId: string): Promise<AISettings> {
    let settings = await this.prisma.settings.findFirst({ where: { tenantId, locationId } });
    if (!settings) {
      settings = await this.prisma.settings.create({
        data: {
          tenantId,
          locationId,
          aiName: 'Sandra',
          aiGender: 'female',
          aiEnabled: false,
          deliveryFee: 0,
        },
      });
    }
    return {
      name: settings.aiName,
      gender: settings.aiGender,
      enabled: settings.aiEnabled,
      deliveryFee: settings.deliveryFee ?? 0,
    };
  }

  async getDeliveryFee(tenantId: string, locationId: string): Promise<number> {
    const settings = await this.prisma.settings.findFirst({ where: { tenantId, locationId } });
    return settings?.deliveryFee ?? 0;
  }

  async setDeliveryFee(tenantId: string, locationId: string, value: number): Promise<void> {
    let settings = await this.prisma.settings.findFirst({ where: { tenantId, locationId } });
    if (!settings) {
      await this.prisma.settings.create({ data: { tenantId, locationId, deliveryFee: value } });
    } else {
      await this.prisma.settings.update({ where: { id: settings.id }, data: { deliveryFee: value } });
    }
  }
} 