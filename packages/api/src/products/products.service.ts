import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Product } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(private prisma: PrismaService) {}

  async create(data: any): Promise<Product> {
    try {
      this.logger.debug(`Creating product with data: ${JSON.stringify(data)}`);
      const { ingredients, variantGroups, ...productData } = data;
      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear el producto base
        const product = await tx.product.create({
          data: productData,
          include: { category: true },
        });
        // 2. Ingredientes
        if (ingredients && ingredients.length > 0) {
          for (const ingredient of ingredients) {
            await tx.productIngredient.create({
              data: {
                productId: product.id,
                ingredientId: ingredient.ingredientId,
                quantity: ingredient.quantity
              }
            });
          }
        }
        // 3. Grupos de variantes y variantes
        if (variantGroups && variantGroups.length > 0) {
          for (const group of variantGroups) {
            const groupRecord = await tx.productVariantGroup.create({
              data: {
                name: group.name,
                order: group.order ?? 0,
                productId: product.id,
              },
            });
            if (group.variants && group.variants.length > 0) {
              for (const variant of group.variants) {
                await tx.productVariant.create({
                  data: {
                    name: variant.name,
                    price: variant.price,
                    image: variant.image,
                    isActive: variant.isActive !== undefined ? variant.isActive : true,
                    groupId: groupRecord.id,
                    productId: product.id,
                  },
                });
              }
            }
          }
        }
        // 4. Obtener el producto completo con ingredientes y grupos/variantes
        return await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            ingredients: { include: { ingredient: true } },
            variantGroups: {
              include: {
                variants: true
              },
              orderBy: { order: 'asc' }
            },
          },
        });
      });
    } catch (error) {
      this.logger.error(`Error creating product: ${error.message}`);
      this.logger.error(error.stack);
      throw new InternalServerErrorException(`Error creating product: ${error.message}`);
    }
  }

  async findAll({ locationId, categoryId, search }: { locationId: string; categoryId?: string; search?: string; }) {
    try {
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
          variantGroups: {
            include: { variants: true },
            orderBy: { order: 'asc' }
          },
          ingredients: { include: { ingredient: true } },
        },
      });
    } catch (error) {
      this.logger.error(`Error finding products: ${error.message}`);
      throw new InternalServerErrorException(`Error finding products: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Product | null> {
    try {
      return this.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          ingredients: { include: { ingredient: true } },
          variantGroups: {
            include: { variants: true },
            orderBy: { order: 'asc' }
          },
        },
      });
    } catch (error) {
      this.logger.error(`Error finding product ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error finding product: ${error.message}`);
    }
  }

  async update(id: string, data: any): Promise<Product> {
    try {
      const { ingredients, variantGroups, categoryId, locationId, ...productData } = data;
      if (categoryId) productData.category = { connect: { id: categoryId } };
      if (locationId) productData.location = { connect: { id: locationId } };
      return await this.prisma.$transaction(async (tx) => {
        // 1. Actualizar el producto
        const product = await tx.product.update({ where: { id }, data: productData });
        // 2. Ingredientes
        if (ingredients) {
          await tx.productIngredient.deleteMany({ where: { productId: id } });
          for (const ingredient of ingredients) {
            await tx.productIngredient.create({
              data: {
                productId: product.id,
                ingredientId: ingredient.ingredientId,
                quantity: ingredient.quantity
              }
            });
          }
        }
        // 3. Grupos de variantes y variantes
        if (variantGroups) {
          // Eliminar grupos y variantes existentes
          const oldGroups = await tx.productVariantGroup.findMany({ where: { productId: id } });
          for (const group of oldGroups) {
            await tx.productVariant.deleteMany({ where: { groupId: group.id } });
          }
          await tx.productVariantGroup.deleteMany({ where: { productId: id } });
          // Crear nuevos grupos y variantes
          for (const group of variantGroups) {
            const groupRecord = await tx.productVariantGroup.create({
              data: {
                name: group.name,
                order: group.order ?? 0,
                productId: product.id,
              },
            });
            if (group.variants && group.variants.length > 0) {
              for (const variant of group.variants) {
                await tx.productVariant.create({
                  data: {
                    name: variant.name,
                    price: variant.price,
                    image: variant.image,
                    isActive: variant.isActive !== undefined ? variant.isActive : true,
                    groupId: groupRecord.id,
                    productId: product.id,
                  },
                });
              }
            }
          }
        }
        // 4. Obtener el producto actualizado
        return await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            ingredients: { include: { ingredient: true } },
            variantGroups: {
              include: { variants: true },
              orderBy: { order: 'asc' }
            },
          },
        });
      });
    } catch (error) {
      this.logger.error(`Error updating product ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error updating product: ${error.message}`);
    }
  }

  async remove(id: string): Promise<Product> {
    try {
      // Obtener el producto antes de eliminarlo
      const product = await this.findOne(id);
      
      if (!product) {
        throw new Error(`Product with id ${id} not found`);
      }
      
      // Transacción para eliminar el producto y sus relaciones
      await this.prisma.$transaction(async (tx) => {
        // 1. Eliminar las relaciones de ingredientes
        await tx.productIngredient.deleteMany({
          where: {
            productId: id
          }
        });
        
        // 2. Eliminar las relaciones de variantes
        await tx.productVariant.deleteMany({
          where: {
            productId: id
          }
        });
        
        // 3. Eliminar el producto
        await tx.product.delete({
          where: { id },
        });
      });
      
      return product;
    } catch (error) {
      this.logger.error(`Error removing product ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error removing product: ${error.message}`);
    }
  }
}