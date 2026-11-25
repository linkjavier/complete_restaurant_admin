import { BillingRequestStatus, PaymentMethod, PaymentStatus, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { BillingCustomer } from './billing.types';
import { PosBillingService, PosOrder, buildPosInvoice } from './pos-billing.service';

const customer: BillingCustomer = {
  identificationDocumentCode: '13',
  identification: '222222222222',
  legalOrganizationCode: '2',
  names: 'Consumidor final',
};

describe('buildPosInvoice', () => {
  it('maps tax-inclusive POS prices to Factus INC 8% lines and completed payment details', () => {
    const invoice = buildPosInvoice([makeOrder()], customer, false);

    expect(invoice.items).toEqual([
      {
        codeReference: 'PRD-000001',
        name: 'Hamburguesa',
        quantity: '1.00',
        unitPrice: '1000.00',
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: [{ code: '04', rate: '8.00' }],
      },
    ]);
    expect(invoice.paymentDetails).toEqual([
      {
        paymentForm: '1',
        paymentMethodCode: '10',
        amount: '1080.00',
      },
    ]);
  });

  it('uses the configured same-day credit terms for unpaid delivery orders', () => {
    const invoice = buildPosInvoice(
      [makeOrder({ isPaid: false, payments: [], paymentMethod: PaymentMethod.CASH })],
      customer,
      true,
    );

    expect(invoice.paymentDetails).toHaveLength(1);
    expect(invoice.paymentDetails[0]).toMatchObject({
      paymentForm: '2',
      paymentMethodCode: '10',
      amount: '1080.00',
    });
    expect(invoice.paymentDetails[0].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('consolidates multiple paid table orders and their payment methods into one invoice', () => {
    const invoice = buildPosInvoice(
      [
        makeOrder(),
        makeOrder({
          id: 'order-2',
          paymentMethod: PaymentMethod.TRANSFER,
          payments: [
            {
              id: 'payment-2',
              tenantId: 'tenant-1',
              orderId: 'order-2',
              shiftId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: PaymentStatus.COMPLETED,
              billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
              billingDocumentId: null,
              payerGroupId: null,
              payerLabel: null,
              allocations: null,
              method: PaymentMethod.TRANSFER,
              amount: 1080,
            },
          ],
        }),
      ],
      customer,
      false,
    );

    expect(invoice.items).toHaveLength(2);
    expect(invoice.paymentDetails).toEqual([
      { paymentForm: '1', paymentMethodCode: '10', amount: '1080.00' },
      { paymentForm: '1', paymentMethodCode: '47', amount: '1080.00' },
    ]);
  });

  it('rejects invoice lines whose tax-inclusive total differs from the POS order total', () => {
    expect(() => buildPosInvoice([makeOrder({ total: 1090 })], customer, false)).toThrow(
      'Invoice lines do not match the order total.',
    );
  });
});

describe('PosBillingService split payment invoices', () => {
  it('does not emit an invoice when the payment billing claim is lost', async () => {
    const transactionPayment = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback({ payment: transactionPayment })),
      table: {
        findFirst: jest.fn().mockResolvedValue({ id: 'table-1', locationId: 'location-1' }),
      },
      payment: {
        findMany: jest
          .fn()
          .mockResolvedValue([makeSplitPayment('payment-1', 'order-1', 'guest-1')]),
      },
    };
    const billingService = { issueInvoice: jest.fn() };
    const service = new PosBillingService(
      prisma as unknown as PrismaService,
      billingService as unknown as BillingService,
    );

    await expect(
      service.issueForTablePayments(
        'tenant-1',
        makeBillingUser(),
        'table-1',
        ['payment-1'],
        customer,
      ),
    ).rejects.toThrow('A billing decision changed while preparing this guest invoice.');

    expect(billingService.issueInvoice).not.toHaveBeenCalled();
  });

  it('creates an invoice for only the items and payments assigned to one guest', async () => {
    const payment = makeSplitPayment('payment-1', 'order-1', 'guest-1');
    const transactionPayment = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback({ payment: transactionPayment })),
      table: {
        findFirst: jest.fn().mockResolvedValue({ id: 'table-1', locationId: 'location-1' }),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([payment]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const billingService = {
      issueInvoice: jest.fn().mockResolvedValue({ id: 'document-1' }),
    };
    const service = new PosBillingService(
      prisma as unknown as PrismaService,
      billingService as unknown as BillingService,
    );

    await service.issueForTablePayments(
      'tenant-1',
      makeBillingUser(),
      'table-1',
      ['payment-1'],
      customer,
    );

    expect(billingService.issueInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIds: ['payment-1'],
        orderIds: ['order-1'],
        invoice: expect.objectContaining({
          items: [
            expect.objectContaining({
              codeReference: 'PRD-000001',
              quantity: '1.00',
              unitPrice: '1000.00',
            }),
          ],
          paymentDetails: [
            {
              paymentForm: '1',
              paymentMethodCode: '10',
              amount: '1080.00',
            },
          ],
        }),
      }),
    );
    expect(transactionPayment.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['payment-1'] },
        status: PaymentStatus.COMPLETED,
        billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
        billingDocumentId: null,
      },
      data: { billingRequestStatus: BillingRequestStatus.REQUESTED },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['payment-1'] },
        billingRequestStatus: BillingRequestStatus.REQUESTED,
      },
      data: {
        billingRequestStatus: BillingRequestStatus.REQUESTED,
        billingDocumentId: 'document-1',
      },
    });
  });
});

function makeOrder(overrides: Partial<PosOrder> = {}): PosOrder {
  return {
    id: 'order-1',
    total: 1080,
    deliveryFee: 0,
    isPaid: true,
    paymentMethod: PaymentMethod.CASH,
    items: [
      {
        id: 'item-1',
        quantity: 1,
        price: 1080,
        product: {
          id: 'product-1',
          code: 'PRD-000001',
          name: 'Hamburguesa',
          price: 1080,
        },
        variants: [],
      },
    ],
    payments: [{ method: PaymentMethod.CASH, amount: 1080 }],
    ...overrides,
  } as unknown as PosOrder;
}

function makeSplitPayment(id: string, orderId: string, payerGroupId: string) {
  const order = makeOrder({
    id: orderId,
    status: 'READY',
    locationId: 'location-1',
    tableId: 'table-1',
    type: 'TABLE',
    isDeleted: false,
  });
  return {
    id,
    tenantId: 'tenant-1',
    orderId,
    amount: 1080,
    method: PaymentMethod.CASH,
    status: PaymentStatus.COMPLETED,
    payerLabel: 'Ana',
    payerGroupId,
    billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
    billingDocumentId: null,
    allocations: [{ orderItemId: 'item-1', quantity: 1 }],
    createdAt: new Date(),
    updatedAt: new Date(),
    order,
  };
}

function makeBillingUser(): User {
  return {
    id: 'cashier-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: UserRole.CASHIER,
  } as User;
}
