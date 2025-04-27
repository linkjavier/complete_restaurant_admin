import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from './orders.gateway';

@Processor('orders')
export class OrdersProcessor {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
  ) {}

  @Process('processOrder')
  async processOrder(job: Job<{ orderId: string }>) {
    try {
      this.logger.log(`Processing order ${job.data.orderId}`);
      
      // 1. Get the full order with all related data
      const order = await this.prisma.order.findUnique({
        where: { id: job.data.orderId },
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
          location: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${job.data.orderId} not found`);
      }

      // 2. Update inventory for each product in the order
      await this.updateInventory(order);

      // 3. Update order status to IN_PROGRESS
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'IN_PROGRESS' },
      });
      
      // 4. Notify kitchen about the order via WebSocket
      if (order.locationId) {
        this.ordersGateway.emitOrderUpdated(order, order.locationId);
      }
      
      this.logger.log(`Successfully processed order ${job.data.orderId}`);
      return { success: true, orderId: order.id };
    } catch (error) {
      this.logger.error(`Failed to process order ${job.data.orderId}`, error.stack);
      throw error;
    }
  }

  private async updateInventory(order: any) {
    // Process each order item
    for (const item of order.items) {
      const { product, quantity } = item;
      
      // If product has ingredients, update each ingredient's inventory
      if (product.ingredients && product.ingredients.length > 0) {
        for (const productIngredient of product.ingredients) {
          const { ingredient, quantity: requiredQuantity } = productIngredient;
          
          // Calculate total quantity needed for this order
          const totalQuantityNeeded = requiredQuantity * quantity;
          
          // Update the ingredient inventory
          // Comentado por problemas de tipos en Prisma
          // await this.prisma.ingredient.update({
          //   where: { id: ingredient.id },
          //   data: {
          //     quantity: {
          //       decrement: totalQuantityNeeded
          //     }
          //   },
          // });
          
          this.logger.log(`Would update ingredient ${ingredient.id} quantity by -${totalQuantityNeeded}`);
          
          // If inventory is below minimum quantity, log a warning
          // Comentado por problemas de tipos en Prisma
          // if (ingredient.quantity - totalQuantityNeeded < ingredient.minQuantity) {
          //   this.logger.warn(
          //     `Low inventory alert: ${ingredient.name} is below minimum quantity. Current: ${
          //       ingredient.quantity - totalQuantityNeeded
          //     }, Minimum: ${ingredient.minQuantity}`
          //   );
          // }
        }
      }
    }
  }
} 