import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingRequestStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingEmissionError } from './billing.errors';
import { BillingCustomer, BillingInvoiceInput, EmitInvoiceCommand } from './billing.types';
import { BillingService } from './billing.service';

const POS_ORDER_INCLUDE = Prisma.validator<Prisma.OrderInclude>()({
  items: {
    include: {
      product: true,
      variants: { include: { productVariant: true } },
    },
  },
  payments: {
    where: { status: PaymentStatus.COMPLETED },
  },
});

export type PosOrder = Prisma.OrderGetPayload<{ include: typeof POS_ORDER_INCLUDE }>;

@Injectable()
export class PosBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async issueForOrders(
    tenantId: string,
    user: User,
    orderIds: string[],
    customer: BillingCustomer,
  ) {
    const orders = await this.loadOrders(tenantId, orderIds);
    if (orders.length !== 1 || orders[0].type === 'TABLE') {
      throw new BadRequestException('Issue table invoices from the table checkout flow.');
    }

    const [order] = orders;
    this.assertLocationAccess(user, tenantId, order.locationId);
    if (order.billingRequestStatus === BillingRequestStatus.DECLINED) {
      throw new ConflictException('Electronic billing was declined for this order.');
    }
    if (order.type === 'DELIVERY' && !order.isPaid) {
      if (!order.paymentMethod) {
        throw new BadRequestException('Select a payment method for the delivery invoice.');
      }
    } else if (!order.isPaid) {
      throw new BadRequestException('The order must be fully paid before issuing its invoice.');
    }

    const invoice = buildPosInvoice(orders, customer, order.type === 'DELIVERY' && !order.isPaid);
    const command = createCommand(tenantId, order.locationId, orders, invoice);
    try {
      const document = await this.billingService.issueInvoice(command);
      await this.markOrdersRequested(orders.map(({ id }) => id));
      return document;
    } catch (error) {
      if (error instanceof BillingEmissionError) {
        await this.markOrdersRequested(orders.map(({ id }) => id));
      }
      throw error;
    }
  }

  async issueForTable(
    tenantId: string,
    user: User,
    tableId: string,
    orderIds: string[],
    customer: BillingCustomer,
  ) {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId },
      select: { id: true, locationId: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found for this tenant.');
    }
    this.assertLocationAccess(user, tenantId, table.locationId);

    const orders = await this.loadOrders(tenantId, orderIds);
    if (
      orders.some(
        (order) =>
          order.tableId !== table.id ||
          order.locationId !== table.locationId ||
          order.type !== 'TABLE' ||
          order.status === OrderStatus.CANCELLED,
      )
    ) {
      throw new BadRequestException('All invoice orders must belong to this active table account.');
    }
    if (orders.some((order) => !order.isPaid)) {
      throw new BadRequestException('Pay all orders on the table before issuing its invoice.');
    }
    if (
      orders.some(
        (order) => order.billingRequestStatus === BillingRequestStatus.DECLINED,
      )
    ) {
      throw new ConflictException('An order was already declined for electronic billing.');
    }

    const invoice = buildPosInvoice(orders, customer, false);
    const command = createCommand(tenantId, table.locationId, orders, invoice);
    try {
      const document = await this.billingService.issueInvoice(command);
      await this.markOrdersRequested(orders.map(({ id }) => id));
      return document;
    } catch (error) {
      if (error instanceof BillingEmissionError) {
        await this.markOrdersRequested(orders.map(({ id }) => id));
      }
      throw error;
    }
  }

  async declineTableInvoice(
    tenantId: string,
    user: User,
    tableId: string,
    orderIds: string[],
  ): Promise<void> {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId },
      select: { id: true, locationId: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found for this tenant.');
    }
    this.assertLocationAccess(user, tenantId, table.locationId);

    const orders = await this.loadOrders(tenantId, orderIds);
    if (
      orders.some(
        (order) =>
          order.tableId !== table.id ||
          order.locationId !== table.locationId ||
          order.type !== 'TABLE' ||
          !order.isPaid ||
          order.status === OrderStatus.CANCELLED,
      )
    ) {
      throw new BadRequestException('Only fully paid orders from this table can be declined.');
    }

    await this.prisma.order.updateMany({
      where: {
        id: { in: orders.map(({ id }) => id) },
        tenantId,
        billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
      },
      data: { billingRequestStatus: BillingRequestStatus.DECLINED },
    });
  }

  async retryDocument(tenantId: string, user: User, billingDocumentId: string) {
    const document = await this.prisma.billingDocument.findFirst({
      where: { id: billingDocumentId, tenantId },
      select: { locationId: true },
    });
    if (!document) {
      throw new NotFoundException('Billing document not found for this tenant.');
    }
    this.assertLocationAccess(user, tenantId, document.locationId);
    return this.billingService.retryStoredInvoice(tenantId, billingDocumentId);
  }

  private async loadOrders(tenantId: string, orderIds: string[]): Promise<PosOrder[]> {
    const normalizedIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
    if (normalizedIds.length === 0 || normalizedIds.length > 100) {
      throw new BadRequestException('Provide between one and 100 valid order IDs.');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        id: { in: normalizedIds },
        tenantId,
        isDeleted: { not: true },
      },
      include: POS_ORDER_INCLUDE,
      orderBy: { id: 'asc' },
    });
    if (orders.length !== normalizedIds.length) {
      throw new NotFoundException('One or more orders were not found for this tenant.');
    }
    if (orders.some((order) => !order.locationId)) {
      throw new BadRequestException('Every order must have an assigned location.');
    }
    if (new Set(orders.map(({ locationId }) => locationId)).size !== 1) {
      throw new BadRequestException('Invoice orders must belong to one location.');
    }
    if (orders.some((order) => order.billingRequestStatus === BillingRequestStatus.REQUESTED)) {
      const alreadyLinked = await this.prisma.billingDocumentOrder.findMany({
        where: { orderId: { in: normalizedIds } },
        select: { orderId: true },
      });
      if (alreadyLinked.length !== normalizedIds.length) {
        throw new ConflictException('An invoice request for these orders is already in progress.');
      }
    }
    return orders;
  }

  private assertLocationAccess(user: User, tenantId: string, locationId: string | null): asserts locationId is string {
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('User does not belong to this tenant.');
    }
    if (!locationId) {
      throw new BadRequestException('Order location is required for billing.');
    }
    if (user.role !== UserRole.SUPER_ADMIN && user.locationId !== locationId) {
      throw new ForbiddenException("Billing is restricted to the user's assigned location.");
    }
  }

  private async markOrdersRequested(orderIds: string[]): Promise<void> {
    await this.prisma.order.updateMany({
      where: { id: { in: orderIds }, billingRequestStatus: BillingRequestStatus.NOT_REQUESTED },
      data: { billingRequestStatus: BillingRequestStatus.REQUESTED },
    });
  }
}

function createCommand(
  tenantId: string,
  locationId: string | null,
  orders: PosOrder[],
  invoice: BillingInvoiceInput,
): EmitInvoiceCommand {
  if (!locationId) {
    throw new BadRequestException('Order location is required for billing.');
  }
  const orderIds = orders.map(({ id }) => id).sort();
  return {
    tenantId,
    locationId,
    orderId: orderIds[0],
    orderIds,
    idempotencyKey: `pos-${createHash('sha256').update(orderIds.join('|')).digest('hex')}`,
    invoice,
  };
}

export function buildPosInvoice(
  orders: PosOrder[],
  customer: BillingCustomer,
  unpaidDelivery: boolean,
): BillingInvoiceInput {
  const items = orders.flatMap((order) => [
    ...order.items.map((item) => {
      const grossUnitPrice = item.price ?? item.product.price;
      const variantNames = item.variants
        .map(({ productVariant }) => productVariant.name)
        .join(', ');
      return {
        codeReference: item.product.code,
        name: variantNames ? `${item.product.name} (${variantNames})` : item.product.name,
        quantity: item.quantity.toFixed(2),
        unitPrice: (grossUnitPrice / 1.08).toFixed(2),
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: [{ code: '04', rate: '8.00' }],
      };
    }),
    ...(Number(order.deliveryFee ?? 0) > 0
      ? [
          {
            codeReference: `DELIVERY-${order.id}`,
            name: 'Servicio de domicilio',
            quantity: '1.00',
            unitPrice: (Number(order.deliveryFee) / 1.08).toFixed(2),
            unitMeasureCode: '94',
            standardCode: '999',
            taxes: [{ code: '04', rate: '8.00' }],
          },
        ]
      : []),
  ]);
  if (items.length === 0) {
    throw new BadRequestException('Cannot issue an invoice without order items.');
  }

  const orderTotal = roundMoney(
    orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
  );
  const calculatedGrossTotal = roundMoney(
    items.reduce(
      (sum, item) =>
        sum +
        roundMoney(Number(item.unitPrice) * Number(item.quantity) * 1.08),
      0,
    ),
  );
  if (Math.abs(orderTotal - calculatedGrossTotal) > 0.02) {
    throw new BadRequestException(
      'Invoice lines do not match the order total. Check POS prices and delivery fee before issuing.',
    );
  }

  const paymentDetails = unpaidDelivery
    ? [
        {
          paymentForm: '2',
          paymentMethodCode: factusPaymentMethod(
            orders[0].paymentMethod ?? PaymentMethod.CASH,
          ),
          amount: orderTotal.toFixed(2),
          dueDate: todayInBogota(),
        },
      ]
    : paidPaymentDetails(orders, orderTotal);

  return {
    customer,
    items,
    paymentDetails,
    observation: `POS order${orders.length > 1 ? 's' : ''}: ${orders
      .map(({ id }) => id)
      .join(', ')}`.slice(0, 500),
  };
}

function paidPaymentDetails(
  orders: PosOrder[],
  orderTotal: number,
): BillingInvoiceInput['paymentDetails'] {
  const totalsByMethod = new Map<PaymentMethod, number>();
  const paidTotal = orders.reduce(
    (sum, order) =>
      sum +
      order.payments.reduce((orderSum, payment) => {
        totalsByMethod.set(
          payment.method,
          (totalsByMethod.get(payment.method) ?? 0) + payment.amount,
        );
        return orderSum + payment.amount;
      }, 0),
    0,
  );
  if (Math.abs(roundMoney(paidTotal) - orderTotal) > 0.02) {
    throw new BadRequestException(
      'Completed payments do not match the invoice total; reconcile the order before billing.',
    );
  }

  return [...totalsByMethod.entries()].map(([method, amount]) => ({
    paymentForm: '1',
    paymentMethodCode: factusPaymentMethod(method),
    amount: roundMoney(amount).toFixed(2),
  }));
}

function factusPaymentMethod(method: PaymentMethod): string {
  const codes: Record<PaymentMethod, string> = {
    CASH: '10',
    TRANSFER: '47',
    CREDIT_CARD: '48',
    DEBIT_CARD: '49',
    QR: 'ZZZ',
  };
  return codes[method];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function todayInBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
