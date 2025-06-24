import { Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, Prisma } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersGateway } from './orders.gateway';
import { OrdersQueueService } from './orders-workers/orders-queue.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrdersGateway))
    private ordersGateway: OrdersGateway,
    private ordersQueueService: OrdersQueueService,
    private productsService: ProductsService,
  ) {
    // Log to verify gateway is injected
    this.logger.log(`OrdersService initialized with OrdersGateway: ${!!this.ordersGateway}`);
    this.logger.log(`OrdersGateway methods available: ${Object.keys(this.ordersGateway || {}).join(', ')}`);
  }

  async order(
    orderWhereUniqueInput: Prisma.OrderWhereUniqueInput,
  ): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: orderWhereUniqueInput,
      include: {
        table: true,
        location: true,
        user: true,
        items: {
          include: {
            product: true,
            variants: {
              include: {
                productVariant: true,
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  async orders(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.OrderWhereUniqueInput;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.OrderOrderByWithRelationInput;
  }): Promise<Order[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.order.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        table: true,
        location: true,
        user: true,
        items: {
          include: {
            product: true,
            variants: {
              include: {
                productVariant: true,
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      this.logger.log(`Creating order from DTO: ${JSON.stringify(createOrderDto)}`);
      
      const { userId, items, ...orderData } = createOrderDto;

      const orderCreateData: any = {
        ...orderData,
        status: orderData.status || 'PENDING',
        isPaid: orderData.isPaid || false,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            status: 'PENDING',
            variants: {
              create: item.variants?.map(variant => ({
                productVariantId: variant.productVariantId,
                groupName: variant.groupName || null,
              })) || []
            },
          })),
        }
      };

      if (userId) {
        orderCreateData.user = {
          connect: { id: userId }
        };
      }

      const order = await this.prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: orderCreateData,
          include: {
            items: {
              include: {
                product: true,
                variants: {
                  include: {
                    productVariant: true,
                  },
                },
              },
            },
            table: true,
            location: true,
            user: true,
            payments: true,
          },
        });
        this.logger.log(`Order created with ID: ${newOrder.id}`);
        return newOrder;
      });

      // Emit WebSocket event para actualizaciones en tiempo real
      if (order.locationId) {
        try {
          this.logger.log(`Emitting new order event for order ${order.id} to location ${order.locationId}`);
          this.ordersGateway.emitNewOrder(order, order.locationId);
          this.logger.log(`Successfully emitted new order event`);
        } catch (wsError) {
          this.logger.error(
            `WebSocket event emission failed for order ${order.id}: ${wsError.message}`, 
            wsError.stack
          );
        }
      } else {
        this.logger.warn(`No locationId for order ${order.id}, skipping WebSocket notification`);
      }
      
      // Queue background processing jobs only if status is PENDING
      if (order.status === 'PENDING') {
        await this.ordersQueueService.addOrderProcessingJob(order);
        this.logger.log(`Background processing jobs queued for order ${order.id}`);
      }
      
      return order;
    } catch (error) {
      this.logger.error(`Error creating order: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(locationId?: string, tableId?: string, kitchen?: boolean) {
    const where: Prisma.OrderWhereInput = {};

    if (locationId) {
      where.locationId = locationId;
    }

    if (tableId) {
      where.tableId = tableId;
    }

    if (kitchen) {
      where.items = {
        some: {
          status: {
            in: ['PENDING', 'IN_PROGRESS', 'READY', 'CANCELLED', 'DELIVERED']
          }
        }
      };
    }

    return this.prisma.order.findMany({
      where,
      include: {
        table: true,
        location: true,
        user: true,
        items: {
          include: {
            product: true,
            variants: {
              include: {
                productVariant: true,
              },
            },
          },
        },
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
              variants: {
                include: {
                  productVariant: true,
                },
              },
            },
          },
          table: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order with ID ${id} not found`);
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      return order;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error finding order ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          location: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order with ID ${id} not found for update`);
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: updateOrderDto,
        include: {
          items: {
            include: {
              product: true,
              variants: {
                include: {
                  productVariant: true,
                },
              },
            },
          },
          table: true,
          location: true,
        },
      });

      // Emit WebSocket event for real-time kitchen updates
      if (updatedOrder.locationId) {
        this.ordersGateway.emitOrderUpdated(updatedOrder, updatedOrder.locationId);
        this.logger.log(`WebSocket event emitted for updated order ${id}`);
      }
      
      return updatedOrder;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error updating order ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateItemStatus(orderId: string, itemId: string, status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED') {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
              variants: {
                include: {
                  productVariant: true,
                },
              },
            },
          },
          location: true,
        },
      });

      // El resultado de order.findUnique puede ser null o no incluir 'items' si no se especifica el include correctamente.
      // Aseguramos que 'items' está incluido y tipado correctamente.
      if (!order || !('items' in order) || !Array.isArray(order.items)) {
        this.logger.warn(`Order with ID ${orderId} not found for item status update, or items not present`);
        throw new NotFoundException(`Order with ID ${orderId} not found or items missing`);
      }

      const item = order.items.find(item => item.id === itemId);
      if (!item) {
        this.logger.warn(`Item with ID ${itemId} not found in order ${orderId}`);
        throw new NotFoundException(`Item with ID ${itemId} not found in order ${orderId}`);
      }

      const updatedItem = await this.prisma.orderItem.update({
        where: { id: itemId },
        data: { status },
        include: {
          product: true,
          order: true,
        },
      });

      // Emit WebSocket event for real-time kitchen updates
      if (order.locationId) {
        this.ordersGateway.emitOrderItemUpdated(
          { item: updatedItem, order },
          order.locationId
        );
        this.logger.log(`WebSocket event emitted for updated item ${itemId} in order ${orderId}`);
        
        // Queue notifications for status changes if needed
        await this.ordersQueueService.addOrderItemStatusChangeJob(updatedItem, order);
      }
      
      return this.findOne(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error updating item status for order ${orderId}, item ${itemId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          location: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order with ID ${id} not found for deletion`);
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const deletedOrder = await this.prisma.order.delete({
        where: { id },
      });
      
      this.logger.log(`Order ${id} deleted successfully`);
      return deletedOrder;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error removing order ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}