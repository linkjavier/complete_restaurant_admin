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
                  components: {
                    include: {
                      component: true,
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

      const inventoryUpdates: Array<Record<string, string | number>> = [];

      for (const item of order.items) {
        const { product, quantity } = item;
        const recipeIngredients = product.ingredients ?? [];
        const recipeComponents = product.components ?? [];
        if (recipeIngredients.length === 0 && recipeComponents.length === 0) {
          continue;
        }

        const locationId = order.locationId ?? product.locationId;
        if (!locationId) {
          this.logger.warn(
            `Skipping inventory update for product ${product.name}: no locationId on order or product`,
          );
          continue;
        }

        try {
          const itemUpdates = await this.prisma.$transaction(async (tx) => {
            const updates: Array<Record<string, string | number>> = [];
            for (const recipeIngredient of recipeIngredients) {
              const { ingredient, quantity: requiredQuantity } = recipeIngredient;
              const amount = requiredQuantity * quantity;
              const { previousQuantity, newQuantity } =
                await this.stockSync.deductSyncedStock(tx, {
                  ingredientId: ingredient.id,
                  locationId,
                  amount,
                });
              updates.push({
                ingredientId: ingredient.id,
                ingredientName: ingredient.name,
                previousQuantity,
                newQuantity,
                amountDeducted: amount,
                productId: product.id,
                productName: product.name,
                orderId,
              });
            }

            for (const recipeComponent of recipeComponents) {
              const { component } = recipeComponent;
              const amount = recipeComponent.quantity * quantity;
              const { previousQuantity, newQuantity } =
                await this.stockSync.deductProductStock(tx, {
                  productId: component.id,
                  locationId,
                  amount,
                });
              updates.push({
                productId: component.id,
                productName: component.name,
                previousQuantity,
                newQuantity,
                amountDeducted: amount,
                soldProductId: product.id,
                soldProductName: product.name,
                orderId,
              });
            }
            return updates;
          });
          inventoryUpdates.push(...itemUpdates);
        } catch (error) {
          if (error instanceof InsufficientStockError) {
            this.logger.warn(
              `Insufficient inventory for ${error.detail.name}: ` +
              `needed ${error.detail.required}, available ${error.detail.available}`,
            );
            continue;
          }
          throw error;
        }
      }

      this.logger.log(`Inventory updates for order ${orderId}: ${inventoryUpdates.length} items updated`);

      return {
        success: true,
        orderId,
        updatedIngredients: inventoryUpdates.filter(
          (update) => 'ingredientId' in update,
        ).length,
        updatedProducts: inventoryUpdates.filter(
          (update) => 'soldProductId' in update,
        ).length,
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
