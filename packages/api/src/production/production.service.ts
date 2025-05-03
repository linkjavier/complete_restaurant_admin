import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  async produceProduct(productId: string, quantity: number) {
    // Check if product exists and is active
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    if (!product.isActive) {
      throw new HttpException(
        'Product is not active',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (quantity <= 0) {
      throw new HttpException(
        'Quantity must be greater than 0',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Calculate required ingredients
    const requiredIngredients = product.ingredients.map((pi) => ({
      ingredientId: pi.ingredient.id,
      requiredQuantity: pi.quantity * quantity,
      currentQuantity: pi.ingredient.quantity,
      name: pi.ingredient.name,
    }));

    // Check if we have enough stock of all ingredients
    const missingIngredients = requiredIngredients.filter(
      (ri) => ri.currentQuantity < ri.requiredQuantity,
    );

    if (missingIngredients.length > 0) {
      throw new HttpException(
        {
          message: 'Insufficient ingredients',
          missing: missingIngredients.map((mi) => ({
            name: mi.name,
            required: mi.requiredQuantity,
            available: mi.currentQuantity,
          })),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Use a transaction to ensure atomicity
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Update ingredient quantities
        await Promise.all(
          requiredIngredients.map((ri) =>
            tx.$executeRaw`
              UPDATE "Ingredient"
              SET quantity = quantity - ${ri.requiredQuantity}
              WHERE id = ${ri.ingredientId}
            `
          )
        );

        // Update product stock
        const updatedProduct = await tx.$executeRaw`
          UPDATE "Product"
          SET quantity = quantity + ${quantity}
          WHERE id = ${productId}
          RETURNING *
        `;

        // Create production record
        const log = await tx.$executeRaw`
          INSERT INTO "ProductionLog" ("id", "productId", "quantity", "createdAt")
          VALUES (${Prisma.sql`gen_random_uuid()`}, ${productId}, ${quantity}, NOW())
          RETURNING *
        `;

        return {
          success: true,
          product: updatedProduct[0],
          log: log[0],
          ingredientsUpdated: requiredIngredients.length,
        };
      });

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new HttpException(
          'Database error during production process',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw error;
    }
  }
}