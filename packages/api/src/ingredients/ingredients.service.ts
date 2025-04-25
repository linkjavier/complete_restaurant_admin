import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Ingredient as IngredientModel, Prisma } from '@prisma/client';

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async createIngredient(data: Prisma.IngredientCreateInput): Promise<IngredientModel> {
    return this.prisma.ingredient.create({
      data,
      include: {
        location: true,
      },
    });
  }

  async ingredients(params: {
    skip?: number;
    take?: number;
    where?: Prisma.IngredientWhereInput;
    orderBy?: Prisma.IngredientOrderByWithRelationInput;
  }): Promise<IngredientModel[]> {
    const { skip, take, where, orderBy } = params;
    return this.prisma.ingredient.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        location: true,
      },
    });
  }

  async ingredient(where: Prisma.IngredientWhereUniqueInput): Promise<IngredientModel | null> {
    return this.prisma.ingredient.findUnique({
      where,
      include: {
        location: true,
      },
    });
  }

  async updateIngredient(params: {
    where: Prisma.IngredientWhereUniqueInput;
    data: Prisma.IngredientUpdateInput;
  }): Promise<IngredientModel> {
    const { where, data } = params;
    return this.prisma.ingredient.update({
      where,
      data,
      include: {
        location: true,
      },
    });
  }

  async deleteIngredient(where: Prisma.IngredientWhereUniqueInput): Promise<IngredientModel> {
    return this.prisma.ingredient.delete({
      where,
      include: {
        location: true,
      },
    });
  }
} 