import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, OrderItem, OrderItemStatus, Prisma } from '@prisma/client';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'kitchen',
})
export class KitchenService {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async getActiveOrders() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: ['IN_PROGRESS', 'READY'],
        },
      },
      include: {
        table: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateOrderItemStatus(
    itemId: string,
    status: OrderItemStatus,
  ): Promise<OrderItem> {
    const updatedItem = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status },
      include: {
        order: {
          include: {
            table: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    // Emit real-time update
    this.server.emit('orderItemUpdated', updatedItem);

    // Check if all items are ready and update order status accordingly
    if (status === 'READY') {
      const allItems = await this.prisma.orderItem.findMany({
        where: { orderId: updatedItem.order.id },
      });

      const allReady = allItems.every((item) => item.status === 'READY');
      if (allReady) {
        const updatedOrder = await this.prisma.order.update({
          where: { id: updatedItem.order.id },
          data: { status: 'READY' },
          include: {
            table: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });
        this.server.emit('orderUpdated', updatedOrder);
      }
    }

    return updatedItem;
  }

  async printKitchenTicket(orderId: string): Promise<void> {
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
      throw new Error('Order not found');
    }

    // TODO: Implement printer integration
    // This is a placeholder for the printing functionality
    console.log('Printing kitchen ticket for order:', order);
  }
} 