import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Product } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(data: any): Promise<Product> {
    return this.prisma.product.create({
      data,
      include: {
        category: true,
      },
    });
  }

  async findAll({
    locationId,
    categoryId,
    search,
  }: {
    locationId: string;
    categoryId?: string;
    search?: string;
  }) {
    return this.prisma.product.findMany({
      where: {
        locationId,
        categoryId: categoryId,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        category: true,
      },
    });
  }

  async findOne(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });
  }

  async update(id: string, data: any): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async remove(id: string): Promise<Product> {
    return this.prisma.product.delete({
      where: { id },
    });
  }
} 