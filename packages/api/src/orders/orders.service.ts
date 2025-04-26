import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, Prisma } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from '../websocket/order.gateway';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderGateway))
    private orderGateway: OrderGateway,
  ) {}

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
          },
        },
        payments: true,
      },
    });
  }

  async create(createOrderDto: CreateOrderDto) {
    const order = await this.prisma.order.create({
      data: {
        ...createOrderDto,
        items: {
          create: createOrderDto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            status: 'PENDING',
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
    });

    await this.orderGateway.notifyOrderUpdate(order.id, order.locationId);
    return order;
  }

  async findAll(locationId?: string) {
    return this.prisma.order.findMany({
      where: locationId ? { locationId } : undefined,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
    });

    await this.orderGateway.notifyOrderUpdate(id, order.locationId);
    return updatedOrder;
  }

  async updateItemStatus(orderId: string, itemId: string, status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED') {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const item = order.items.find(item => item.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found in order ${orderId}`);
    }

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status },
    });

    await this.orderGateway.notifyItemStatusUpdate(orderId, itemId, order.locationId);
    return this.findOne(orderId);
  }

  async remove(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.prisma.order.delete({
      where: { id },
    });
  }
} 