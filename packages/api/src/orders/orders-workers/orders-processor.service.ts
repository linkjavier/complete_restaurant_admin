import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@Processor('orders')
export class OrdersProcessorService {
  private readonly logger = new Logger(OrdersProcessorService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name} with data: ${JSON.stringify(job.data)}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed job ${job.id} of type ${job.name} with result: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}: ${error.message}`, error.stack);
  }

  @Process({ name: 'processOrder', concurrency: 5 })
  async processOrder(job: Job<{ orderId: string }>) {
    try {
      const { orderId } = job.data;
      
      this.logger.log(`Processing order ${orderId}`);
      
      // 1. Get the order with all necessary details
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          table: true,
          location: true,
        },
      });
      
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      // 2. Update order status to IN_PROGRESS if it's PENDING
      if (order.status === 'PENDING') {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'IN_PROGRESS' },
        });
        
        this.logger.log(`Updated order ${orderId} status to IN_PROGRESS`);
      }
      
      // Track processing time
      const startTime = Date.now();
      
      // 3. For each item, update its details or perform any necessary calculations
      // This is a simplified example - add any business logic needed for orders
      await Promise.all(order.items.map(async (item) => {
        // Example: calculate tax, update pricing, etc.
        this.logger.log(`Processing item ${item.id} of product ${item.product.name}`);
        
        // You could update item details here if needed
        if (item.status === 'PENDING') {
          await this.prisma.orderItem.update({
            where: { id: item.id },
            data: { status: 'IN_PROGRESS' },
          });
        }
      }));
      
      const processingTime = Date.now() - startTime;
      this.logger.log(`Order ${orderId} processing completed in ${processingTime}ms`);
      
      return {
        success: true,
        orderId,
        processingTime,
        message: 'Order processed successfully',
      };
    } catch (error) {
      this.logger.error(`Error processing order ${job.data.orderId}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 