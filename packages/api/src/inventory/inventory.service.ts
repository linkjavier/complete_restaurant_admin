import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryItem, Prisma } from '@prisma/client';
import { StockSyncService } from './stock-sync.service';

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

  async createInventoryItem(data: Prisma.InventoryItemCreateInput): Promise<InventoryItem> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data,
        include: {
          ingredient: true,
          location: true,
        },
      });

      await this.stockSync.syncFromInventoryItem(tx, item);

      return item;
    });
  }

  async updateInventoryItem(params: {
    where: Prisma.InventoryItemWhereUniqueInput;
    data: Prisma.InventoryItemUpdateInput;
  }): Promise<InventoryItem> {
    const { where, data } = params;

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        data,
        where,
        include: {
          ingredient: true,
          location: true,
        },
      });

      if (data.quantity !== undefined || data.minQuantity !== undefined) {
        await this.stockSync.syncFromInventoryItem(tx, item);
      }

      return item;
    });
  }

  async deleteInventoryItem(where: Prisma.InventoryItemWhereUniqueInput): Promise<InventoryItem> {
    return this.prisma.inventoryItem.delete({
      where,
      include: {
        ingredient: true,
        location: true,
      },
    });
  }
}
