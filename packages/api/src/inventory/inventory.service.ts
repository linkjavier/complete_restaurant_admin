import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryItem,
  InventoryModificationItemType,
  InventoryModificationStatus,
  Prisma,
} from '@prisma/client';
import { StockSyncService } from './stock-sync.service';

export type InventoryStockType = 'PRODUCT' | 'INGREDIENT';
export type InventoryModificationItemKind = 'PRODUCT' | 'INGREDIENT';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private stockSync: StockSyncService,
  ) {}

  async inventoryItem(
    inventoryItemWhereUniqueInput: Prisma.InventoryItemWhereUniqueInput,
  ): Promise<InventoryItem | null> {
    return this.prisma.inventoryItem.findUnique({
      where: inventoryItemWhereUniqueInput,
      include: {
        ingredient: true,
        location: true,
      },
    });
  }

  async inventoryItems(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.InventoryItemWhereUniqueInput;
    where?: Prisma.InventoryItemWhereInput;
    orderBy?: Prisma.InventoryItemOrderByWithRelationInput;
  }): Promise<InventoryItem[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.inventoryItem.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        ingredient: true,
        location: true,
      },
    });
  }

  async findStockOverview(tenantId: string, locationId?: string) {
    if (locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, tenantId },
        select: { id: true },
      });
      if (!location) {
        throw new BadRequestException('La sucursal seleccionada no es válida');
      }
    }

    const locationFilter = locationId ? { locationId } : {};
    const [products, ingredients] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId, ...locationFilter },
        include: {
          category: { select: { name: true } },
          location: { select: { id: true, name: true } },
          ingredients: {
            include: {
              ingredient: { select: { id: true, name: true, unit: true } },
            },
          },
          components: {
            include: {
              component: { select: { id: true, name: true, unit: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ingredient.findMany({
        where: { tenantId, ...locationFilter },
        include: { location: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    return [
      ...products.map((product) => ({
        id: product.id,
        code: product.code,
        type: 'PRODUCT' as const,
        name: product.name,
        description: product.description,
        quantity: product.quantity,
        unit: product.unit,
        locationId: product.locationId,
        locationName: product.location.name,
        categoryName: product.category.name,
        productKind: product.isIntermediate ? ('INTERMEDIATE' as const) : ('PRODUCT' as const),
        isActive: product.isActive,
        image: product.image,
        updatedAt: product.updatedAt,
        recipeIngredients: product.ingredients.map((line) => ({
          id: line.ingredient.id,
          name: line.ingredient.name,
          quantity: line.quantity,
          unit: line.ingredient.unit,
        })),
        recipeComponents: product.components.map((line) => ({
          id: line.component.id,
          name: line.component.name,
          quantity: line.quantity,
          unit: line.component.unit,
        })),
      })),
      ...ingredients.map((ingredient) => ({
        id: ingredient.id,
        code: ingredient.code,
        type: 'INGREDIENT' as const,
        name: ingredient.name,
        description: ingredient.description,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        minQuantity: ingredient.minQuantity,
        locationId: ingredient.locationId,
        locationName: ingredient.location.name,
        categoryName: null,
        productKind: null,
        isActive: true,
        image: null,
        updatedAt: ingredient.updatedAt,
        recipeIngredients: [],
        recipeComponents: [],
      })),
    ];
  }

  async findModifications(tenantId: string, locationId?: string) {
    return this.prisma.inventoryModification.findMany({
      where: { tenantId, ...(locationId ? { locationId } : {}) },
      orderBy: { number: 'desc' },
      take: 30,
      select: {
        id: true,
        number: true,
        status: true,
        notes: true,
        createdAt: true,
        appliedAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        appliedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async findModification(id: string, tenantId: string, locationId?: string) {
    return this.prisma.inventoryModification.findFirst({
      where: { id, tenantId, ...(locationId ? { locationId } : {}) },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        appliedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        location: { select: { id: true, name: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            countedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
  }

  async createModification(params: {
    tenantId: string;
    locationId: string;
    createdById: string;
    notes?: string;
  }) {
    const location = await this.prisma.location.findFirst({
      where: { id: params.locationId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException('La sucursal seleccionada no es válida');
    }

    return this.prisma.inventoryModification.create({
      data: {
        tenantId: params.tenantId,
        locationId: params.locationId,
        createdById: params.createdById,
        notes: params.notes?.trim() || null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        appliedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        location: { select: { id: true, name: true } },
        items: true,
      },
    });
  }

  async countModificationItem(params: {
    modificationId: string;
    tenantId: string;
    locationId?: string;
    itemId: string;
    itemType: InventoryModificationItemKind;
    countedQuantity: number;
    countedById: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const modification = await tx.inventoryModification.findFirst({
        where: {
          id: params.modificationId,
          tenantId: params.tenantId,
          ...(params.locationId ? { locationId: params.locationId } : {}),
          status: InventoryModificationStatus.DRAFT,
        },
        select: { id: true, locationId: true },
      });
      if (!modification) {
        throw new NotFoundException('La modificación no existe o ya fue confirmada');
      }

      let stockItem: {
        id: string;
        name: string;
        unit: string;
        quantity: number;
        code?: string;
      } | null;
      if (params.itemType === 'INGREDIENT') {
        stockItem = await tx.ingredient.findFirst({
          where: {
            id: params.itemId,
            tenantId: params.tenantId,
            locationId: modification.locationId,
          },
          select: { id: true, name: true, unit: true, quantity: true, code: true },
        });
      } else {
        stockItem = await tx.product.findFirst({
          where: {
            id: params.itemId,
            tenantId: params.tenantId,
            locationId: modification.locationId,
          },
          select: { id: true, name: true, unit: true, quantity: true, code: true },
        });
      }
      if (!stockItem) {
        throw new NotFoundException('El artículo no pertenece a la sucursal de esta modificación');
      }

      const itemType = params.itemType as InventoryModificationItemType;
      const existing = await tx.inventoryModificationItem.findUnique({
        where: {
          modificationId_itemType_itemId: {
            modificationId: modification.id,
            itemType,
            itemId: stockItem.id,
          },
        },
        select: { id: true, systemQuantity: true },
      });

      if (existing) {
        return tx.inventoryModificationItem.update({
          where: { id: existing.id },
          data: {
            countedQuantity: params.countedQuantity,
            difference: params.countedQuantity - existing.systemQuantity,
            countedById: params.countedById,
            itemCode: stockItem.code ?? null,
          },
        });
      }

      return tx.inventoryModificationItem.create({
        data: {
          modificationId: modification.id,
          itemType,
          itemId: stockItem.id,
          itemName: stockItem.name,
          itemCode: stockItem.code ?? null,
          unit: stockItem.unit,
          countedById: params.countedById,
          systemQuantity: stockItem.quantity,
          countedQuantity: params.countedQuantity,
          difference: params.countedQuantity - stockItem.quantity,
        },
      });
    });
  }

  async removeModificationItem(params: {
    modificationId: string;
    itemId: string;
    tenantId: string;
    locationId?: string;
  }) {
    const modification = await this.prisma.inventoryModification.findFirst({
      where: {
        id: params.modificationId,
        tenantId: params.tenantId,
        ...(params.locationId ? { locationId: params.locationId } : {}),
        status: InventoryModificationStatus.DRAFT,
      },
      select: { id: true },
    });
    if (!modification) {
      throw new NotFoundException('La modificación no existe o ya fue confirmada');
    }

    const result = await this.prisma.inventoryModificationItem.deleteMany({
      where: { id: params.itemId, modificationId: modification.id },
    });
    if (result.count === 0) {
      throw new NotFoundException('El artículo no pertenece a esta modificación');
    }
    return { success: true };
  }

  async applyModification(params: {
    id: string;
    tenantId: string;
    locationId?: string;
    appliedById: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const modification = await tx.inventoryModification.findFirst({
        where: {
          id: params.id,
          tenantId: params.tenantId,
          ...(params.locationId ? { locationId: params.locationId } : {}),
          status: InventoryModificationStatus.DRAFT,
        },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      if (!modification) {
        throw new NotFoundException('La modificación no existe o ya fue confirmada');
      }
      if (modification.items.length === 0) {
        throw new BadRequestException('Agrega al menos un artículo antes de confirmar');
      }

      for (const item of modification.items) {
        if (item.itemType === InventoryModificationItemType.INGREDIENT) {
          const result = await tx.ingredient.updateMany({
            where: {
              id: item.itemId,
              tenantId: params.tenantId,
              locationId: modification.locationId,
              quantity: item.systemQuantity,
            },
            data: { quantity: item.countedQuantity },
          });
          if (result.count !== 1) {
            throw new ConflictException(
              `${item.itemName} cambió desde que se inició el conteo. Retíralo, vuelve a contarlo y confirma otra vez.`,
            );
          }
          const ingredient = await tx.ingredient.findUniqueOrThrow({
            where: { id: item.itemId },
          });
          await this.stockSync.syncFromIngredient(tx, ingredient);
        } else {
          const result = await tx.product.updateMany({
            where: {
              id: item.itemId,
              tenantId: params.tenantId,
              locationId: modification.locationId,
              quantity: item.systemQuantity,
            },
            data: { quantity: item.countedQuantity },
          });
          if (result.count !== 1) {
            throw new ConflictException(
              `${item.itemName} cambió desde que se inició el conteo. Retíralo, vuelve a contarlo y confirma otra vez.`,
            );
          }
        }
      }

      const appliedAt = new Date();
      const result = await tx.inventoryModification.updateMany({
        where: {
          id: modification.id,
          tenantId: params.tenantId,
          status: InventoryModificationStatus.DRAFT,
        },
        data: {
          status: InventoryModificationStatus.APPLIED,
          appliedAt,
          appliedById: params.appliedById,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('Esta modificación ya fue confirmada por otro usuario');
      }

      return tx.inventoryModification.findUniqueOrThrow({
        where: { id: modification.id },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          appliedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          location: { select: { id: true, name: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            include: {
              countedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
    });
  }
}
