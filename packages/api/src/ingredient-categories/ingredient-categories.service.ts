import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientCategoryDto } from './dto/create-ingredient-category.dto';
import { UpdateIngredientCategoryDto } from './dto/update-ingredient-category.dto';

@Injectable()
export class IngredientCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.ingredientCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { ingredients: true } } },
    });
  }

  async create(tenantId: string, dto: CreateIngredientCategoryDto) {
    try {
      return await this.prisma.ingredientCategory.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una categoría de ingredientes con ese nombre.');
      }
      throw error;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateIngredientCategoryDto) {
    const category = await this.prisma.ingredientCategory.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoría de ingredientes no encontrada.');

    try {
      return await this.prisma.ingredientCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description.trim() || null }),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una categoría de ingredientes con ese nombre.');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    const result = await this.prisma.ingredientCategory.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) throw new NotFoundException('Categoría de ingredientes no encontrada.');
    return { success: true };
  }
}
