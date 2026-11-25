import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BillingRequestStatus, OrderStatus, User, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from './tables.service';

const table = {
  id: 'table-1',
  locationId: 'location-1',
  lastAccountClosedAt: null as Date | null,
};

const completedOrder = {
  id: 'order-1',
  status: OrderStatus.READY,
  isPaid: true,
  billingRequestStatus: BillingRequestStatus.DECLINED,
  createdAt: new Date('2026-11-25T10:00:00.000Z'),
  total: 25000,
};

describe('TablesService.closeAccountForPos', () => {
  let service: TablesService;
  let transaction: {
    table: { findFirst: jest.Mock; update: jest.Mock };
    tableShift: { findFirst: jest.Mock };
    tableAccountSession: { create: jest.Mock };
    order: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    location: { findFirst: jest.Mock };
    tableShift: {
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    table: { findFirst: jest.Mock };
    order: { findMany: jest.Mock; aggregate: jest.Mock };
  };

  beforeEach(() => {
    transaction = {
      table: {
        findFirst: jest.fn().mockResolvedValue(table),
        update: jest.fn().mockResolvedValue(table),
      },
      tableShift: {
        findFirst: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      },
      tableAccountSession: {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([completedOrder]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
      location: {
        findFirst: jest.fn().mockResolvedValue({ id: 'location-1' }),
      },
      tableShift: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      table: {
        findFirst: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({
          _min: { createdAt: completedOrder.createdAt },
          _count: { _all: 1 },
          _sum: { total: 25000 },
        }),
      },
    };
    service = new TablesService(prisma as unknown as PrismaService, {} as ConfigService);
  });

  it('closes the current account and records the closure timestamp', async () => {
    const result = await service.closeAccountForPos('tenant-1', makeUser(), 'table-1');

    expect(transaction.table.update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { lastAccountClosedAt: expect.any(Date) },
    });
    expect(result).toMatchObject({
      tableId: 'table-1',
      closedOrderCount: 1,
      closedAt: expect.any(Date),
    });
    expect(transaction.tableAccountSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableId: 'table-1',
          shiftId: 'shift-1',
          startedAt: completedOrder.createdAt,
          orderCount: 1,
          total: 25000,
        }),
      }),
    );
    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        tableId: 'table-1',
        id: { in: ['order-1'] },
      },
      data: { tableAccountSessionId: 'session-1' },
    });
  });

  it('allows an explicitly confirmed closure of a paid account with orders still in progress', async () => {
    transaction.order.findMany.mockResolvedValue([
      { ...completedOrder, status: OrderStatus.IN_PROGRESS },
    ]);

    await expect(
      service.closeAccountForPos('tenant-1', makeUser(), 'table-1', true),
    ).resolves.toMatchObject({
      tableId: 'table-1',
      closedOrderCount: 1,
    });

    expect(transaction.tableAccountSession.create).toHaveBeenCalled();
    expect(transaction.table.update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { lastAccountClosedAt: expect.any(Date) },
    });
  });

  it.each([
    {
      reason: 'unpaid orders',
      order: { ...completedOrder, isPaid: false },
      expectedMessage: 'Pay every order',
    },
    {
      reason: 'incomplete orders',
      order: { ...completedOrder, status: OrderStatus.IN_PROGRESS },
      expectedMessage: 'Complete every order',
    },
    {
      reason: 'undecided billing requests',
      order: {
        ...completedOrder,
        billingRequestStatus: BillingRequestStatus.NOT_REQUESTED,
      },
      expectedMessage: 'Choose a normal receipt',
    },
  ])('does not close the account with $reason', async ({ order, expectedMessage }) => {
    transaction.order.findMany.mockResolvedValue([order]);

    await expect(service.closeAccountForPos('tenant-1', makeUser(), 'table-1')).rejects.toThrow(
      expectedMessage,
    );

    expect(transaction.table.update).not.toHaveBeenCalled();
  });

  it('returns the active shift for an authorized location', async () => {
    const shift = { id: 'shift-1', locationId: 'location-1' };
    prisma.tableShift.findFirst.mockResolvedValue(shift);

    await expect(service.getActiveShift('tenant-1', makeUser(), 'location-1')).resolves.toBe(shift);
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
  });

  it('rejects opening or viewing a shift at another assigned location', async () => {
    await expect(service.getActiveShift('tenant-1', makeUser(), 'location-2')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.tableShift.findFirst).not.toHaveBeenCalled();
  });

  it('returns only activity belonging to the active shift and reports the open account start', async () => {
    const shift = {
      id: 'shift-1',
      locationId: 'location-1',
      startedAt: new Date('2026-11-25T09:00:00.000Z'),
      endedAt: null,
    };
    const order = { id: 'order-2', createdAt: completedOrder.createdAt };
    prisma.table.findFirst.mockResolvedValue({
      id: 'table-1',
      locationId: 'location-1',
      lastAccountClosedAt: null,
    });
    prisma.tableShift.findFirst.mockResolvedValue(shift);
    prisma.order.findMany.mockResolvedValue([order]);

    const result = await service.getTableShiftActivity('tenant-1', makeUser(), 'table-1');

    expect(result).toEqual({
      shift,
      orders: [order],
      openAccountStartedAt: completedOrder.createdAt,
      openAccountOrderCount: 1,
      openAccountTotal: 25000,
    });
  });

  it('denies closing an account at another assigned location', async () => {
    await expect(
      service.closeAccountForPos('tenant-1', makeUser({ locationId: 'location-2' }), 'table-1'),
    ).rejects.toThrow(ForbiddenException);

    expect(transaction.order.findMany).not.toHaveBeenCalled();
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
