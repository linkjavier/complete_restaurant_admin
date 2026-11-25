import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DeclaredPaymentAmounts = Record<PaymentMethod, number>;

const paymentMethods = Object.values(PaymentMethod);

function emptyPaymentAmounts(): DeclaredPaymentAmounts {
  return {
    [PaymentMethod.CASH]: 0,
    [PaymentMethod.CREDIT_CARD]: 0,
    [PaymentMethod.DEBIT_CARD]: 0,
    [PaymentMethod.QR]: 0,
    [PaymentMethod.TRANSFER]: 0,
  };
}

@Injectable()
export class PosShiftService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(tenantId: string, user: User, locationId?: string) {
    const scopedLocationId = this.getScopedLocationId(user, locationId);
    await this.assertLocationAccess(tenantId, user, scopedLocationId);
    const [shift, settings] = await Promise.all([
      this.prisma.tableShift.findFirst({
        where: { tenantId, locationId: scopedLocationId, endedAt: null },
        include: {
          openedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.settings.findUnique({
        where: {
          tenantId_locationId: { tenantId, locationId: scopedLocationId },
        },
        select: { defaultOpeningCash: true },
      }),
    ]);

    return {
      shift,
      defaultOpeningCash: settings?.defaultOpeningCash ?? 0,
    };
  }

  async openShift(
    tenantId: string,
    user: User,
    locationId: string,
    openingCash: number,
  ) {
    if (!locationId?.trim()) {
      throw new BadRequestException('Selecciona una sede antes de abrir el turno.');
    }
    await this.assertLocationAccess(tenantId, user, locationId);
    this.assertNonNegativeAmount(openingCash, 'Opening cash');
    try {
      const shift = await this.prisma.tableShift.create({
        data: {
          tenantId,
          locationId,
          openedById: user.id,
          openingCash,
        },
        include: {
          openedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return shift;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un turno abierto para esta sede.');
      }
      throw error;
    }
  }

  async getShiftSummary(tenantId: string, user: User, shiftId: string) {
    const shift = await this.getOwnedShift(tenantId, user, shiftId);
    if (shift.endedAt) {
      throw new ConflictException('El turno ya está cerrado.');
    }
    return this.buildSummary(shift);
  }

  async closeShift(
    tenantId: string,
    user: User,
    shiftId: string,
    declaredAmounts: Partial<DeclaredPaymentAmounts>,
    discrepancyNote?: string,
  ) {
    if (!declaredAmounts || typeof declaredAmounts !== 'object') {
      throw new BadRequestException('Declara los valores de cierre por medio de pago.');
    }
    const shift = await this.getOwnedShift(tenantId, user, shiftId);
    if (shift.endedAt) {
      throw new ConflictException('El turno ya está cerrado.');
    }

    const summary = await this.buildSummary(shift);
    const declared = emptyPaymentAmounts();
    for (const method of paymentMethods) {
      const amount = declaredAmounts[method];
      this.assertNonNegativeAmount(amount, `Declared ${method}`);
      declared[method] = amount;
    }

    const variance = emptyPaymentAmounts();
    for (const method of paymentMethods) {
      variance[method] = this.roundMoney(
        declared[method] - summary.expectedAmounts[method],
      );
    }
    const hasDiscrepancy = paymentMethods.some(
      (method) => Math.abs(variance[method]) >= 0.01,
    );
    if (hasDiscrepancy && !discrepancyNote?.trim()) {
      throw new BadRequestException(
        'Agrega una nota para explicar las diferencias del cierre.',
      );
    }

    const endedAt = new Date();
    const result = await this.prisma.tableShift.updateMany({
      where: { id: shiftId, tenantId, endedAt: null },
      data: {
        endedAt,
        closedById: user.id,
        closingDeclared: declared,
        closingExpected: summary.expectedAmounts,
        closingVariance: variance,
        closingNote: discrepancyNote?.trim() || null,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('El turno fue cerrado por otro usuario.');
    }

    const closedShift = await this.prisma.tableShift.findUnique({
      where: { id: shiftId },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return {
      shift: closedShift,
      expectedAmounts: summary.expectedAmounts,
      declaredAmounts: declared,
      variance,
      orderCount: summary.orderCount,
      paymentCount: summary.paymentCount,
      collectedTotal: summary.collectedTotal,
    };
  }

  async requireOpenShift(tenantId: string, locationId: string) {
    const shift = await this.prisma.tableShift.findFirst({
      where: { tenantId, locationId, endedAt: null },
      select: { id: true, locationId: true },
    });
    if (!shift) {
      throw new BadRequestException(
        'No hay un turno abierto para esta sede. Abre un turno desde el POS para continuar.',
      );
    }
    return shift;
  }

  private async buildSummary(shift: {
    id: string;
    tenantId: string;
    locationId: string;
    startedAt: Date;
    openingCash: number;
  }) {
    const [payments, orderCount] = await Promise.all([
      this.prisma.payment.findMany({
        where: { shiftId: shift.id, status: PaymentStatus.COMPLETED },
        select: { method: true, amount: true },
      }),
      this.prisma.order.count({
        where: {
          tenantId: shift.tenantId,
          locationId: shift.locationId,
          source: 'POS',
          createdAt: { gte: shift.startedAt },
          isDeleted: { not: true },
        },
      }),
    ]);
    const expectedAmounts = emptyPaymentAmounts();
    for (const payment of payments) {
      expectedAmounts[payment.method] = this.roundMoney(
        expectedAmounts[payment.method] + payment.amount,
      );
    }
    expectedAmounts[PaymentMethod.CASH] = this.roundMoney(
      expectedAmounts[PaymentMethod.CASH] + shift.openingCash,
    );

    return {
      shift,
      expectedAmounts,
      orderCount,
      paymentCount: payments.length,
      collectedTotal: this.roundMoney(
        payments.reduce((total, payment) => total + payment.amount, 0),
      ),
    };
  }

  private async getOwnedShift(tenantId: string, user: User, shiftId: string) {
    const shift = await this.prisma.tableShift.findFirst({
      where: { id: shiftId, tenantId },
    });
    if (!shift) {
      throw new NotFoundException('Turno no encontrado para este negocio.');
    }
    await this.assertLocationAccess(tenantId, user, shift.locationId);
    return shift;
  }

  private getScopedLocationId(user: User, requestedLocationId?: string) {
    const locationId =
      user.role === UserRole.SUPER_ADMIN ? requestedLocationId : user.locationId;
    if (!locationId) {
      throw new BadRequestException('Selecciona una sede antes de continuar.');
    }
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      requestedLocationId &&
      requestedLocationId !== user.locationId
    ) {
      throw new ForbiddenException('La sede no corresponde a tu usuario.');
    }
    return locationId;
  }

  private async assertLocationAccess(
    tenantId: string,
    user: User,
    locationId: string,
  ): Promise<void> {
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('El usuario no pertenece a este negocio.');
    }
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.locationId !== locationId
    ) {
      throw new ForbiddenException('La sede no corresponde a tu usuario.');
    }
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('La sede no existe para este negocio.');
    }
  }

  private assertNonNegativeAmount(
    amount: number | undefined,
    label: string,
  ): asserts amount is number {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException(`${label} must be a non-negative number.`);
    }
  }

  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
}
