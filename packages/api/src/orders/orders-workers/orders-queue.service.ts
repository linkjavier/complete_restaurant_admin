import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Order, OrderItem } from '@prisma/client';

@Injectable()
export class OrdersQueueService {
  private readonly logger = new Logger(OrdersQueueService.name);

  constructor(
    @InjectQueue('orders') private ordersQueue: Queue,
    @InjectQueue('inventory-updates') private inventoryQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  async addOrderProcessingJob(order: Order) {
    try {
      this.logger.log(`Adding order ${order.id} to processing queue`);
      
      // Add to the main orders queue with high priority
      const orderJob = await this.ordersQueue.add(
        'processOrder', 
        { orderId: order.id }, 
        { 
          jobId: `order-${order.id}`,
          priority: 1, // Highest priority (lower number = higher priority)
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds initial delay, then 10s, 20s, etc.
          },
          removeOnComplete: true,
          removeOnFail: false,
          timeout: 30000, // 30 seconds timeout
        }
      );
      
      this.logger.log(`Order ${order.id} added to processing queue with job ID ${orderJob.id}`);
      
      // Also add to inventory updates queue
      const inventoryJob = await this.inventoryQueue.add(
        'updateInventoryForOrder',
        { orderId: order.id },
        {
          jobId: `inventory-${order.id}`,
          priority: 2, // Medium priority
          attempts: 5, // More attempts for inventory updates
          backoff: {
            type: 'exponential',
            delay: 2000, // 2 seconds
          },
          timeout: 60000, // 60 seconds timeout
          // Only process after the main order job completes
          delay: 1000, // Small delay to ensure order processing starts first
        }
      );
      
      this.logger.log(`Inventory update job added for order ${order.id} with job ID ${inventoryJob.id}`);
      
      // Send notifications about the new order
      if (order.locationId) {
        const notificationJob = await this.notificationsQueue.add(
          'sendOrderNotification',
          {
            orderId: order.id,
            type: 'NEW',
            locationId: order.locationId,
          },
          {
            jobId: `notify-new-${order.id}`,
            priority: 3, // Lower priority
            attempts: 3,
            backoff: {
              type: 'fixed',
              delay: 3000, // 3 seconds
            },
            timeout: 10000, // 10 seconds timeout
          }
        );
        
        this.logger.log(`Notification job added for new order ${order.id} with job ID ${notificationJob.id}`);
      }
      
      return {
        success: true,
        orderJobId: orderJob.id,
        inventoryJobId: inventoryJob.id,
      };
    } catch (error) {
      this.logger.error(`Error adding order ${order.id} to processing queue: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async addOrderItemStatusChangeJob(item: OrderItem, order: Order) {
    try {
      this.logger.log(`Adding status change notification for order item ${item.id}`);
      
      // Only send notifications for certain status changes
      if (['READY', 'DELIVERED', 'CANCELLED'].includes(item.status) && order.locationId) {
        const notificationType = item.status === 'READY' ? 'COMPLETED' : item.status;
        
        const notificationJob = await this.notificationsQueue.add(
          'sendOrderNotification',
          {
            orderId: order.id,
            type: notificationType as any,
            locationId: order.locationId,
          },
          {
            jobId: `notify-${item.status.toLowerCase()}-${item.id}`,
            priority: 3,
            attempts: 3,
            backoff: {
              type: 'fixed',
              delay: 2000,
            },
            timeout: 10000,
          }
        );
        
        this.logger.log(`Notification job added for order item ${item.id} status change to ${item.status}`);
        return {
          success: true,
          notificationJobId: notificationJob.id,
        };
      }
      
      return { success: true, message: 'No notification needed for this status change' };
    } catch (error) {
      this.logger.error(`Error adding order item status change job: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async addLowInventoryAlertJob(ingredientId: string, locationId: string, currentQuantity: number, minQuantity: number) {
    try {
      this.logger.log(`Adding low inventory alert for ingredient ${ingredientId}`);
      
      const alertJob = await this.notificationsQueue.add(
        'sendLowInventoryAlert',
        {
          ingredientId,
          locationId,
          currentQuantity,
          minQuantity,
        },
        {
          jobId: `low-inventory-${ingredientId}-${Date.now()}`,
          priority: 2, // Medium priority for inventory alerts
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 3000,
          },
          timeout: 10000,
        }
      );
      
      this.logger.log(`Low inventory alert job added for ingredient ${ingredientId} with job ID ${alertJob.id}`);
      return {
        success: true,
        alertJobId: alertJob.id,
      };
    } catch (error) {
      this.logger.error(`Error adding low inventory alert job: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async scheduleInventoryCheck(locationId: string) {
    try {
      this.logger.log(`Scheduling inventory check for location ${locationId}`);
      
      const checkJob = await this.inventoryQueue.add(
        'checkLowInventory',
        { locationId },
        {
          jobId: `inventory-check-${locationId}-${Date.now()}`,
          priority: 4, // Lowest priority
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 2000,
          },
          timeout: 30000,
        }
      );
      
      this.logger.log(`Inventory check job scheduled for location ${locationId} with job ID ${checkJob.id}`);
      return {
        success: true,
        checkJobId: checkJob.id,
      };
    } catch (error) {
      this.logger.error(`Error scheduling inventory check: ${error.message}`, error.stack);
      throw error;
    }
  }
} 