import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InsufficientStockError,
  StockSyncService,
} from '../inventory/stock-sync.service';

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private stockSync: StockSyncService,
  ) {}

  async produceProduct(
    productId: string,
    quantity: number,
    tenantId: string,
    wasteQuantity = 0,
    wasteNotes?: string,
  ) {
    if (quantity <= 0) {
      throw new HttpException(
        'Quantity must be greater than 0',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (wasteQuantity < 0) {
      throw new HttpException(
        'wasteQuantity must be non-negative',
        HttpStatus.BAD_REQUEST,
      );
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
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

    const requiredIngredients = product.ingredients.map((pi) => ({
      ingredientId: pi.ingredient.id,
      requiredQuantity: pi.quantity * quantity,
      name: pi.ingredient.name,
    }));

    try {
      return await this.prisma.$transaction(async (tx) => {
        for (const ri of requiredIngredients) {
          try {
            await this.stockSync.deductSyncedStock(tx, {
              ingredientId: ri.ingredientId,
              locationId: product.locationId,
              amount: ri.requiredQuantity,
            });
          } catch (error) {
            if (error instanceof InsufficientStockError) {
              throw new HttpException(
                {
                  message: 'Insufficient ingredients',
                  missing: [error.detail],
                },
                HttpStatus.BAD_REQUEST,
              );
            }
            throw error;
          }
        }

        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { quantity: { increment: quantity } },
        });

        const log = await tx.productionLog.create({
          data: {
            productId,
            quantity,
            wasteQuantity,
            wasteNotes: wasteNotes ?? null,
          },
        });

        return {
          success: true,
          product: updatedProduct,
          log,
          ingredientsUpdated: requiredIngredients.length,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Database error during production process',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
