import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryItem, Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.inventoryItem.create({
      data,
      include: {
        ingredient: true,
        location: true,
      },
    });
  }

  async updateInventoryItem(params: {
    where: Prisma.InventoryItemWhereUniqueInput;
    data: Prisma.InventoryItemUpdateInput;
  }): Promise<InventoryItem> {
    const { where, data } = params;
    return this.prisma.inventoryItem.update({
      data,
      where,
      include: {
        ingredient: true,
        location: true,
      },
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