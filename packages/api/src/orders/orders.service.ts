import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

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

  async createOrder(data: Prisma.OrderCreateInput): Promise<Order> {
    return this.prisma.order.create({
      data,
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

  async updateOrder(params: {
    where: Prisma.OrderWhereUniqueInput;
    data: Prisma.OrderUpdateInput;
  }): Promise<Order> {
    const { where, data } = params;
    return this.prisma.order.update({
      data,
      where,
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

  async deleteOrder(where: Prisma.OrderWhereUniqueInput): Promise<Order> {
    return this.prisma.order.delete({
      where,
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
} 