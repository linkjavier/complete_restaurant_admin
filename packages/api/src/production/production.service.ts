import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
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

  async findProductionHistory(tenantId: string, locationId?: string) {
    return this.prisma.productionLog.findMany({
      where: {
        product: {
          tenantId,
          isIntermediate: true,
          locationId,
        },
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            locationId: true,
            location: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async produceProduct(
    productId: string,
    quantity: number,
    tenantId: string,
    createdById: string,
    allowedLocationId?: string,
    wasteQuantity = 0,
    wasteNotes?: string,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new HttpException(
        'Quantity must be greater than 0',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!Number.isFinite(wasteQuantity) || wasteQuantity < 0) {
      throw new HttpException(
        'wasteQuantity must be non-negative',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: {
            id: productId,
            tenantId,
            isActive: true,
            isIntermediate: true,
            locationId: allowedLocationId,
          },
          include: {
            ingredients: { include: { ingredient: true } },
            components: { include: { component: true } },
          },
        });

        if (!product) {
          throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
        }

        if (!product.ingredients.length && !product.components.length) {
          throw new BadRequestException(
            'Configure at least one ingredient or intermediate product in this recipe before producing it',
          );
        }

        const batchQuantity = quantity + wasteQuantity;
        const consumedIngredients = [];
        const consumedProducts = [];

        for (const recipeIngredient of product.ingredients) {
          const amount = recipeIngredient.quantity * batchQuantity;
          await this.stockSync.deductSyncedStock(tx, {
            ingredientId: recipeIngredient.ingredientId,
            locationId: product.locationId,
            amount,
          });
          consumedIngredients.push({
            id: recipeIngredient.ingredientId,
            code: recipeIngredient.ingredient.code,
            name: recipeIngredient.ingredient.name,
            unit: recipeIngredient.ingredient.unit,
            quantity: amount,
          });
        }

        for (const recipeComponent of product.components) {
          const amount = recipeComponent.quantity * batchQuantity;
          await this.stockSync.deductProductStock(tx, {
            productId: recipeComponent.componentId,
            locationId: product.locationId,
            amount,
          });
          consumedProducts.push({
            id: recipeComponent.componentId,
            code: recipeComponent.component.code,
            name: recipeComponent.component.name,
            unit: recipeComponent.component.unit,
            quantity: amount,
          });
        }

        const updated = await tx.product.updateMany({
          where: {
            id: product.id,
            tenantId,
            locationId: product.locationId,
            isIntermediate: true,
            isActive: true,
          },
          data: { quantity: { increment: quantity } },
        });
        if (updated.count !== 1) {
          throw new HttpException(
            'Product changed while production was being recorded',
            HttpStatus.CONFLICT,
          );
        }

        const updatedProduct = await tx.product.findUniqueOrThrow({
          where: { id: product.id },
        });
        const log = await tx.productionLog.create({
          data: {
            productId,
            productCode: product.code,
            productName: product.name,
            productUnit: product.unit,
            createdById,
            quantity,
            wasteQuantity,
            wasteNotes: wasteNotes?.trim() || null,
            consumedMaterials: [
              ...consumedIngredients.map((item) => ({
                id: item.id,
                code: item.code,
                name: item.name,
                unit: item.unit,
                quantity: item.quantity,
                type: 'INGREDIENT',
              })),
              ...consumedProducts.map((item) => ({
                id: item.id,
                code: item.code,
                name: item.name,
                unit: item.unit,
                quantity: item.quantity,
                type: 'PRODUCT',
              })),
            ],
          },
        });

        return {
          success: true,
          product: updatedProduct,
          log,
          consumedIngredients,
          consumedProducts,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof InsufficientStockError) {
        throw new BadRequestException({
          message: 'Insumos insuficientes para registrar la producción',
          missing: [error.detail],
        });
      }
      throw new HttpException(
        'Database error during production process',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
