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

describe('Factus invoice mapping and provider', () => {
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

  describe('FactusProvider connection test', () => {
    it('validates sandbox credentials through OAuth without requesting a bill', async () => {
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          access_token: 'sandbox-access-token',
          refresh_token: 'sandbox-refresh-token',
          expires_in: 3600,
        },
      } as never);
      const requestSpy = jest.spyOn(axios, 'request');
      const moduleRef = await Test.createTestingModule({
        providers: [
          FactusProvider,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultValue?: string) =>
                key === 'BILLING_ENV' ? 'sandbox' : defaultValue,
            },
          },
        ],
      }).compile();

      try {
        const provider = moduleRef.get(FactusProvider);
        await provider.testConnection(providerContext);

        expect(postSpy).toHaveBeenCalledWith(
          'https://api-sandbox.factus.com.co/oauth/token',
          expect.any(URLSearchParams),
          expect.objectContaining({ timeout: 15_000 }),
        );
        expect(requestSpy).not.toHaveBeenCalled();
      } finally {
        await moduleRef.close();
        postSpy.mockRestore();
        requestSpy.mockRestore();
      }
    });

    it('surfaces only allow-listed OAuth error codes from Factus', async () => {
      const postSpy = jest.spyOn(axios, 'post').mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Sensitive provider response details',
          },
        },
      });
      const moduleRef = await Test.createTestingModule({
        providers: [
          FactusProvider,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, defaultValue?: string) =>
                key === 'BILLING_ENV' ? 'sandbox' : defaultValue,
            },
          },
        ],
      }).compile();

      try {
        const provider = moduleRef.get(FactusProvider);
        await expect(provider.testConnection(providerContext)).rejects.toMatchObject({
          code: 'FACTUS_AUTH_HTTP_400_INVALID_GRANT',
          message: 'Factus authentication failed before document submission.',
        });
      } finally {
        await moduleRef.close();
        postSpy.mockRestore();
      }
    });
  });

  it('includes rejected field paths without logging provider field values', async () => {
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        access_token: 'sandbox-access-token',
        refresh_token: 'sandbox-refresh-token',
        expires_in: 3600,
      },
    } as never);
    const requestSpy = jest.spyOn(axios, 'request').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          errors: {
            'customer.names': ['Sensitive customer value must not be logged'],
            'items.0.taxes.0.rate': ['Invalid tax rate'],
          },
        },
      },
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        FactusProvider,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              key === 'BILLING_ENV' ? 'sandbox' : defaultValue,
          },
        },
      ],
    }).compile();

    try {
      const provider = moduleRef.get(FactusProvider);
      const invoice: BillingInvoiceInput = {
        customer: {
          identificationDocumentCode: '13',
          identification: 'TEST-CUSTOMER',
          legalOrganizationCode: '2',
          names: 'Sandbox Customer',
        },
        items: [],
        paymentDetails: [],
      };

      await expect(
        provider.issueInvoice('KREFERENCE', invoice, providerContext),
      ).rejects.toMatchObject({
        code: 'FACTUS_DOCUMENT_HTTP_422',
        message:
          'Factus rejected the invoice request. Validation fields: customer.names, items.0.taxes.0.rate.',
      });
    } finally {
      await moduleRef.close();
      postSpy.mockRestore();
      requestSpy.mockRestore();
    }
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
