import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InsufficientStockError,
  StockSyncService,
} from '../../inventory/stock-sync.service';

@Injectable()
@Processor('inventory-updates')
export class InventoryProcessorService {
  private readonly logger = new Logger(InventoryProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private stockSync: StockSyncService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing inventory job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed inventory job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed inventory job ${job.id} of type ${job.name}: ${error.message}`, error.stack);
  }

  @Process({ name: 'updateInventoryForOrder', concurrency: 3 })
  async updateInventoryForOrder(job: Job<{ orderId: string }>) {
    try {
      const { orderId } = job.data;

      this.logger.log(`Updating inventory for order ${orderId}`);

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  ingredients: {
                    include: {
                      ingredient: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const inventoryUpdates = [];

      for (const item of order.items) {
        const { product, quantity } = item;

        if (!product.ingredients || product.ingredients.length === 0) {
          continue;
        }

        for (const productIngredient of product.ingredients) {
          const { ingredient, quantity: requiredQuantity } = productIngredient;
          const totalQuantityNeeded = requiredQuantity * quantity;
          const locationId = order.locationId ?? product.locationId ?? ingredient.locationId;

          if (!locationId) {
            this.logger.warn(
              `Skipping inventory update for ingredient ${ingredient.name}: no locationId on order or product`,
            );
            continue;
          }

          try {
            await this.prisma.$transaction(async (tx) => {
              const { previousQuantity, newQuantity } =
                await this.stockSync.deductSyncedStock(tx, {
                  ingredientId: ingredient.id,
                  locationId,
                  amount: totalQuantityNeeded,
                });

              inventoryUpdates.push({
                ingredientId: ingredient.id,
                ingredientName: ingredient.name,
                previousQuantity,
                newQuantity,
                amountDeducted: totalQuantityNeeded,
                productId: product.id,
                productName: product.name,
                orderId,
              });
            });
          } catch (error) {
            if (error instanceof InsufficientStockError) {
              this.logger.warn(
                `Insufficient inventory for ingredient ${error.detail.name}: ` +
                `needed ${error.detail.required}, available ${error.detail.available}`,
              );
              continue;
            }
            throw error;
          }
        }
      }

      this.logger.log(`Inventory updates for order ${orderId}: ${inventoryUpdates.length} items updated`);

      return {
        success: true,
        orderId,
        updatedIngredients: inventoryUpdates.length,
      };
    } catch (error) {
      this.logger.error(`Error updating inventory for order ${job.data.orderId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process({ name: 'checkLowInventory', concurrency: 1 })
  async checkLowInventory(job: Job<{ locationId: string }>) {
    try {
      const { locationId } = job.data;
      this.logger.log(`Running low inventory check for location ${locationId}`);

      const ingredients = await this.prisma.ingredient.findMany({
        where: { locationId },
      });

      const lowStockIngredients = ingredients.filter(
        (ing) => ing.quantity < ing.minQuantity,
      );

      const managers = await this.prisma.user.findMany({
        where: {
          locationId,
          role: { in: ['ADMIN', 'MANAGER'] },
        },
      });

      const items = [];

      for (const ingredient of lowStockIngredients) {
        const message =
          `LOW STOCK: ${ingredient.name} is below minimum threshold. ` +
          `Current: ${ingredient.quantity} ${ingredient.unit}, ` +
          `Minimum: ${ingredient.minQuantity} ${ingredient.unit}`;

        await Promise.all(
          managers.map((user) =>
            this.prisma.notification.create({
              data: {
                userId: user.id,
                type: NotificationType.LOW_STOCK,
                message,
              },
            }),
          ),
        );

        items.push({
          ingredientId: ingredient.id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          minQuantity: ingredient.minQuantity,
        });
      }

      this.logger.log(
        `Low inventory check for location ${locationId}: ${lowStockIngredients.length} items below minimum`,
      );

      return {
        success: true,
        lowInventoryCount: lowStockIngredients.length,
        items,
      };
    } catch (error) {
      this.logger.error(`Error checking low inventory: ${error.message}`, error.stack);
      throw error;
    }
  }
}
