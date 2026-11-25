import { BadRequestException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PosShiftService } from './pos-shift.service';
import { PosService } from './pos.service';

describe('PosService.settleTableAccount', () => {
  const table = {
    id: 'table-1',
    locationId: 'location-1',
    lastAccountClosedAt: null,
  };
  const order = {
    id: 'order-1',
    total: 20000,
    deliveryFee: null,
    isPaid: false,
    items: [
      {
        id: 'item-1',
        quantity: 2,
        price: 10000,
        product: { name: 'Hamburguesa', price: 10000 },
      },
    ],
    payments: [],
  };
  let prisma: {
    table: { findFirst: jest.Mock };
    tableShift: { findFirst: jest.Mock };
    order: { findMany: jest.Mock; update: jest.Mock };
    payment: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let posShiftService: { requireOpenShift: jest.Mock };
  let service: PosService;

  beforeEach(() => {
    const transaction = {
      table: { findFirst: jest.fn().mockResolvedValue(table) },
      tableShift: { findFirst: jest.fn().mockResolvedValue({ id: 'shift-1' }) },
      order: {
        findMany: jest.fn().mockResolvedValue([order]),
        update: jest.fn().mockResolvedValue({ ...order, isPaid: true }),
      },
      payment: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: `payment-${data.orderId}`, ...data }),
          ),
      },
    };
    prisma = {
      table: { findFirst: jest.fn().mockResolvedValue(table) },
      tableShift: transaction.tableShift,
      order: transaction.order,
      payment: transaction.payment,
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    posShiftService = {
      requireOpenShift: jest.fn().mockResolvedValue({ id: 'shift-1' }),
    };
    service = new PosService(
      prisma as unknown as PrismaService,
      posShiftService as unknown as PosShiftService,
    );
  });

  it('charges all unpaid orders together using the selected payment method', async () => {
    await expect(
      service.settleTableAccount('tenant-1', makeUser(), 'table-1', {
        mode: 'FULL',
        method: 'CASH',
      }),
    ).resolves.toMatchObject({
      total: 20000,
      payments: [
        {
          orderId: 'order-1',
          amount: 20000,
          method: 'CASH',
          shiftId: 'shift-1',
          payerLabel: 'Cuenta completa',
        },
      ],
    });
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { isPaid: true },
    });
  });

  it('does not combine an account after individual diner payments have started', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        ...order,
        payments: [
          {
            id: 'payment-split',
            amount: 10000,
            status: 'COMPLETED',
            allocations: [{ orderItemId: 'item-1', quantity: 1 }],
          },
        ],
      },
    ]);

    await expect(
      service.settleTableAccount('tenant-1', makeUser(), 'table-1', {
        mode: 'FULL',
        method: 'CASH',
      }),
    ).rejects.toThrow('Assign remaining products to a diner');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('creates separate, item-linked payments for each diner', async () => {
    const result = await service.settleTableAccount('tenant-1', makeUser(), 'table-1', {
      mode: 'SPLIT',
      participants: [
        {
          label: 'Ana',
          method: 'CASH',
          invoiceChoice: 'ELECTRONIC',
          allocations: [{ orderItemId: 'item-1', quantity: 1 }],
        },
        {
          label: 'Comensal 2',
          method: 'CREDIT_CARD',
          invoiceChoice: 'RECEIPT',
          allocations: [{ orderItemId: 'item-1', quantity: 1 }],
        },
      ],
    });

    expect(result.total).toBe(20000);
    expect(prisma.payment.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          amount: 10000,
          payerLabel: 'Ana',
          billingRequestStatus: 'NOT_REQUESTED',
          allocations: [{ orderItemId: 'item-1', quantity: 1 }],
        }),
      }),
    );
    expect(prisma.payment.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          amount: 10000,
          payerLabel: 'Comensal 2',
          billingRequestStatus: 'DECLINED',
        }),
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { isPaid: true },
    });
  });

  it('rejects assigning more units than the order contains', async () => {
    prisma.order.findMany.mockResolvedValue([
      { ...order, items: [{ ...order.items[0], quantity: 1 }] },
    ]);

    await expect(
      service.settleTableAccount('tenant-1', makeUser(), 'table-1', {
        mode: 'SPLIT',
        participants: [
          {
            label: 'Ana',
            method: 'CASH',
            allocations: [{ orderItemId: 'item-1', quantity: 1 }],
          },
          {
            label: 'Luis',
            method: 'CASH',
            allocations: [{ orderItemId: 'item-1', quantity: 1 }],
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('does not allow a product unit paid in an earlier split to be assigned again', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        ...order,
        payments: [
          {
            id: 'payment-existing',
            amount: 10000,
            status: 'COMPLETED',
            allocations: [{ orderItemId: 'item-1', quantity: 1 }],
          },
        ],
      },
    ]);

    await expect(
      service.settleTableAccount('tenant-1', makeUser(), 'table-1', {
        mode: 'SPLIT',
        participants: [
          {
            label: 'Ana',
            method: 'CASH',
            allocations: [{ orderItemId: 'item-1', quantity: 2 }],
          },
        ],
      }),
    ).rejects.toThrow('ya tiene todas sus unidades asignadas o pagadas');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'cashier-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: UserRole.CASHIER,
    ...overrides,
  } as User;
}
