import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import axios from 'axios';
import { BillingInvoiceInput } from '../../billing.types';
import { BillingProviderError } from '../../billing.errors';
import { FactusProvider, toFactusInvoiceRequest } from './factus-provider';

const providerContext = {
  credentials: {
    clientId: 'sandbox-client',
    clientSecret: 'sandbox-secret',
    username: 'sandbox-user',
    password: 'sandbox-password',
  },
};

describe('toFactusInvoiceRequest', () => {
  it('maps domain invoice fields without inventing tax or payment values', () => {
    const invoice: BillingInvoiceInput = {
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
          taxes: [{ code: '01', rate: '19.00' }],
        },
      ],
      paymentDetails: [
        {
          paymentForm: '1',
          paymentMethodCode: '10',
          amount: '1190.00',
        },
      ],
    };

    expect(toFactusInvoiceRequest('KREFERENCE', invoice)).toEqual({
      reference_code: 'KREFERENCE',
      document: '01',
      send_email: false,
      customer: {
        identification_document_code: '13',
        identification: 'TEST-CUSTOMER',
        legal_organization_code: '2',
        names: 'Sandbox Customer',
      },
      items: [
        {
          code_reference: 'ITEM-1',
          name: 'Sandbox item',
          quantity: '1.00',
          price: '1000.00',
          unit_measure_code: '94',
          standard_code: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        },
      ],
      payment_details: [
        {
          payment_form: '1',
          payment_method_code: '10',
          amount: '1190.00',
        },
      ],
    });
  });

  it('uses the numbering range configured for the selected location', () => {
    const invoice: BillingInvoiceInput = {
      customer: {
        identificationDocumentCode: '13',
        identification: 'TEST-CUSTOMER',
        legalOrganizationCode: '2',
      },
      items: [],
      paymentDetails: [],
      numberingRangeId: 99,
    };

    expect(toFactusInvoiceRequest('KREFERENCE', invoice, 7).numbering_range_id).toBe(7);
  });

  it('refuses production configuration before making an HTTP request', async () => {
    const requestSpy = jest.spyOn(axios, 'request');
    const postSpy = jest.spyOn(axios, 'post');
    const moduleRef = await Test.createTestingModule({
      providers: [
        FactusProvider,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              key === 'BILLING_ENV' ? 'production' : defaultValue,
          },
        },
      ],
    }).compile();

    try {
      const provider = moduleRef.get(FactusProvider);
      await expect(
        provider.issueInvoice(
          'KREFERENCE',
          {
            customer: {
              identificationDocumentCode: '13',
              identification: 'TEST-CUSTOMER',
              legalOrganizationCode: '2',
              names: 'Sandbox Customer',
            },
            items: [],
            paymentDetails: [],
          },
          providerContext,
        ),
      ).rejects.toMatchObject({
        code: 'BILLING_ENV_NOT_SANDBOX',
      } satisfies Partial<BillingProviderError>);
      expect(requestSpy).not.toHaveBeenCalled();
      expect(postSpy).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
      requestSpy.mockRestore();
      postSpy.mockRestore();
    }
  });
});
