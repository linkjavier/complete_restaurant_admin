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
      
      // Extraer los ingredientes antes de crear el producto
      const { ingredients, ...productData } = data;
      
      // Transacción para asegurar que todo se crea correctamente
      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear el producto base
        const product = await tx.product.create({
          data: productData,
          include: {
            category: true,
          },
        });
        
        this.logger.debug(`Created product with ID: ${product.id}`);
        
        // 2. Si hay ingredientes, crearlos uno por uno
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
          this.logger.debug(`Added ${ingredients.length} ingredients to product`);
        }
        
        // 3. Obtener el producto completo con ingredientes
        return await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            ingredients: {
              include: {
                ingredient: true,
              },
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

  async findAll({
    locationId,
    categoryId,
    search,
  }: {
    locationId: string;
    categoryId?: string;
    search?: string;
  }) {
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
          ingredients: {
            include: {
              ingredient: true,
            },
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
      const { ingredients, ...productData } = data;
      
      // Transacción para asegurar que todo se actualiza correctamente
      return await this.prisma.$transaction(async (tx) => {
        // 1. Actualizar el producto
        const product = await tx.product.update({
          where: { id },
          data: productData,
        });
        
        // 2. Si hay ingredientes, actualizar las relaciones
        if (ingredients) {
          // Eliminar las relaciones existentes
          await tx.productIngredient.deleteMany({
            where: {
              productId: id
            }
          });
          
          // Crear las nuevas relaciones
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
        
        // 3. Obtener el producto actualizado con todos los datos
        return await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            ingredients: {
              include: {
                ingredient: true,
              },
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
        
        // 2. Eliminar el producto
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