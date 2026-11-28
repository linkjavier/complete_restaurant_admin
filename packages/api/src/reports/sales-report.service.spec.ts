import { ForbiddenException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportService } from './sales-report.service';

describe('SalesReportService', () => {
  it('aggregates paid sales, actual collections, outstanding balances, payment methods, and top products', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _sum: { total: 2000 },
      _count: { _all: 2 },
    });
    aggregate
      .mockResolvedValueOnce({ _sum: { total: 2000 }, _count: { _all: 2 } })
      .mockResolvedValueOnce({ _sum: { total: 1000 }, _count: { _all: 1 } });
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ day: '2026-10-01', sales: 2000, orderCount: 2 }])
      .mockResolvedValueOnce([{ collected: 1800, outstanding: 300, unpaidOrderCount: 1 }]);
    const paymentGroupBy = jest
      .fn()
      .mockResolvedValue([{ method: 'CASH', _sum: { amount: 1000 } }]);
    const orderGroupBy = jest.fn(({ by }: { by: string[] }) =>
      by[0] === 'paymentMethod'
        ? [{ paymentMethod: 'CASH', _sum: { total: 800 } }]
        : [
            {
              locationId: 'location-1',
              _sum: { total: 2000 },
              _count: { _all: 2 },
            },
          ],
    );
    const orderItemGroupBy = jest
      .fn()
      .mockResolvedValue([{ productId: 'product-1', _sum: { quantity: 3 } }]);
    const productFindMany = jest.fn().mockResolvedValue([{ id: 'product-1', name: 'Hamburguesa' }]);
    const locationFindMany = jest.fn().mockResolvedValue([{ id: 'location-1', name: 'Central' }]);
    const prisma = makePrisma({
      aggregate,
      queryRaw,
      paymentGroupBy,
      orderGroupBy,
      orderItemGroupBy,
      productFindMany,
      locationFindMany,
      orderFindMany: jest.fn().mockResolvedValue([]),
    });
    const service = new SalesReportService(prisma);

    const result = await service.getReport('tenant-1', makeUser(UserRole.SUPER_ADMIN, null), {
      from: '2026-10-01',
      to: '2026-10-31',
      locationId: 'location-1',
    });

    expect(result.summary).toMatchObject({
      salesTotal: 2000,
      paidOrderCount: 2,
      averageTicket: 1000,
      previousSalesTotal: 1000,
      salesChangePercent: 100,
      collectedTotal: 1800,
      outstandingTotal: 300,
      unpaidOrderCount: 1,
    });
    expect(result.paymentMethods).toEqual([{ method: 'CASH', amount: 1800 }]);
    expect(result.topProducts).toEqual([
      { productId: 'product-1', name: 'Hamburguesa', quantity: 3 },
    ]);
    expect(result.dailySales).toHaveLength(31);
    expect(result.dailySales[0]).toEqual({
      date: '2026-10-01',
      sales: 2000,
      orderCount: 2,
    });
    expect(result.dailySales[1]).toEqual({
      date: '2026-10-02',
      sales: 0,
      orderCount: 0,
    });
    expect(result.salesByLocation).toEqual([
      {
        locationId: 'location-1',
        locationName: 'Central',
        sales: 2000,
        paidOrderCount: 2,
      },
    ]);
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'location-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
  });

  it('restricts reports to the authenticated user location', async () => {
    const queryRaw = jest.fn();
    const service = new SalesReportService(makePrisma({ queryRaw }));

    await expect(
      service.getReport('tenant-1', makeUser(UserRole.MANAGER, 'location-1'), {
        from: '2026-10-01',
        to: '2026-10-31',
        locationId: 'location-2',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

function makePrisma(overrides: {
  aggregate?: jest.Mock;
  queryRaw?: jest.Mock;
  paymentGroupBy?: jest.Mock;
  orderGroupBy?: jest.Mock;
  orderItemGroupBy?: jest.Mock;
  productFindMany?: jest.Mock;
  locationFindMany?: jest.Mock;
  orderFindMany?: jest.Mock;
}): PrismaService {
  return {
    location: {
      findFirst: jest.fn().mockResolvedValue({ id: 'location-1' }),
      findMany: overrides.locationFindMany ?? jest.fn().mockResolvedValue([]),
    },
    order: {
      aggregate: overrides.aggregate ?? jest.fn(),
      groupBy: overrides.orderGroupBy ?? jest.fn().mockResolvedValue([]),
      findMany: overrides.orderFindMany ?? jest.fn().mockResolvedValue([]),
    },
    payment: { groupBy: overrides.paymentGroupBy ?? jest.fn().mockResolvedValue([]) },
    orderItem: { groupBy: overrides.orderItemGroupBy ?? jest.fn().mockResolvedValue([]) },
    product: { findMany: overrides.productFindMany ?? jest.fn().mockResolvedValue([]) },
    $queryRaw: overrides.queryRaw ?? jest.fn().mockResolvedValue([]),
  } as unknown as PrismaService;
}

function makeUser(role: UserRole, locationId: string | null): User {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    locationId,
    role,
  } as User;
}
