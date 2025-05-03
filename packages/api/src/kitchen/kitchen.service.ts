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
          in: ['PENDING', 'IN_PROGRESS'],
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
    console.log(`KitchenService: Updating item ${itemId} to status ${status}`);
    
    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener el item actual para verificar que existe
      const currentItem = await tx.orderItem.findUnique({
        where: { id: itemId },
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

      if (!currentItem) {
        throw new Error(`Item ${itemId} not found`);
      }

      // 2. Actualizar el item
      const updatedItem = await tx.orderItem.update({
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

      // 3. Emitir evento de item actualizado inmediatamente
      this.server.emit('order_item_updated', {
        item: updatedItem,
        order: updatedItem.order,
      });

      // 4. Si el estado es READY (antes era COMPLETED), verificar si todos los items están listos
      if (status === 'READY') {
        const allItems = await tx.orderItem.findMany({
          where: { orderId: updatedItem.order.id },
        });

        const allReady = allItems.every((item) => item.status === 'READY');

        if (allReady) {
          const updatedOrder = await tx.order.update({
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

          this.server.emit('order_updated', updatedOrder);
        }
      }

      // 5. Si el estado cambió a PENDING, actualizar el estado de la orden si es necesario
      if (status === 'PENDING') {
        const order = updatedItem.order;
        const orderHasInProgressItems = order.items.some(item => item.status === 'IN_PROGRESS');
        
        if (!orderHasInProgressItems) {
          const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: { status: 'PENDING' },
            include: {
              table: true,
              items: {
                include: {
                  product: true,
                },
              },
            },
          });
          
          this.server.emit('order_updated', updatedOrder);
        }
      }

      return updatedItem;
    });
  }

  async printKitchenTicket(orderId: string): Promise<void> {
    console.log(`Printing kitchen ticket for order ${orderId}`);
  }
}