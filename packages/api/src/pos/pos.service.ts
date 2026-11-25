import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingRequestStatus,
  Order,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PosShiftService } from './pos-shift.service';

interface SplitPaymentDto {
  orderId: string;
  payments: {
    amount: number;
    method: PaymentMethod;
  }[];
}

export interface TableSettlementAllocation {
  orderItemId: string;
  quantity: number;
}

export interface TableSettlementParticipant {
  label: string;
  method: PaymentMethod;
  allocations: TableSettlementAllocation[];
  invoiceChoice?: 'ELECTRONIC' | 'RECEIPT';
}

export type TableSettlementRequest =
  | { mode: 'FULL'; method: PaymentMethod }
  | { mode: 'SPLIT'; participants: TableSettlementParticipant[] };

function readPaymentAllocations(value: Prisma.JsonValue | null): TableSettlementAllocation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const orderItemId = entry.orderItemId;
    const quantity = entry.quantity;
    return typeof orderItemId === 'string' &&
      typeof quantity === 'number' &&
      Number.isInteger(quantity) &&
      quantity > 0
      ? [{ orderItemId, quantity }]
      : [];
  });
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

  constructor(
    private prisma: PrismaService,
    private posShiftService: PosShiftService,
  ) {}

  async getActiveOrders(tableId?: string) {
    const table = tableId
      ? await this.prisma.table.findUnique({
          where: { id: tableId },
          select: { lastAccountClosedAt: true },
        })
      : null;

    return this.prisma.order.findMany({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED'],
        },
        isDeleted: { not: true },
        ...(tableId && { tableId }),
        ...(table?.lastAccountClosedAt ? { createdAt: { gt: table.lastAccountClosedAt } } : {}),
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
    const totalAmount =
      order.total ??
      order.items.reduce(
        (sum, item) => sum + (item.price ?? item.product.price) * item.quantity,
        Number(order.deliveryFee ?? 0),
      );

    const paidAmount = order.payments.reduce(
      (sum, payment) => (payment.status === 'COMPLETED' ? sum + payment.amount : sum),
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
    tenantId: string,
  ): Promise<Payment> {
    const orderDetails = await this.getOrderDetails(orderId);
    if (orderDetails.tenantId !== tenantId) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    if (!orderDetails.locationId) {
      throw new BadRequestException('The order has no assigned location.');
    }
    const shift = await this.posShiftService.requireOpenShift(tenantId, orderDetails.locationId);
    if (amount > orderDetails.remainingBalance) {
      throw new BadRequestException('Payment amount exceeds remaining balance');
    }
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount,
        method,
        status: PaymentStatus.COMPLETED,
        tenantId,
        shiftId: shift.id,
      },
    });
    if (orderDetails.remainingBalance - amount === 0) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { isPaid: true },
      });
    }
    this.server.emit('paymentProcessed', {
      orderId,
      payment,
      remainingBalance: orderDetails.remainingBalance - amount,
    });
    return payment;
  }

  async processSplitPayment(data: SplitPaymentDto, tenantId: string): Promise<Payment[]> {
    const orderDetails = await this.getOrderDetails(data.orderId);

    // Validate total split amount matches remaining balance
    const totalSplitAmount = data.payments.reduce((sum, payment) => sum + payment.amount, 0);

    if (totalSplitAmount !== orderDetails.remainingBalance) {
      throw new BadRequestException('Total split amount must equal remaining balance');
    }

    // Process each payment
    const payments = await Promise.all(
      data.payments.map((payment) =>
        this.processPayment(data.orderId, payment.amount, payment.method, tenantId),
      ),
    );

    return payments;
  }

  async settleTableAccount(
    tenantId: string,
    user: User,
    tableId: string,
    request: TableSettlementRequest,
  ) {
    if (!tableId?.trim()) {
      throw new BadRequestException('Selecciona una mesa antes de cobrar la cuenta.');
    }
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId },
      select: { id: true, locationId: true, lastAccountClosedAt: true },
    });
    if (!table) {
      throw new NotFoundException('No se encontró la mesa para este negocio.');
    }
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('El usuario no pertenece a este negocio.');
    }
    if (user.role !== UserRole.SUPER_ADMIN && user.locationId !== table.locationId) {
      throw new ForbiddenException('La mesa no corresponde a la sede del usuario.');
    }

    const shift = await this.posShiftService.requireOpenShift(tenantId, table.locationId);
    const result = await this.prisma.$transaction(
      async (transaction) => {
        const currentTable = await transaction.table.findFirst({
          where: { id: tableId, tenantId },
          select: { id: true, locationId: true, lastAccountClosedAt: true },
        });
        if (!currentTable || currentTable.locationId !== table.locationId) {
          throw new ConflictException('La mesa cambió mientras se preparaba el cobro.');
        }
        const activeShift = await transaction.tableShift.findFirst({
          where: {
            id: shift.id,
            tenantId,
            locationId: currentTable.locationId,
            endedAt: null,
          },
          select: { id: true },
        });
        if (!activeShift) {
          throw new ConflictException(
            'El turno se cerró. Actualiza la cuenta e inténtalo nuevamente.',
          );
        }

        const orders = await transaction.order.findMany({
          where: {
            tenantId,
            tableId,
            type: 'TABLE',
            isDeleted: { not: true },
            status: { not: 'CANCELLED' },
            ...(currentTable.lastAccountClosedAt
              ? { createdAt: { gt: currentTable.lastAccountClosedAt } }
              : {}),
          },
          include: {
            items: { include: { product: true } },
            payments: { where: { status: PaymentStatus.COMPLETED } },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (orders.length === 0) {
          throw new BadRequestException('La mesa no tiene órdenes pendientes de cobro.');
        }

        const orderTotal = (order: (typeof orders)[number]) =>
          order.total ??
          order.items.reduce(
            (sum, item) => sum + (item.price ?? item.product.price) * item.quantity,
            Number(order.deliveryFee ?? 0),
          );
        const paidAmount = (order: (typeof orders)[number]) =>
          order.payments.reduce((sum, payment) => sum + payment.amount, 0);

        const createdPayments: Payment[] = [];
        if (request?.mode === 'FULL') {
          if (
            orders.some((order) =>
              order.payments.some(
                (payment) => readPaymentAllocations(payment.allocations).length > 0,
              ),
            )
          ) {
            throw new BadRequestException(
              'This account has individual diner payments. Assign remaining products to a diner instead of combining them into a table invoice.',
            );
          }
          if (!Object.values(PaymentMethod).includes(request.method)) {
            throw new BadRequestException('Selecciona un método de pago válido.');
          }
          for (const order of orders) {
            const remaining = roundMoney(orderTotal(order) - paidAmount(order));
            if (remaining <= 0) {
              if (!order.isPaid) {
                await transaction.order.update({
                  where: { id: order.id },
                  data: { isPaid: true },
                });
              }
              continue;
            }
            const payment = await transaction.payment.create({
              data: {
                tenantId,
                orderId: order.id,
                amount: remaining,
                method: request.method,
                status: PaymentStatus.COMPLETED,
                shiftId: activeShift.id,
                payerLabel: 'Cuenta completa',
              },
            });
            createdPayments.push(payment);
            await transaction.order.update({
              where: { id: order.id },
              data: { isPaid: true },
            });
          }
          if (createdPayments.length === 0) {
            throw new BadRequestException('Todas las órdenes de esta cuenta ya están pagadas.');
          }
        } else if (request?.mode === 'SPLIT') {
          if (!Array.isArray(request.participants) || request.participants.length === 0) {
            throw new BadRequestException('Agrega al menos un comensal con productos asignados.');
          }

          const ordersById = new Map(orders.map((order) => [order.id, order]));
          const itemsById = new Map(
            orders.flatMap((order) =>
              order.items.map((item) => [item.id, { order, item }] as const),
            ),
          );
          const requestedAllocated = new Map<string, number>();
          const participantOrderAmounts = new Map<
            string,
            {
              label: string;
              method: PaymentMethod;
              orderId: string;
              payerGroupId: string;
              billingRequestStatus: BillingRequestStatus;
              amount: number;
              allocations: TableSettlementAllocation[];
            }
          >();

          for (const [participantIndex, participant] of request.participants.entries()) {
            if (!participant || typeof participant !== 'object') {
              throw new BadRequestException('Hay una cuenta de comensal no válida.');
            }
            const label = typeof participant.label === 'string' ? participant.label.trim() : '';
            if (!label || label.length > 50) {
              throw new BadRequestException(
                'Cada comensal debe tener un nombre o número de hasta 50 caracteres.',
              );
            }
            if (!Object.values(PaymentMethod).includes(participant.method)) {
              throw new BadRequestException(`Selecciona un método de pago válido para ${label}.`);
            }
            if (
              participant.invoiceChoice !== undefined &&
              participant.invoiceChoice !== 'ELECTRONIC' &&
              participant.invoiceChoice !== 'RECEIPT'
            ) {
              throw new BadRequestException(`Selecciona un comprobante válido para ${label}.`);
            }
            if (!Array.isArray(participant.allocations) || participant.allocations.length === 0) {
              throw new BadRequestException(`Asigna al menos un producto a ${label}.`);
            }

            const payerGroupId = randomUUID();
            const billingRequestStatus =
              participant.invoiceChoice === 'RECEIPT'
                ? BillingRequestStatus.DECLINED
                : BillingRequestStatus.NOT_REQUESTED;
            const seenForParticipant = new Set<string>();
            for (const allocation of participant.allocations) {
              if (
                !allocation ||
                typeof allocation !== 'object' ||
                !allocation.orderItemId ||
                !Number.isInteger(allocation.quantity) ||
                allocation.quantity <= 0
              ) {
                throw new BadRequestException(`La cantidad asignada a ${label} no es válida.`);
              }
              if (seenForParticipant.has(allocation.orderItemId)) {
                throw new BadRequestException(
                  `Hay un producto duplicado en la cuenta de ${label}.`,
                );
              }
              seenForParticipant.add(allocation.orderItemId);

              const entry = itemsById.get(allocation.orderItemId);
              if (!entry) {
                throw new BadRequestException(
                  'Un producto ya no pertenece a la cuenta actual de esta mesa.',
                );
              }
              const { order, item } = entry;
              if (order.isPaid) {
                throw new BadRequestException(`La orden #${order.id.slice(0, 8)} ya está pagada.`);
              }
              if (
                order.payments.some(
                  (payment) =>
                    !Array.isArray(payment.allocations) ||
                    readPaymentAllocations(payment.allocations).length === 0,
                )
              ) {
                throw new BadRequestException(
                  `La orden #${order.id.slice(0, 8)} tiene un pago anterior sin productos detallados. Liquida ese saldo desde su historial antes de dividirla.`,
                );
              }

              const previousQuantity = order.payments
                .flatMap((payment) => readPaymentAllocations(payment.allocations))
                .filter((entry) => entry.orderItemId === item.id)
                .reduce((sum, entry) => sum + entry.quantity, 0);
              const requestedQuantity =
                (requestedAllocated.get(item.id) ?? 0) + allocation.quantity;
              if (previousQuantity + requestedQuantity > item.quantity) {
                throw new BadRequestException(
                  `${item.product.name} ya tiene todas sus unidades asignadas o pagadas.`,
                );
              }
              requestedAllocated.set(item.id, requestedQuantity);

              const unitPrice = item.price ?? item.product.price;
              const amount = roundMoney(unitPrice * allocation.quantity);
              if (!Number.isFinite(amount) || amount <= 0) {
                throw new BadRequestException(
                  'No se pueden cobrar productos con un valor no válido.',
                );
              }
              const key = `${participantIndex}:${order.id}`;
              const group = participantOrderAmounts.get(key) ?? {
                label,
                method: participant.method,
                orderId: order.id,
                payerGroupId,
                billingRequestStatus,
                amount: 0,
                allocations: [],
              };
              group.amount = roundMoney(group.amount + amount);
              group.allocations.push(allocation);
              participantOrderAmounts.set(key, group);
            }
          }

          const allocatedAmountByOrder = new Map<string, number>();
          for (const group of participantOrderAmounts.values()) {
            allocatedAmountByOrder.set(
              group.orderId,
              roundMoney((allocatedAmountByOrder.get(group.orderId) ?? 0) + group.amount),
            );
          }
          for (const [orderId, amount] of allocatedAmountByOrder) {
            const order = ordersById.get(orderId);
            if (!order) continue;
            const remaining = roundMoney(orderTotal(order) - paidAmount(order));
            if (amount > remaining + 0.01) {
              throw new BadRequestException(
                `Los productos asignados superan el saldo de la orden #${order.id.slice(0, 8)}.`,
              );
            }
          }

          for (const group of participantOrderAmounts.values()) {
            const allocations: Prisma.InputJsonValue = group.allocations.map(
              ({ orderItemId, quantity }) => ({ orderItemId, quantity }),
            );
            const payment = await transaction.payment.create({
              data: {
                tenantId,
                orderId: group.orderId,
                amount: group.amount,
                method: group.method,
                status: PaymentStatus.COMPLETED,
                shiftId: activeShift.id,
                payerLabel: group.label,
                payerGroupId: group.payerGroupId,
                billingRequestStatus: group.billingRequestStatus,
                allocations,
              },
            });
            createdPayments.push(payment);
          }

          for (const [orderId, amount] of allocatedAmountByOrder) {
            const order = ordersById.get(orderId);
            if (order && paidAmount(order) + amount >= orderTotal(order) - 0.01) {
              await transaction.order.update({
                where: { id: orderId },
                data: { isPaid: true },
              });
            }
          }
        } else {
          throw new BadRequestException('El tipo de cobro de la cuenta no es válido.');
        }

        return {
          payments: createdPayments,
          total: roundMoney(createdPayments.reduce((sum, payment) => sum + payment.amount, 0)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    for (const payment of result.payments) {
      this.server?.emit('paymentProcessed', {
        orderId: payment.orderId,
        payment,
      });
    }
    return result;
  }

  async markWaiterCallAsResolved(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    this.server.emit('waiterCallResolved', { notificationId });
  }
}
