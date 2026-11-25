import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { BillingCustomer } from './billing.types';
import { PosOrder, buildPosInvoice } from './pos-billing.service';

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
              createdAt: new Date(),
              updatedAt: new Date(),
              status: PaymentStatus.COMPLETED,
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
    expect(() =>
      buildPosInvoice([makeOrder({ total: 1090 })], customer, false),
    ).toThrow('Invoice lines do not match the order total.');
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
