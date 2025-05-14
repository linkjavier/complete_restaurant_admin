import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Payment, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'payments',
})
export class PaymentsService {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto) {
    return this.prisma.payment.create({
      data: createPaymentDto,
      include: {
        order: true,
      },
    });
  }

  async getOrderPaymentDetails(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: {
          where: {
            status: PaymentStatus.COMPLETED,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    const paidAmount = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    const remainingBalance = totalAmount - paidAmount;

    return {
      orderId,
      orderStatus: order.status,
      totalAmount,
      paidAmount,
      remainingBalance,
      isFullyPaid: remainingBalance <= 0,
      payments: order.payments,
    };
  }

  async processPayment(
    orderId: string,
    amount: number,
    method: PaymentMethod,
  ): Promise<Payment> {
    // Validar la orden
    const paymentDetails = await this.getOrderPaymentDetails(orderId);

    // Validar el monto
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (amount > paymentDetails.remainingBalance) {
      throw new BadRequestException('Payment amount exceeds remaining balance');
    }

    // Crear el pago
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount,
        method,
        status: PaymentStatus.COMPLETED,
      },
      include: {
        order: true,
      },
    });

    // Si el pago completa el total, actualizar el estado de la orden
    if (paymentDetails.remainingBalance - amount === 0) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
        },
      });
    }

    // Emitir evento de pago procesado
    this.server.emit('paymentProcessed', {
      orderId,
      payment,
      remainingBalance: paymentDetails.remainingBalance - amount,
    });

    return payment;
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
    });
  }
}