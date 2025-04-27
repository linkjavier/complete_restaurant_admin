import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Order } from '@prisma/client';

@Injectable()
export class OrdersQueue {
  constructor(
    @InjectQueue('orders') private ordersQueue: Queue,
  ) {}

  async addOrderProcessingJob(order: Order) {
    // Add the order to the queue with a unique job id
    await this.ordersQueue.add(
      'processOrder', 
      { orderId: order.id }, 
      { 
        jobId: `order-${order.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds
        },
      }
    );
  }
} 