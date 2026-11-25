import { BadRequestException } from '@nestjs/common';
import { parseBillingInvoiceInput } from './billing.validation';

const validInvoice = {
  customer: {
    identificationDocumentCode: '13',
    identification: 'TEST-CUSTOMER',
    legalOrganizationCode: '2',
    names: 'Sandbox Customer',
  },
  items: [
    {
      codeReference: 'ITEM-1',
      name: 'Sandbox item',
      quantity: '1.00',
      unitPrice: '1000.00',
      unitMeasureCode: '94',
      standardCode: '999',
      taxes: [{ code: 'TEST-CODE', rate: '0.00' }],
    },
  ],
  paymentDetails: [
    {
      paymentForm: '1',
      paymentMethodCode: '10',
      amount: '1000.00',
    },
  ],
};

describe('parseBillingInvoiceInput', () => {
  it('accepts a fully explicit invoice input', () => {
    expect(parseBillingInvoiceInput(validInvoice)).toEqual(validInvoice);
  });

  it('rejects invalid monetary precision and ambiguous discounts', () => {
    expect(() =>
      parseBillingInvoiceInput({
        ...validInvoice,
        items: [
          {
            ...validInvoice.items[0],
            unitPrice: '1000.001',
          },
        ],
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      parseBillingInvoiceInput({
        ...validInvoice,
        items: [
          {
            ...validInvoice.items[0],
            discountRate: '5.00',
            discountAmount: '50.00',
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('requires names for natural persons and due dates for credit payments', () => {
    expect(() =>
      parseBillingInvoiceInput({
        ...validInvoice,
        customer: {
          ...validInvoice.customer,
          names: undefined,
        },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      parseBillingInvoiceInput({
        ...validInvoice,
        paymentDetails: [
          {
            paymentForm: '2',
            paymentMethodCode: '10',
            amount: '1000.00',
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });
});
