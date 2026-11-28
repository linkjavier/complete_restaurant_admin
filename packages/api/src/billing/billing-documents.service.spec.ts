import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingDocumentStatus, BillingDocumentType, PaymentMethod, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingDocumentsService } from './billing-documents.service';

describe('BillingDocumentsService', () => {
  it('lists tenant documents with location scoping, date filters, pagination, and status totals', async () => {
    const document = makeDocument();
    const findMany = jest.fn().mockResolvedValue([document]);
    const count = jest.fn().mockResolvedValue(1);
    const groupBy = jest.fn().mockResolvedValue([
      { status: BillingDocumentStatus.ACCEPTED, _count: { _all: 4 } },
      { status: BillingDocumentStatus.PENDING, _count: { _all: 1 } },
    ]);
    const prisma = makePrisma({ findMany, count, groupBy });
    const service = new BillingDocumentsService(prisma);

    const result = await service.list(
      'tenant-1',
      makeUser(UserRole.MANAGER, 'location-1'),
      {
        from: '2026-10-01',
        to: '2026-10-31',
        status: BillingDocumentStatus.ACCEPTED,
        search: 'order-1',
        page: '2',
        pageSize: '10',
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          locationId: 'location-1',
          status: BillingDocumentStatus.ACCEPTED,
          createdAt: {
            gte: new Date('2026-10-01T05:00:00.000Z'),
            lt: new Date('2026-11-01T05:00:00.000Z'),
          },
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result.items[0]).toMatchObject({
      customerName: 'Cliente',
      customerIdentification: '900123456',
      totalAmount: 107,
      orderIds: ['order-1'],
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.summary).toEqual({
      total: 5,
      byStatus: {
        PENDING: 1,
        ACCEPTED: 4,
        REJECTED: 0,
        FAILED_RETRYABLE: 0,
        RECONCILIATION_REQUIRED: 0,
      },
    });
  });

  it('does not allow a manager to request another location', async () => {
    const findMany = jest.fn();
    const service = new BillingDocumentsService(makePrisma({ findMany }));

    await expect(
      service.list('tenant-1', makeUser(UserRole.MANAGER, 'location-1'), {
        locationId: 'location-2',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not reveal a document outside the manager location', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new BillingDocumentsService(makePrisma({ findFirst }));

    await expect(
      service.getOne('tenant-1', makeUser(UserRole.MANAGER, 'location-1'), 'document-1'),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-1', tenantId: 'tenant-1', locationId: 'location-1' },
      }),
    );
  });
});

function makePrisma(overrides: {
  findMany?: jest.Mock;
  count?: jest.Mock;
  groupBy?: jest.Mock;
  findFirst?: jest.Mock;
}): PrismaService {
  return {
    location: { findFirst: jest.fn().mockResolvedValue({ id: 'location-1' }) },
    billingDocument: {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      count: overrides.count ?? jest.fn().mockResolvedValue(0),
      groupBy: overrides.groupBy ?? jest.fn().mockResolvedValue([]),
      findFirst: overrides.findFirst ?? jest.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaService;
}

function makeUser(role: UserRole, locationId: string): User {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    locationId,
    role,
  } as User;
}

function makeDocument() {
  const now = new Date('2026-10-10T12:00:00.000Z');
  return {
    id: 'document-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    orderId: 'order-1',
    countryCode: 'CO',
    providerName: 'FACTUS',
    type: BillingDocumentType.SALES_INVOICE,
    status: BillingDocumentStatus.ACCEPTED,
    idempotencyKey: 'key-1',
    referenceCode: 'reference-1',
    providerReferenceId: 'factus-1',
    documentNumber: 'SETP-1001',
    cufe: 'CUFE-1',
    requestHash: 'hash-1',
    responseMetadata: null,
    requestPayload: {
      customer: { names: 'Cliente', identification: '900123456' },
      paymentDetails: [{ amount: '107.00' }],
    },
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    location: { id: 'location-1', name: 'Centro' },
    orderLinks: [{ orderId: 'order-1', order: { id: 'order-1', createdAt: now, total: 107 } }],
    payments: [
      { id: 'payment-1', orderId: 'order-1', amount: 107, method: PaymentMethod.CASH },
    ],
  };
}
