import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface QrMenuBannerInput {
  title: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
}

interface UpdateQrMenuInput {
  enabled: boolean;
  orderingEnabled: boolean;
  primaryColor: string;
  whatsappPhone?: string | null;
  productIds: string[];
  banners: QrMenuBannerInput[];
}

@Injectable()
export class QrMenuService {
  constructor(private readonly prisma: PrismaService) {}

  async getManagerConfiguration(locationId: string, tenantId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true, name: true, phone: true },
    });
    if (!location) {
      throw new NotFoundException('Ubicación no encontrada');
    }

    const settings = await this.prisma.settings.upsert({
      where: { tenantId_locationId: { tenantId, locationId } },
      create: { tenantId, locationId },
      update: {},
      include: { qrMenuBanners: { orderBy: { order: 'asc' } } },
    });
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        locationId,
        isActive: true,
        isIntermediate: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        categoryId: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      location,
      enabled: settings.qrMenuEnabled,
      orderingEnabled: settings.qrMenuOrderingEnabled,
      primaryColor: settings.qrMenuPrimaryColor,
      whatsappPhone: settings.qrMenuWhatsAppPhone || location.phone,
      products,
      productIds: settings.qrMenuProductsConfigured
        ? settings.qrMenuProductIds.filter((id) =>
            products.some((product) => product.id === id),
          )
        : products.map((product) => product.id),
      productsConfigured: settings.qrMenuProductsConfigured,
      banners: settings.qrMenuBanners,
    };
  }

  async getPublicMenu(locationId: string) {
    const settings = await this.prisma.settings.findFirst({
      where: { locationId, qrMenuEnabled: true },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            country: true,
            phone: true,
          },
        },
        qrMenuBanners: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!settings) {
      throw new NotFoundException('Este menú no está disponible');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: settings.qrMenuProductIds },
        tenantId: settings.tenantId,
        locationId,
        isActive: true,
        isIntermediate: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      name: settings.businessName,
      logo: settings.businessLogo,
      location: settings.location,
      enabled: settings.qrMenuEnabled,
      orderingEnabled: settings.qrMenuOrderingEnabled,
      primaryColor: settings.qrMenuPrimaryColor,
      whatsappPhone: settings.qrMenuWhatsAppPhone || settings.location.phone,
      banners: settings.qrMenuBanners,
      products,
    };
  }

  async updateManagerConfiguration(
    locationId: string,
    tenantId: string,
    input: UpdateQrMenuInput,
  ) {
    this.validateInput(input);
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Ubicación no encontrada');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: input.productIds },
        tenantId,
        locationId,
        isActive: true,
        isIntermediate: false,
      },
      select: { id: true },
    });
    if (products.length !== new Set(input.productIds).size) {
      throw new BadRequestException(
        'La selección contiene productos no disponibles para el menú',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const settings = await transaction.settings.upsert({
        where: { tenantId_locationId: { tenantId, locationId } },
        create: { tenantId, locationId },
        update: {},
      });

      await transaction.settings.update({
        where: { id: settings.id },
        data: {
          qrMenuEnabled: input.enabled,
          qrMenuOrderingEnabled: input.orderingEnabled,
          qrMenuPrimaryColor: input.primaryColor,
          qrMenuWhatsAppPhone: input.whatsappPhone?.trim() || null,
          qrMenuProductIds: [...new Set(input.productIds)],
          qrMenuProductsConfigured: true,
        },
      });

      await transaction.qrMenuBanner.deleteMany({
        where: { settingsId: settings.id },
      });
      if (input.banners.length) {
        await transaction.qrMenuBanner.createMany({
          data: input.banners.map((banner, order) => ({
            settingsId: settings.id,
            title: banner.title.trim(),
            description: banner.description?.trim() || null,
            imageUrl: banner.imageUrl?.trim() || null,
            isActive: banner.isActive,
            order,
          })),
        });
      }
    });
    return this.getManagerConfiguration(locationId, tenantId);
  }

  private validateInput(input: UpdateQrMenuInput) {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof input.enabled !== 'boolean' ||
      typeof input.orderingEnabled !== 'boolean' ||
      !/^#[0-9a-fA-F]{6}$/.test(input.primaryColor) ||
      !Array.isArray(input.productIds) ||
      input.productIds.some((id) => typeof id !== 'string') ||
      !Array.isArray(input.banners) ||
      input.banners.length > 10
    ) {
      throw new BadRequestException('La configuración del menú no es válida');
    }
    if (
      input.whatsappPhone != null &&
      (typeof input.whatsappPhone !== 'string' ||
        input.whatsappPhone.length > 40)
    ) {
      throw new BadRequestException('El teléfono de WhatsApp no es válido');
    }
    for (const banner of input.banners) {
      if (
        !banner ||
        typeof banner.title !== 'string' ||
        !banner.title.trim() ||
        banner.title.length > 100 ||
        (banner.description != null &&
          (typeof banner.description !== 'string' ||
            banner.description.length > 240)) ||
        (banner.imageUrl != null &&
          (typeof banner.imageUrl !== 'string' ||
            banner.imageUrl.length > 2048)) ||
        typeof banner.isActive !== 'boolean'
      ) {
        throw new BadRequestException('Hay un banner con datos no válidos');
      }
    }
  }
}
