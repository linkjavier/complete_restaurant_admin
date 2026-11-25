import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingDocument,
  BillingDocumentStatus,
  BillingDocumentType,
  Prisma,
} from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BillingEmissionError, BillingProviderError } from './billing.errors';
import { BillingProviderRegistry } from './billing-provider.registry';
import { BillingService } from './billing.service';
import { BillingLocationConfigurationService } from './billing-location-configuration.service';
import { BillingInvoiceInput, BillingProvider, EmitInvoiceCommand } from './billing.types';

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

describe('BillingService', () => {
  let service: BillingService;
  let storedDocument: BillingDocument | null;
  let provider: BillingProvider;
  let issueInvoiceMock: jest.Mock;
  let createDocument: jest.Mock;
  let findDocument: jest.Mock;
  let updateDocument: jest.Mock;
  let claimRetry: jest.Mock;
  let findOrder: jest.Mock;
  let billingEnvironment: string;

  beforeEach(async () => {
    storedDocument = null;
    billingEnvironment = 'sandbox';
    issueInvoiceMock = jest.fn(async (_referenceCode: string, _invoice: BillingInvoiceInput) => ({
      status: 'ACCEPTED' as const,
      providerReferenceId: 'FACTUS-1',
      documentNumber: 'FACTUS-1',
      cufe: 'CUFE-TEST',
      errorCodes: [] as string[],
      isValidated: true,
    }));
    provider = {
      name: 'FACTUS',
      supportedCountries: ['CO'],
      issueInvoice: issueInvoiceMock,
      getInvoiceStatus: jest.fn(),
      findInvoiceByReferenceCode: jest.fn(),
    };

    findDocument = jest.fn(async () => storedDocument);
    createDocument = jest.fn(async (args: { data: Prisma.BillingDocumentUncheckedCreateInput }) => {
      storedDocument = makeDocument(args.data);
      return storedDocument;
    });
    updateDocument = jest.fn(async () => storedDocument);
    claimRetry = jest.fn(async () => ({ count: 1 }));
    findOrder = jest.fn(async () => null);

    const prismaMock = {
      billingDocument: {
        findUnique: findDocument,
        findFirst: findDocument,
        create: createDocument,
        update: updateDocument,
        updateMany: claimRetry,
      },
      order: {
        findFirst: findOrder,
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: BillingProviderRegistry,
          useValue: { forCountry: jest.fn(() => provider) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              key === 'BILLING_ENV' ? billingEnvironment : defaultValue,
          },
        },
        {
          provide: BillingLocationConfigurationService,
          useValue: {
            getForEmission: jest.fn(async () => ({
              countryCode: 'CO',
              context: {
                credentials: {
                  clientId: 'client-id',
                  clientSecret: 'client-secret',
                  username: 'test-user',
                  password: 'test-password',
                },
                numberingRangeId: 7,
              },
            })),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(BillingService);
  });

  it('persists and reuses the same document for repeated idempotency keys', async () => {
    const command: EmitInvoiceCommand = {
      tenantId: 'tenant-1',
      locationId: 'location-1',
      idempotencyKey: 'sandbox-test-1',
      invoice,
    };

    const first = await service.issueInvoice(command);
    const repeated = await service.issueInvoice(command);

    expect(first.id).toBe(repeated.id);
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(issueInvoiceMock).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const command: EmitInvoiceCommand = {
      tenantId: 'tenant-1',
      locationId: 'location-1',
      idempotencyKey: 'sandbox-test-2',
      invoice,
    };
    await service.issueInvoice(command);

    await expect(
      service.issueInvoice({
        ...command,
        invoice: {
          ...invoice,
          items: [{ ...invoice.items[0], name: 'Changed item' }],
        },
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('submits only once when identical requests arrive concurrently', async () => {
    let releaseFirstCreate: () => void = () => undefined;
    let notifyFirstCreateStarted: () => void = () => undefined;
    let notifySecondCreateStarted: () => void = () => undefined;
    const firstCreateStarted = new Promise<void>((resolve) => {
      notifyFirstCreateStarted = resolve;
    });
    const secondCreateStarted = new Promise<void>((resolve) => {
      notifySecondCreateStarted = resolve;
    });
    const createGate = new Promise<void>((resolve) => {
      releaseFirstCreate = resolve;
    });
    let callCount = 0;
    createDocument.mockImplementation(
      async (args: { data: Prisma.BillingDocumentUncheckedCreateInput }) => {
        callCount += 1;
        if (callCount === 1) {
          notifyFirstCreateStarted();
          await createGate;
          storedDocument = makeDocument(args.data);
          return storedDocument;
        }
        notifySecondCreateStarted();
        await createGate;
        throw { code: 'P2002' };
      },
    );

    const command: EmitInvoiceCommand = {
      tenantId: 'tenant-1',
      locationId: 'location-1',
      idempotencyKey: 'sandbox-concurrent',
      invoice,
    };
    const firstRequest = service.issueInvoice(command);
    await firstCreateStarted;
    const secondRequest = service.issueInvoice(command);
    await secondCreateStarted;
    releaseFirstCreate();

    const [first, second] = await Promise.all([firstRequest, secondRequest]);

    expect(first.id).toBe(second.id);
    expect(createDocument).toHaveBeenCalledTimes(2);
    expect(issueInvoiceMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an order from a different location before creating a document', async () => {
    findOrder.mockResolvedValueOnce({ id: 'order-1', locationId: 'location-2' });

    await expect(
      service.issueInvoice({
        tenantId: 'tenant-1',
        locationId: 'location-1',
        idempotencyKey: 'location-mismatch',
        orderId: 'order-1',
        invoice,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createDocument).not.toHaveBeenCalled();
    expect(issueInvoiceMock).not.toHaveBeenCalled();
  });

  it('retries only retryable failures with the same provider reference', async () => {
    const command: EmitInvoiceCommand = {
      tenantId: 'tenant-1',
      locationId: 'location-1',
      idempotencyKey: 'sandbox-retry',
      invoice,
    };
    issueInvoiceMock.mockRejectedValueOnce(
      new BillingProviderError('FACTUS_RATE_LIMITED', 'FAILED_RETRYABLE', 'Retry later.'),
    );

    await expect(service.issueInvoice(command)).rejects.toThrow(BillingEmissionError);
    if (!storedDocument) {
      throw new Error('Expected the failed billing document to be persisted.');
    }
    storedDocument = {
      ...storedDocument,
      status: BillingDocumentStatus.FAILED_RETRYABLE,
    };
    const referenceCode = storedDocument.referenceCode;

    const retried = await service.retryInvoice(command);

    expect(retried.id).toBe(storedDocument.id);
    expect(claimRetry).toHaveBeenCalledTimes(1);
    expect(issueInvoiceMock).toHaveBeenLastCalledWith(
      referenceCode,
      { ...invoice, numberingRangeId: 7 },
      expect.objectContaining({ numberingRangeId: 7 }),
    );
  });

  it('refuses document issuance when billing is not in Sandbox', async () => {
    billingEnvironment = 'production';
    await expect(
      service.issueInvoice({
        tenantId: 'tenant-1',
        locationId: 'location-1',
        idempotencyKey: 'sandbox-test-3',
        invoice,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(createDocument).not.toHaveBeenCalled();
    expect(issueInvoiceMock).not.toHaveBeenCalled();
  });
});

function makeDocument(data: Prisma.BillingDocumentUncheckedCreateInput): BillingDocument {
  return {
    id: 'billing-doc-1',
    tenantId: data.tenantId,
    locationId: data.locationId,
    orderId: data.orderId ?? null,
    countryCode: data.countryCode,
    providerName: data.providerName,
    type: BillingDocumentType.SALES_INVOICE,
    status: BillingDocumentStatus.PENDING,
    idempotencyKey: data.idempotencyKey,
    referenceCode: data.referenceCode,
    providerReferenceId: null,
    documentNumber: null,
    cufe: null,
    requestHash: data.requestHash,
    responseMetadata: null,
    requestPayload: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
