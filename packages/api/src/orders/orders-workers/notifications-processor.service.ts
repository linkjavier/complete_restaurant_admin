import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@Processor('notifications')
export class NotificationsProcessorService {
  private readonly logger = new Logger(NotificationsProcessorService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing notification job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed notification job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed notification job ${job.id} of type ${job.name}: ${error.message}`, error.stack);
  }

  @Process({ name: 'sendOrderNotification', concurrency: 10 })
  async sendOrderNotification(job: Job<{ 
    orderId: string;
    type: 'NEW' | 'UPDATED' | 'COMPLETED' | 'CANCELLED';
    locationId: string;
  }>) {
    try {
      const { orderId, type, locationId } = job.data;
      
      this.logger.log(`Sending ${type} notification for order ${orderId} in location ${locationId}`);
      
      // 1. Get order details if needed
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          table: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
      
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      // 2. Find staff to notify based on their role and location
      const staffToNotify = await this.prisma.user.findMany({
        where: {
          locationId,
          role: {
            in: this._getRelevantRolesForNotification(type),
          },
        },
      });
      
      if (staffToNotify.length === 0) {
        this.logger.warn(`No staff found to notify about order ${orderId} in location ${locationId}`);
        return {
          success: false,
          message: 'No staff found to notify',
        };
      }
      
      // 3. Construct the notification message
      const message = this._constructNotificationMessage(type, order);
      
      // 4. Send notification to each staff member
      // This is a mock implementation - in a real system you would:
      // - Send emails
      // - Send mobile push notifications
      // - Send in-app notifications
      // - Etc.
      const notificationResults = staffToNotify.map(staff => ({
        userId: staff.id,
        email: staff.email,
        success: true, // Mock success
      }));
      
      this.logger.log(`Sent ${type} notifications to ${notificationResults.length} staff members for order ${orderId}`);
      
      return {
        success: true,
        orderId,
        type,
        recipients: notificationResults.length,
      };
    } catch (error) {
      this.logger.error(`Error sending notification for order ${job.data.orderId}: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  @Process({ name: 'sendLowInventoryAlert', concurrency: 5 })
  async sendLowInventoryAlert(job: Job<{ 
    ingredientId: string;
    locationId: string;
    currentQuantity: number;
    minQuantity: number;
  }>) {
    try {
      const { ingredientId, locationId, currentQuantity, minQuantity } = job.data;
      
      this.logger.log(`Sending low inventory alert for ingredient ${ingredientId} in location ${locationId}`);
      
      // 1. Get ingredient details
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { id: ingredientId },
        // include: {
        //   location: true,
        // },
      });
      
      if (!ingredient) {
        throw new Error(`Ingredient ${ingredientId} not found`);
      }
      
      // 2. Find managers and admins to notify
      const staffToNotify = await this.prisma.user.findMany({
        where: {
          locationId,
          role: {
            in: ['ADMIN', 'MANAGER'],
          },
        },
      });
      
      if (staffToNotify.length === 0) {
        this.logger.warn(`No staff found to notify about low inventory for ingredient ${ingredientId}`);
        return {
          success: false,
          message: 'No staff found to notify',
        };
      }
      
      // 3. Construct the alert message
      const message = `LOW INVENTORY ALERT: ${ingredient.name} is below minimum threshold. Current: ${currentQuantity} ${ingredient.unit}, Minimum: ${minQuantity} ${ingredient.unit}`;
      
      // 4. Send alert to each staff member (mock implementation)
      const alertResults = staffToNotify.map(staff => ({
        userId: staff.id,
        email: staff.email,
        success: true, // Mock success
      }));
      
      this.logger.log(`Sent low inventory alerts to ${alertResults.length} staff members for ingredient ${ingredientId}`);
      
      return {
        success: true,
        ingredientId,
        recipients: alertResults.length,
        message,
      };
    } catch (error) {
      this.logger.error(`Error sending low inventory alert for ingredient ${job.data.ingredientId}: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  // Helper methods
  
  private _getRelevantRolesForNotification(type: string): any[] {
    switch (type) {
      case 'NEW':
        return ['ADMIN', 'MANAGER', 'CHEF'];
      case 'UPDATED':
        return ['ADMIN', 'MANAGER', 'CHEF'];
      case 'COMPLETED':
        return ['ADMIN', 'MANAGER', 'WAITER'];
      case 'CANCELLED':
        return ['ADMIN', 'MANAGER', 'CHEF', 'WAITER'];
      default:
        return ['ADMIN', 'MANAGER'];
    }
  }
  
  private _constructNotificationMessage(type: string, order: any): string {
    const tableInfo = order.table ? `Table #${order.table.number}` : 'No table';
    const itemCount = order.items.length;
    
    switch (type) {
      case 'NEW':
        return `NEW ORDER: Order #${order.id.substring(0, 8)} from ${tableInfo} with ${itemCount} items`;
      case 'UPDATED':
        return `ORDER UPDATED: Order #${order.id.substring(0, 8)} from ${tableInfo} has been updated`;
      case 'COMPLETED':
        return `ORDER COMPLETED: Order #${order.id.substring(0, 8)} from ${tableInfo} is ready to serve`;
      case 'CANCELLED':
        return `ORDER CANCELLED: Order #${order.id.substring(0, 8)} from ${tableInfo} has been cancelled`;
      default:
        return `ORDER NOTIFICATION: Order #${order.id.substring(0, 8)} from ${tableInfo}`;
    }
  }
} 