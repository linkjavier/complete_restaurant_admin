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

const POS_PAYMENT_INCLUDE = Prisma.validator<Prisma.PaymentInclude>()({
  order: {
    include: {
      items: {
        include: {
          product: true,
          variants: { include: { productVariant: true } },
        },
      },
    },
  },
});

type PosPayment = Prisma.PaymentGetPayload<{
  include: typeof POS_PAYMENT_INCLUDE;
}>;

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
    if (orders.some(hasItemizedPayments)) {
      throw new ConflictException(
        'This table account contains individual diner payments. Issue invoices from each payment instead of invoicing the whole table again.',
      );
    }
    if (orders.some((order) => order.billingRequestStatus === BillingRequestStatus.DECLINED)) {
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

  async issueForTablePayments(
    tenantId: string,
    user: User,
    tableId: string,
    paymentIds: string[],
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

    const payments = await this.loadTablePayments(tenantId, table, paymentIds);
    const payerGroupId = payments[0]?.payerGroupId;
    const payerLabel = payments[0]?.payerLabel?.trim();
    if (
      !payerLabel ||
      payments.some(
        (payment) =>
          payment.payerLabel?.trim() !== payerLabel ||
          payment.method !== payments[0].method ||
          (payerGroupId ? payment.payerGroupId !== payerGroupId : Boolean(payment.payerGroupId)),
      )
    ) {
      throw new BadRequestException('Invoice payments must belong to the same table guest.');
    }
    if (
      payments.some((payment) => payment.billingRequestStatus === BillingRequestStatus.DECLINED)
    ) {
      throw new ConflictException(
        'Electronic billing was declined for one or more of these payments.',
      );
    }
    if (payments.some((payment) => !readInvoiceAllocations(payment.allocations).length)) {
      throw new BadRequestException(
        'Only itemized guest payments can receive an individual table invoice.',
      );
    }
    if (
      payments.some(
        (payment) =>
          payment.billingDocumentId && payment.billingDocumentId !== payments[0].billingDocumentId,
      )
    ) {
      throw new ConflictException('These payments already belong to different billing documents.');
    }

    const invoice = buildSplitPaymentInvoice(payments, customer);
    const orderIds = [...new Set(payments.map(({ orderId }) => orderId))].sort();
    const sortedPaymentIds = payments.map(({ id }) => id).sort();
    const idempotencyKey = `pos-split-${createHash('sha256')
      .update(sortedPaymentIds.join('|'))
      .digest('hex')}`;
    const command: EmitInvoiceCommand = {
      tenantId,
      locationId: table.locationId,
      orderId: orderIds[0],
      orderIds,
      paymentIds: sortedPaymentIds,
      idempotencyKey,
      invoice,
    };

    const linkedDocumentId = payments[0].billingDocumentId;
    if (payments.some((payment) => payment.billingDocumentId !== linkedDocumentId)) {
      throw new ConflictException(
        'These guest payments are already attached to different billing documents.',
      );
    }
    if (linkedDocumentId) {
      if (
        payments.some((payment) => payment.billingRequestStatus !== BillingRequestStatus.REQUESTED)
      ) {
        throw new ConflictException(
          'Guest payment billing states are inconsistent; reconcile them before retrying.',
        );
      }
      return this.billingService.issueInvoice(command);
    }
    if (
      payments.some(
        (payment) => payment.billingRequestStatus !== BillingRequestStatus.NOT_REQUESTED,
      )
    ) {
      throw new ConflictException(
        'A billing decision has already been recorded for one or more of these payments.',
      );
    }
    await this.claimPaymentsForBilling(sortedPaymentIds);

    try {
      const document = await this.billingService.issueInvoice(command);
      await this.markPaymentsRequested(sortedPaymentIds, document.id);
      return document;
    } catch (error) {
      if (error instanceof BillingEmissionError) {
        await this.markPaymentsRequested(sortedPaymentIds, error.billingDocumentId);
      } else {
        await this.releasePaymentBillingClaim(sortedPaymentIds);
      }
      throw error;
    }
  }

  async declineTablePaymentInvoice(
    tenantId: string,
    user: User,
    tableId: string,
    paymentIds: string[],
  ): Promise<void> {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId },
      select: { id: true, locationId: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found for this tenant.');
    }
    this.assertLocationAccess(user, tenantId, table.locationId);

    const payments = await this.loadTablePayments(tenantId, table, paymentIds);
    if (
      payments.some(
        (payment) =>
          !payment.payerLabel?.trim() || !readInvoiceAllocations(payment.allocations).length,
      )
    ) {
      throw new BadRequestException(
        'Only itemized guest payments can be declined for individual billing.',
      );
    }
    if (
      payments.some(
        (payment) =>
          payment.payerLabel?.trim() !== payments[0].payerLabel?.trim() ||
          payment.method !== payments[0].method ||
          (payments[0].payerGroupId
            ? payment.payerGroupId !== payments[0].payerGroupId
            : Boolean(payment.payerGroupId)),
      )
    ) {
      throw new BadRequestException(
        'Receipt decisions must be made for one table guest at a time.',
      );
    }
    if (
      payments.every((payment) => payment.billingRequestStatus === BillingRequestStatus.DECLINED)
    ) {
      return;
    }
    if (
      payments.some(
        (payment) => payment.billingRequestStatus !== BillingRequestStatus.NOT_REQUESTED,
      )
    ) {
      throw new ConflictException(
        'An electronic invoice request already exists for one or more of these payments.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.payment.updateMany({
        where: {
          id: { in: payments.map(({ id }) => id) },
          tenantId,
          status: PaymentStatus.COMPLETED,
          billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
          billingDocumentId: null,
        },
        data: { billingRequestStatus: BillingRequestStatus.DECLINED },
      });
      if (result.count !== payments.length) {
        throw new ConflictException(
          'A billing decision changed while recording this guest receipt.',
        );
      }
    });
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
    if (orders.some(hasItemizedPayments)) {
      throw new ConflictException(
        'This table account has individual diner payments; decide billing separately for each payment.',
      );
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

  async refreshDocument(tenantId: string, user: User, billingDocumentId: string) {
    const document = await this.prisma.billingDocument.findFirst({
      where: { id: billingDocumentId, tenantId },
      select: { locationId: true },
    });
    if (!document) {
      throw new NotFoundException('Billing document not found for this tenant.');
    }
    this.assertLocationAccess(user, tenantId, document.locationId);
    return this.billingService.refreshInvoiceStatus(tenantId, billingDocumentId);
  }

  private async loadTablePayments(
    tenantId: string,
    table: { id: string; locationId: string },
    paymentIds: string[],
  ): Promise<PosPayment[]> {
    const normalizedIds = [...new Set(paymentIds.map((id) => id.trim()).filter(Boolean))];
    if (normalizedIds.length === 0 || normalizedIds.length > 100) {
      throw new BadRequestException('Provide between one and 100 valid payment IDs.');
    }

    const payments = await this.prisma.payment.findMany({
      where: { id: { in: normalizedIds }, tenantId },
      include: POS_PAYMENT_INCLUDE,
      orderBy: { id: 'asc' },
    });
    if (payments.length !== normalizedIds.length) {
      throw new NotFoundException('One or more payments were not found for this tenant.');
    }
    if (
      payments.some(
        (payment) =>
          payment.status !== PaymentStatus.COMPLETED ||
          payment.order.type !== 'TABLE' ||
          payment.order.tableId !== table.id ||
          payment.order.locationId !== table.locationId ||
          payment.order.status === OrderStatus.CANCELLED ||
          payment.order.isDeleted === true,
      )
    ) {
      throw new BadRequestException(
        'All payments must be completed table payments from this location.',
      );
    }
    return payments;
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

  private assertLocationAccess(
    user: User,
    tenantId: string,
    locationId: string | null,
  ): asserts locationId is string {
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

  private async markPaymentsRequested(
    paymentIds: string[],
    billingDocumentId: string,
  ): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: { in: paymentIds },
        billingRequestStatus: BillingRequestStatus.REQUESTED,
      },
      data: {
        billingRequestStatus: BillingRequestStatus.REQUESTED,
        billingDocumentId,
      },
    });
  }

  private async claimPaymentsForBilling(paymentIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.payment.updateMany({
        where: {
          id: { in: paymentIds },
          status: PaymentStatus.COMPLETED,
          billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
          billingDocumentId: null,
        },
        data: { billingRequestStatus: BillingRequestStatus.REQUESTED },
      });
      if (result.count !== paymentIds.length) {
        throw new ConflictException(
          'A billing decision changed while preparing this guest invoice.',
        );
      }
    });
  }

  private async releasePaymentBillingClaim(paymentIds: string[]): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: { in: paymentIds },
        billingRequestStatus: BillingRequestStatus.REQUESTED,
        billingDocumentId: null,
      },
      data: { billingRequestStatus: BillingRequestStatus.NOT_REQUESTED },
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

  const orderTotal = roundMoney(orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0));
  const calculatedGrossTotal = roundMoney(
    items.reduce(
      (sum, item) => sum + roundMoney(Number(item.unitPrice) * Number(item.quantity) * 1.08),
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
          paymentMethodCode: factusPaymentMethod(orders[0].paymentMethod ?? PaymentMethod.CASH),
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

function readInvoiceAllocations(
  value: Prisma.JsonValue | null,
): Array<{ orderItemId: string; quantity: number }> {
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

function hasItemizedPayments(order: PosOrder): boolean {
  return order.payments.some((payment) => readInvoiceAllocations(payment.allocations).length > 0);
}

function buildSplitPaymentInvoice(
  payments: PosPayment[],
  customer: BillingCustomer,
): BillingInvoiceInput {
  const items = payments.flatMap((payment) =>
    readInvoiceAllocations(payment.allocations).map((allocation) => {
      const item = payment.order.items.find(({ id }) => id === allocation.orderItemId);
      if (!item || allocation.quantity > item.quantity) {
        throw new BadRequestException(
          'A paid item allocation no longer matches the original order.',
        );
      }

      const grossUnitPrice = item.price ?? item.product.price;
      const variantNames = item.variants
        .map(({ productVariant }) => productVariant.name)
        .join(', ');
      return {
        codeReference: item.product.code,
        name: variantNames ? `${item.product.name} (${variantNames})` : item.product.name,
        quantity: allocation.quantity.toFixed(2),
        unitPrice: (grossUnitPrice / 1.08).toFixed(2),
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: [{ code: '04', rate: '8.00' }],
      };
    }),
  );
  if (items.length === 0) {
    throw new BadRequestException(
      'Cannot issue an individual invoice without allocated order items.',
    );
  }

  const paymentTotal = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const invoiceItemsTotal = roundMoney(
    items.reduce(
      (sum, item) => sum + roundMoney(Number(item.unitPrice) * Number(item.quantity) * 1.08),
      0,
    ),
  );
  if (Math.abs(paymentTotal - invoiceItemsTotal) > 0.02) {
    throw new BadRequestException(
      'Allocated items do not match this guest payment; reconcile the payment before billing.',
    );
  }

  const totalsByMethod = new Map<PaymentMethod, number>();
  for (const payment of payments) {
    totalsByMethod.set(payment.method, (totalsByMethod.get(payment.method) ?? 0) + payment.amount);
  }
  const paymentDetails = [...totalsByMethod.entries()].map(([method, amount]) => ({
    paymentForm: '1',
    paymentMethodCode: factusPaymentMethod(method),
    amount: roundMoney(amount).toFixed(2),
  }));

  return {
    customer,
    items,
    paymentDetails,
    observation: `POS table guest: ${payments[0].payerLabel ?? 'Guest'}; payments: ${payments
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
