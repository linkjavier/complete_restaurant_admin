import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingDocumentStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseBogotaDateRange } from '../common/date-range';
import { resolveLocationScope } from '../common/location-scope';
import { ListBillingDocumentsDto } from './dto/list-billing-documents.dto';

const BILLING_STATUSES = Object.values(BillingDocumentStatus);

export interface BillingDocumentListItem {
  id: string;
  locationId: string;
  locationName: string;
  status: BillingDocumentStatus;
  providerName: string;
  documentNumber: string | null;
  cufe: string | null;
  referenceCode: string;
  createdAt: Date;
  updatedAt: Date;
  errorCode: string | null;
  errorMessage: string | null;
  orderIds: string[];
  customerName: string | null;
  customerIdentification: string | null;
  totalAmount: number | null;
}

type BillingDocumentWithRelations = Prisma.BillingDocumentGetPayload<{
  include: {
    location: { select: { id: true; name: true } };
    orderLinks: { include: { order: { select: { id: true; createdAt: true; total: true } } } };
    payments: { select: { id: true; orderId: true; amount: true; method: true } };
  };
}>;

@Injectable()
export class BillingDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    user: User,
    query: ListBillingDocumentsDto,
  ) {
    const locationId = await resolveLocationScope(
      this.prisma,
      tenantId,
      user,
      query.locationId,
    );
    const dateRange = parseBogotaDateRange(query.from, query.to);
    const scopeWhere = this.buildWhere(tenantId, locationId, dateRange);
    const where: Prisma.BillingDocumentWhereInput = {
      ...scopeWhere,
      ...(query.status ? { status: query.status } : {}),
      ...this.searchWhere(query.search),
    };
    const page = parseInteger(query.page, 1, 'page');
    const pageSize = parseInteger(query.pageSize, 25, 'pageSize');
    if (pageSize > 100) {
      throw new BadRequestException('Page size cannot exceed 100.');
    }
    const skip = (page - 1) * pageSize;

    const [documents, total, statusGroups] = await Promise.all([
      this.prisma.billingDocument.findMany({
        where,
        include: {
          location: { select: { id: true, name: true } },
          orderLinks: {
            include: { order: { select: { id: true, createdAt: true, total: true } } },
          },
          payments: { select: { id: true, orderId: true, amount: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.billingDocument.count({ where }),
      this.prisma.billingDocument.groupBy({
        by: ['status'],
        where: scopeWhere,
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(BILLING_STATUSES.map((status) => [status, 0])) as Record<
      BillingDocumentStatus,
      number
    >;
    for (const group of statusGroups) {
      counts[group.status] = group._count._all;
    }

    return {
      items: documents.map((document) => this.toListItem(document)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        byStatus: counts,
      },
    };
  }

  async getOne(tenantId: string, user: User, documentId: string) {
    const locationId = await resolveLocationScope(this.prisma, tenantId, user);
    const document = await this.prisma.billingDocument.findFirst({
      where: { id: documentId, tenantId, ...(locationId ? { locationId } : {}) },
      include: {
        location: { select: { id: true, name: true } },
        orderLinks: {
          include: {
            order: {
              select: { id: true, createdAt: true, total: true, isPaid: true, status: true },
            },
          },
        },
        payments: {
          select: { id: true, orderId: true, amount: true, method: true, status: true, createdAt: true },
        },
      },
    });
    if (!document) {
      throw new NotFoundException('Billing document not found for this tenant.');
    }

    return {
      ...this.toListItem(document),
      type: document.type,
      countryCode: document.countryCode,
      providerReferenceId: document.providerReferenceId,
      requestPayload: document.requestPayload,
      responseMetadata: document.responseMetadata,
      orderLinks: document.orderLinks.map(({ order }) => order),
      payments: document.payments,
    };
  }

  private buildWhere(
    tenantId: string,
    locationId: string | undefined,
    range: ReturnType<typeof parseBogotaDateRange>,
  ): Prisma.BillingDocumentWhereInput {
    return {
      tenantId,
      ...(locationId ? { locationId } : {}),
      ...(range.start || range.endExclusive
        ? {
            createdAt: {
              ...(range.start ? { gte: range.start } : {}),
              ...(range.endExclusive ? { lt: range.endExclusive } : {}),
            },
          }
        : {}),
    };
  }

  private searchWhere(searchValue?: string): Prisma.BillingDocumentWhereInput {
    const search = searchValue?.trim();
    if (!search) return {};
    return {
      OR: [
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { providerReferenceId: { contains: search, mode: 'insensitive' } },
        { referenceCode: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        {
          orderLinks: {
            some: { order: { id: { contains: search, mode: 'insensitive' } } },
          },
        },
        { payments: { some: { orderId: { contains: search, mode: 'insensitive' } } } },
      ],
    };
  }

  private toListItem(document: BillingDocumentWithRelations): BillingDocumentListItem {
    const payload = jsonRecord(document.requestPayload);
    const customer = jsonRecord(payload?.customer);
    const customerName = readString(customer?.names) ?? readString(customer?.company);
    const customerIdentification = readString(customer?.identification);
    const paymentDetails = Array.isArray(payload?.paymentDetails) ? payload.paymentDetails : [];
    const amount = paymentDetails.reduce<number>((sum, value) => {
      const payment = jsonRecord(value);
      const paymentAmount = Number(payment?.amount);
      return Number.isFinite(paymentAmount) ? sum + paymentAmount : sum;
    }, 0);
    const orderIds = [
      ...new Set([
        ...document.orderLinks.map(({ orderId }) => orderId),
        ...document.payments.map(({ orderId }) => orderId),
        ...(document.orderId ? [document.orderId] : []),
      ]),
    ];

    return {
      id: document.id,
      locationId: document.locationId,
      locationName: document.location.name,
      status: document.status,
      providerName: document.providerName,
      documentNumber: document.documentNumber,
      cufe: document.cufe,
      referenceCode: document.referenceCode,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      errorCode: document.errorCode,
      errorMessage: document.errorMessage,
      orderIds,
      customerName,
      customerIdentification,
      totalAmount: amount > 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : null,
    };
  }
}

function parseInteger(value: string | undefined, defaultValue: number, name: string): number {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${name} must be a positive integer.`);
  }
  return parsed;
}

function jsonRecord(value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
