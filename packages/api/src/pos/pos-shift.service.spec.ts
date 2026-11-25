import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PosShiftService } from './pos-shift.service';

describe('PosShiftService', () => {
  const shift = {
    id: 'shift-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    startedAt: new Date('2026-11-26T09:00:00.000Z'),
    endedAt: null,
    openingCash: 50000,
  };
  let prisma: {
    tableShift: {
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    settings: { findUnique: jest.Mock };
    location: { findFirst: jest.Mock };
    payment: { findMany: jest.Mock };
    order: { count: jest.Mock };
  };
  let service: PosShiftService;

  beforeEach(() => {
    prisma = {
      tableShift: {
        findFirst: jest.fn().mockResolvedValue(shift),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(shift),
      },
      settings: {
        findUnique: jest.fn().mockResolvedValue({ defaultOpeningCash: 25000 }),
      },
      location: { findFirst: jest.fn().mockResolvedValue({ id: 'location-1' }) },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          { method: PaymentMethod.CASH, amount: 20000 },
          { method: PaymentMethod.CREDIT_CARD, amount: 30000 },
        ]),
      },
      order: { count: jest.fn().mockResolvedValue(2) },
    };
    service = new PosShiftService(prisma as unknown as PrismaService);
  });

  it('uses the assigned location and returns its default opening cash', async () => {
    await expect(
      service.getStatus('tenant-1', makeUser(), 'location-1'),
    ).resolves.toEqual({
      shift,
      defaultOpeningCash: 25000,
    });
    expect(prisma.tableShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', locationId: 'location-1', endedAt: null },
      }),
    );
  });

  it('rejects access to another assigned location', async () => {
    await expect(
      service.getStatus('tenant-1', makeUser(), 'location-2'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.tableShift.findFirst).not.toHaveBeenCalled();
  });

  it('calculates expected payments including the opening cash', async () => {
    await expect(
      service.getShiftSummary('tenant-1', makeUser(), 'shift-1'),
    ).resolves.toMatchObject({
      expectedAmounts: {
        [PaymentMethod.CASH]: 70000,
        [PaymentMethod.CREDIT_CARD]: 30000,
        [PaymentMethod.DEBIT_CARD]: 0,
        [PaymentMethod.QR]: 0,
        [PaymentMethod.TRANSFER]: 0,
      },
      orderCount: 2,
      paymentCount: 2,
      collectedTotal: 50000,
    });
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { shiftId: 'shift-1', status: PaymentStatus.COMPLETED },
      select: { method: true, amount: true },
    });
  });

  it('blocks POS operations when the location has no open shift', async () => {
    prisma.tableShift.findFirst.mockResolvedValue(null);

    await expect(
      service.requireOpenShift('tenant-1', 'location-1'),
    ).rejects.toThrow('No hay un turno abierto');
  });

  it('requires an explanation when declared amounts differ from expected', async () => {
    await expect(
      service.closeShift(
        'tenant-1',
        makeUser(),
        'shift-1',
        {
          [PaymentMethod.CASH]: 60000,
          [PaymentMethod.CREDIT_CARD]: 30000,
          [PaymentMethod.DEBIT_CARD]: 0,
          [PaymentMethod.QR]: 0,
          [PaymentMethod.TRANSFER]: 0,
        },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.tableShift.updateMany).not.toHaveBeenCalled();
  });

  it('records declared, expected, and variance amounts when closing', async () => {
    const declaredAmounts = {
      [PaymentMethod.CASH]: 70000,
      [PaymentMethod.CREDIT_CARD]: 30000,
      [PaymentMethod.DEBIT_CARD]: 0,
      [PaymentMethod.QR]: 0,
      [PaymentMethod.TRANSFER]: 0,
    };

    await expect(
      service.closeShift('tenant-1', makeUser(), 'shift-1', declaredAmounts),
    ).resolves.toMatchObject({
      declaredAmounts,
      variance: {
        [PaymentMethod.CASH]: 0,
        [PaymentMethod.CREDIT_CARD]: 0,
        [PaymentMethod.DEBIT_CARD]: 0,
        [PaymentMethod.QR]: 0,
        [PaymentMethod.TRANSFER]: 0,
      },
    });
    expect(prisma.tableShift.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shift-1', tenantId: 'tenant-1', endedAt: null },
        data: expect.objectContaining({
          closingDeclared: declaredAmounts,
          closingExpected: {
            [PaymentMethod.CASH]: 70000,
            [PaymentMethod.CREDIT_CARD]: 30000,
            [PaymentMethod.DEBIT_CARD]: 0,
            [PaymentMethod.QR]: 0,
            [PaymentMethod.TRANSFER]: 0,
          },
        }),
      }),
    );
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: UserRole.CASHIER,
    ...overrides,
  } as User;
}
