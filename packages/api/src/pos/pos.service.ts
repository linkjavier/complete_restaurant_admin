import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, Payment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface SplitPaymentDto {
  orderId: string;
  payments: {
    amount: number;
    method: PaymentMethod;
  }[];
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'pos',
})
export class PosService {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async getActiveOrders(tableId?: string) {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED'],
        },
        ...(tableId && { tableId }),
      },
      include: {
        table: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getActiveWaiterCalls() {
    return this.prisma.notification.findMany({
      where: {
        type: 'WAITER_CALL',
        read: false,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getOrderDetails(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Calculate total amount and remaining balance
    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    const paidAmount = order.payments.reduce(
      (sum, payment) => 
        payment.status === 'COMPLETED' ? sum + payment.amount : sum,
      0,
    );

    return {
      ...order,
      totalAmount,
      paidAmount,
      remainingBalance: totalAmount - paidAmount,
    };
  }

  async processPayment(
    orderId: string,
    amount: number,
    method: PaymentMethod,
  ): Promise<Payment> {
    const orderDetails = await this.getOrderDetails(orderId);

    if (amount > orderDetails.remainingBalance) {
      throw new BadRequestException('Payment amount exceeds remaining balance');
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount,
        method,
        status: PaymentStatus.COMPLETED,
      },
    });

    // Check if order is fully paid
    if (orderDetails.remainingBalance - amount === 0) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { isPaid: true },
      });
    }

    // Emit payment update
    this.server.emit('paymentProcessed', {
      orderId,
      payment,
      remainingBalance: orderDetails.remainingBalance - amount,
    });

    return payment;
  }

  async processSplitPayment(data: SplitPaymentDto): Promise<Payment[]> {
    const orderDetails = await this.getOrderDetails(data.orderId);

    // Validate total split amount matches remaining balance
    const totalSplitAmount = data.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    if (totalSplitAmount !== orderDetails.remainingBalance) {
      throw new BadRequestException(
        'Total split amount must equal remaining balance',
      );
    }

    // Process each payment
    const payments = await Promise.all(
      data.payments.map((payment) =>
        this.processPayment(
          data.orderId,
          payment.amount,
          payment.method,
        ),
      ),
    );

    return payments;
  }

  async markWaiterCallAsResolved(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    this.server.emit('waiterCallResolved', { notificationId });
  }
} 