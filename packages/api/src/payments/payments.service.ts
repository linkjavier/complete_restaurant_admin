import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Payment, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PosShiftService } from '../pos/pos-shift.service';

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

  constructor(
    private prisma: PrismaService,
    private posShiftService: PosShiftService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto & { tenantId: string }) {
    const { tenantId, orderId, ...rest } = createPaymentDto;
    return this.prisma.payment.create({
      data: {
        ...rest,
        order: { connect: { id: orderId } },
        tenant: { connect: { id: tenantId } },
      },
      include: {
        order: true,
      },
    });
  }

  async getOrderPaymentDetails(orderId: string, tenantId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, ...(tenantId ? { tenantId } : {}) },
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

    const totalAmount =
      order.total ??
      order.items.reduce(
        (sum, item) => sum + (item.price ?? item.product.price) * item.quantity,
        Number(order.deliveryFee ?? 0),
      );

    const paidAmount = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    const remainingBalance = totalAmount - paidAmount;

    return {
      orderId,
      locationId: order.locationId,
      source: order.source,
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
    tenantId: string,
  ): Promise<Payment> {
    // Validar la orden
    const paymentDetails = await this.getOrderPaymentDetails(orderId, tenantId);
    if (!paymentDetails.locationId) {
      throw new BadRequestException('The order has no assigned location.');
    }
    const shift =
      paymentDetails.source === 'POS'
        ? await this.posShiftService.requireOpenShift(
            tenantId,
            paymentDetails.locationId,
          )
        : null;

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
        order: { connect: { id: orderId } },
        amount,
        method,
        status: PaymentStatus.COMPLETED,
        tenant: { connect: { id: tenantId } },
        ...(shift ? { shift: { connect: { id: shift.id } } } : {}),
      },
      include: {
        order: true,
      },
    });

    // Si el pago completa el total, actualizar el flag isPaid
    if (paymentDetails.remainingBalance - amount === 0) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          isPaid: true,
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