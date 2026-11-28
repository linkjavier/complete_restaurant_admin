import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  OrderItemStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { parseBogotaDateRange } from '../common/date-range';
import { resolveLocationScope } from '../common/location-scope';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportQueryDto } from './sales-report.dto';

interface DailySalesRow {
  day: string;
  sales: number | null;
  orderCount: number;
}

interface CollectionSummaryRow {
  collected: number | null;
  outstanding: number | null;
  unpaidOrderCount: number;
}

@Injectable()
export class SalesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(tenantId: string, user: User, query: SalesReportQueryDto) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Sales reports are restricted to business managers.');
    }

    const locationId = await resolveLocationScope(this.prisma, tenantId, user, query.locationId);
    const range = parseBogotaDateRange(query.from, query.to, true, 366);
    if (!range.start || !range.endExclusive) {
      throw new BadRequestException('Both start and end dates are required.');
    }

    const createdAt = { gte: range.start, lt: range.endExclusive };
    const locationFilter = locationId ? { locationId } : {};
    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      ...locationFilter,
      createdAt,
      status: { not: OrderStatus.CANCELLED },
      OR: [{ isDeleted: false }, { isDeleted: null }],
    };
    const paidWhere: Prisma.OrderWhereInput = { ...orderWhere, isPaid: true };

    const sqlConditions = [
      Prisma.sql`o."tenantId" = ${tenantId}`,
      Prisma.sql`o."createdAt" >= ${range.start}`,
      Prisma.sql`o."createdAt" < ${range.endExclusive}`,
      Prisma.sql`o."status" <> 'CANCELLED'`,
      Prisma.sql`(o."isDeleted" IS NULL OR o."isDeleted" = FALSE)`,
    ];
    if (locationId) {
      sqlConditions.push(Prisma.sql`o."locationId" = ${locationId}`);
    }
    const sqlWhere = Prisma.join(sqlConditions, ' AND ');

    const previousDays = (range.endExclusive.getTime() - range.start.getTime()) / 86_400_000;
    const previousStart = new Date(range.start.getTime() - previousDays * 86_400_000);
    const previousPaidWhere: Prisma.OrderWhereInput = {
      ...paidWhere,
      createdAt: { gte: previousStart, lt: range.start },
    };

    const [
      paidTotals,
      previousPaidTotals,
      dailyRows,
      collectionRows,
      paymentRows,
      fallbackPaymentRows,
      productRows,
      locationGroups,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: paidWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: previousPaidWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<DailySalesRow[]>(Prisma.sql`
          SELECT
            TO_CHAR(
              (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date,
              'YYYY-MM-DD'
            ) AS day,
            COALESCE(SUM(o.total), 0)::float8 AS sales,
            COUNT(*)::integer AS "orderCount"
          FROM "Order" AS o
          WHERE ${sqlWhere} AND o."isPaid" = TRUE
          GROUP BY day
          ORDER BY day
        `),
      this.prisma.$queryRaw<CollectionSummaryRow[]>(Prisma.sql`
          WITH completed_payments AS (
            SELECT p."orderId", SUM(p.amount) AS amount, COUNT(*) AS payment_count
            FROM "Payment" AS p
            WHERE p."tenantId" = ${tenantId} AND p.status = 'COMPLETED'
            GROUP BY p."orderId"
          )
          SELECT
            COALESCE(SUM(
              CASE
                WHEN o."isPaid" = TRUE AND COALESCE(p.payment_count, 0) = 0
                  THEN COALESCE(o.total, 0)
                ELSE COALESCE(p.amount, 0)
              END
            ), 0)::float8 AS collected,
            COALESCE(SUM(
              CASE WHEN o."isPaid" = FALSE
                THEN GREATEST(COALESCE(o.total, 0) - COALESCE(p.amount, 0), 0)
                ELSE 0
              END
            ), 0)::float8 AS outstanding,
            COUNT(*) FILTER (WHERE o."isPaid" = FALSE)::integer AS "unpaidOrderCount"
          FROM "Order" AS o
          LEFT JOIN completed_payments AS p ON p."orderId" = o.id
          WHERE ${sqlWhere}
        `),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          tenantId,
          status: PaymentStatus.COMPLETED,
          order: { is: orderWhere },
        },
        _sum: { amount: true },
      }),
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where: {
          ...paidWhere,
          paymentMethod: { not: null },
          payments: { none: { status: PaymentStatus.COMPLETED } },
        },
        _sum: { total: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          status: { not: OrderItemStatus.CANCELLED },
          order: { is: paidWhere },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.prisma.order.groupBy({
        by: ['locationId'],
        where: paidWhere,
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
      }),
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          createdAt: true,
          total: true,
          isPaid: true,
          status: true,
          type: true,
          customerName: true,
          billingRequestStatus: true,
          billingDocuments: {
            select: { id: true, status: true, documentNumber: true, cufe: true },
          },
          billingDocumentLinks: {
            select: {
              billingDocument: {
                select: { id: true, status: true, documentNumber: true, cufe: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const productIds = productRows.map(({ productId }) => productId);
    const locationIds = locationGroups.flatMap(({ locationId }) =>
      locationId ? [locationId] : [],
    );
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, tenantId },
          select: { id: true, name: true },
        })
      : [];
    const locations = locationIds.length
      ? await this.prisma.location.findMany({
          where: { id: { in: locationIds }, tenantId },
          select: { id: true, name: true },
        })
      : [];
    const productNames = new Map(products.map(({ id, name }) => [id, name]));
    const locationNames = new Map(locations.map(({ id, name }) => [id, name]));
    const collection = collectionRows[0];
    const salesTotal = paidTotals._sum.total ?? 0;
    const previousSalesTotal = previousPaidTotals._sum.total ?? 0;
    const paidOrderCount = paidTotals._count._all;
    const paymentMethods = new Map<string, number>();
    for (const payment of paymentRows) {
      paymentMethods.set(payment.method, payment._sum.amount ?? 0);
    }
    for (const order of fallbackPaymentRows) {
      if (order.paymentMethod) {
        paymentMethods.set(
          order.paymentMethod,
          (paymentMethods.get(order.paymentMethod) ?? 0) + (order._sum.total ?? 0),
        );
      }
    }

    return {
      period: { from: query.from, to: query.to },
      locationId: locationId ?? null,
      summary: {
        salesTotal,
        paidOrderCount,
        averageTicket: paidOrderCount ? salesTotal / paidOrderCount : 0,
        previousSalesTotal,
        salesChangePercent:
          previousSalesTotal > 0
            ? ((salesTotal - previousSalesTotal) / previousSalesTotal) * 100
            : null,
        collectedTotal: collection?.collected ?? 0,
        outstandingTotal: collection?.outstanding ?? 0,
        unpaidOrderCount: collection?.unpaidOrderCount ?? 0,
      },
      dailySales: fillDailySales(query.from, query.to, dailyRows),
      salesByLocation: locationGroups.map((row) => ({
        locationId: row.locationId,
        locationName: row.locationId
          ? (locationNames.get(row.locationId) ?? 'Ubicación eliminada')
          : 'Sin ubicación',
        sales: row._sum.total ?? 0,
        paidOrderCount: row._count._all,
      })),
      paymentMethods: [...paymentMethods.entries()]
        .map(([method, amount]) => ({ method, amount }))
        .sort((left, right) => right.amount - left.amount),
      topProducts: productRows.map((row) => ({
        productId: row.productId,
        name: productNames.get(row.productId) ?? 'Producto eliminado',
        quantity: row._sum.quantity ?? 0,
      })),
      recentOrders: recentOrders.map((order) => {
        const invoices = [
          ...order.billingDocuments,
          ...order.billingDocumentLinks.map(({ billingDocument }) => billingDocument),
        ];
        return {
          ...order,
          billingDocuments: [
            ...new Map(invoices.map((document) => [document.id, document])).values(),
          ],
        };
      }),
    };
  }
}

function fillDailySales(
  from: string,
  to: string,
  rows: DailySalesRow[],
): Array<{ date: string; sales: number; orderCount: number }> {
  const byDate = new Map(
    rows.map((row) => [row.day, { sales: row.sales ?? 0, orderCount: row.orderCount }]),
  );
  const current = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const result: Array<{ date: string; sales: number; orderCount: number }> = [];
  while (current <= end) {
    const date = current.toISOString().slice(0, 10);
    const values = byDate.get(date) ?? { sales: 0, orderCount: 0 };
    result.push({ date, ...values });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}
