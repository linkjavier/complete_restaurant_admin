import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingRequestStatus,
  OrderStatus,
  Table,
  Prisma,
  Order,
  Notification,
  NotificationType,
  User,
  UserRole,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'tables',
})
export class TablesService {
  @WebSocketServer()
  server: Server;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async table(tableWhereUniqueInput: Prisma.TableWhereUniqueInput): Promise<Table | null> {
    return this.prisma.table.findUnique({
      where: tableWhereUniqueInput,
    });
  }

  async tables(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.TableWhereUniqueInput;
    where?: Prisma.TableWhereInput;
    orderBy?: Prisma.TableOrderByWithRelationInput;
  }): Promise<Table[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.table.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  async create(data: {
    number: number;
    seats: number;
    locationId: string;
    tenantId: string;
  }): Promise<Table> {
    const location = await this.prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) {
      throw new NotFoundException(`Ubicación con ID ${data.locationId} no encontrada`);
    }
    return this.prisma.table.create({
      data: {
        number: data.number,
        seats: data.seats,
        location: { connect: { id: data.locationId } },
        tenant: { connect: { id: data.tenantId } },
      },
    });
  }

  async update(
    id: string,
    data: { number?: number; seats?: number; locationId?: string },
  ): Promise<Table> {
    try {
      if (data.locationId) {
        // Verificar si la nueva ubicación existe
        const location = await this.prisma.location.findUnique({
          where: { id: data.locationId },
        });

        if (!location) {
          throw new NotFoundException(`Ubicación con ID ${data.locationId} no encontrada`);
        }
      }

      return await this.prisma.table.update({
        where: { id },
        data: {
          number: data.number,
          seats: data.seats,
          ...(data.locationId && {
            location: {
              connect: {
                id: data.locationId,
              },
            },
          }),
        },
        include: {
          location: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<Table> {
    try {
      return await this.prisma.table.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
        }
      }
      throw error;
    }
  }

  async generateQRCode(tableId: string): Promise<string> {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      throw new NotFoundException(`Table with ID ${tableId} not found`);
    }

    // Generate QR code data with table and location information
    const qrData = JSON.stringify({
      tableId: table.id,
      tableNumber: table.number,
      locationId: table.locationId,
    });

    // Update table with QR code
    await this.prisma.table.update({
      where: { id: tableId },
      data: { qrCode: qrData },
    });

    return qrData;
  }

  async getTableByQRData(qrData: string): Promise<Table> {
    const table = await this.prisma.table.findUnique({
      where: { qrCode: qrData },
      include: {
        location: true,
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  async createWaiterCall(tableId: string): Promise<Notification> {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: {
        location: true,
      },
    });

    if (!table) {
      throw new NotFoundException(`Table with ID ${tableId} not found`);
    }

    // Find all waiters in the location
    const waiters = await this.prisma.user.findMany({
      where: {
        locationId: table.locationId,
        role: 'WAITER',
      },
    });

    // Create notifications for all waiters
    const notifications = await Promise.all(
      waiters.map((waiter) =>
        this.prisma.notification.create({
          data: {
            userId: waiter.id,
            type: NotificationType.WAITER_CALL,
            message: `Table ${table.number} is calling for service`,
          },
        }),
      ),
    );

    // Emit real-time update
    this.server.emit('waiterCalled', {
      tableId,
      tableNumber: table.number,
      locationId: table.locationId,
    });

    return notifications[0];
  }

  async findAll(params?: { where?: Prisma.TableWhereInput }): Promise<Table[]> {
    return this.prisma.table.findMany({
      where: params?.where,
      include: {
        location: true,
      },
    });
  }

  async findOne(id: string): Promise<Table> {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        location: true,
      },
    });

    if (!table) {
      throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
    }

    return table;
  }

  async getActiveShift(tenantId: string, user: User, requestedLocationId?: string) {
    const locationId = user.role === UserRole.SUPER_ADMIN ? requestedLocationId : user.locationId;
    if (!locationId) {
      throw new BadRequestException('Select a location to view its active shift.');
    }
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      requestedLocationId &&
      requestedLocationId !== user.locationId
    ) {
      throw new ForbiddenException("Location is outside the user's assigned location.");
    }

    await this.assertShiftLocationAccess(tenantId, user, locationId);
    return this.prisma.tableShift.findFirst({
      where: { tenantId, locationId, endedAt: null },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getTableShiftActivity(tenantId: string, user: User, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId },
      select: { id: true, locationId: true, lastAccountClosedAt: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found for this tenant.');
    }

    const shift = await this.getActiveShift(tenantId, user, table.locationId);
    if (!shift) {
      return {
        shift: null,
        orders: [],
        openAccountStartedAt: null,
        openAccountOrderCount: 0,
        openAccountTotal: 0,
      };
    }

    const [orders, openAccount] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          tableId,
          type: 'TABLE',
          AND: [
            {
              OR: [
                { createdAt: { gte: shift.startedAt } },
                { tableAccountSession: { is: { shiftId: shift.id } } },
              ],
            },
            { OR: [{ isDeleted: false }, { isDeleted: null }] },
          ],
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              product: true,
              variants: { include: { productVariant: true } },
            },
          },
          payments: true,
          tableAccountSession: {
            select: { id: true, startedAt: true, endedAt: true, orderCount: true, total: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.aggregate({
        where: {
          tenantId,
          tableId,
          type: 'TABLE',
          tableAccountSessionId: null,
          AND: [
            { createdAt: { gte: shift.startedAt } },
            ...(table.lastAccountClosedAt
              ? [{ createdAt: { gt: table.lastAccountClosedAt } }]
              : []),
          ],
          OR: [{ isDeleted: false }, { isDeleted: null }],
        },
        _count: { _all: true },
        _min: { createdAt: true },
        _sum: { total: true },
      }),
    ]);

    return {
      shift,
      orders,
      openAccountStartedAt: openAccount._min.createdAt,
      openAccountOrderCount: openAccount._count._all,
      openAccountTotal: openAccount._sum.total ?? 0,
    };
  }

  async closeAccountForPos(
    tenantId: string,
    user: User,
    tableId: string,
    allowIncompleteOrders = false,
  ): Promise<{ tableId: string; closedAt: Date; closedOrderCount: number }> {
    return this.prisma.$transaction(async (transaction) => {
      const table = await transaction.table.findFirst({
        where: { id: tableId, tenantId },
        select: { id: true, locationId: true, lastAccountClosedAt: true },
      });
      if (!table) {
        throw new NotFoundException('Table not found for this tenant.');
      }
      if (user.tenantId !== tenantId) {
        throw new ForbiddenException('User does not belong to this tenant.');
      }
      if (user.role !== UserRole.SUPER_ADMIN && user.locationId !== table.locationId) {
        throw new ForbiddenException("Table is outside the user's assigned location.");
      }

      const orders = await transaction.order.findMany({
        where: {
          tenantId,
          tableId,
          type: 'TABLE',
          isDeleted: { not: true },
          status: { not: OrderStatus.CANCELLED },
          ...(table.lastAccountClosedAt ? { createdAt: { gt: table.lastAccountClosedAt } } : {}),
        },
        select: {
          id: true,
          status: true,
          isPaid: true,
          billingRequestStatus: true,
          createdAt: true,
          total: true,
        },
      });
      if (orders.length === 0) {
        throw new BadRequestException('There is no open account to close for this table.');
      }
      if (orders.some((order) => !order.isPaid)) {
        throw new BadRequestException('Pay every order on the table before closing its account.');
      }
      if (
        !allowIncompleteOrders &&
        orders.some(
          (order) => order.status !== OrderStatus.READY && order.status !== OrderStatus.DELIVERED,
        )
      ) {
        throw new BadRequestException(
          'Complete every order on the table before closing its account, or confirm closing the fully paid account with orders still in progress.',
        );
      }
      if (
        orders.some((order) => order.billingRequestStatus === BillingRequestStatus.NOT_REQUESTED)
      ) {
        throw new BadRequestException(
          'Choose a normal receipt or process electronic billing before closing the account.',
        );
      }

      const closedAt = new Date();
      const shift = await transaction.tableShift.findFirst({
        where: { tenantId, locationId: table.locationId, endedAt: null },
        select: { id: true },
      });
      const session = await transaction.tableAccountSession.create({
        data: {
          tenantId,
          locationId: table.locationId,
          tableId,
          shiftId: shift?.id,
          closedById: user.id,
          startedAt: new Date(Math.min(...orders.map((order) => order.createdAt.getTime()))),
          endedAt: closedAt,
          orderCount: orders.length,
          total: orders.reduce((sum, order) => sum + (order.total ?? 0), 0),
        },
      });
      await transaction.order.updateMany({
        where: {
          tenantId,
          tableId,
          id: { in: orders.map((order) => order.id) },
        },
        data: { tableAccountSessionId: session.id },
      });
      await transaction.table.update({
        where: { id: tableId },
        data: { lastAccountClosedAt: closedAt },
      });

      return { tableId, closedAt, closedOrderCount: orders.length };
    });
  }

  private async assertShiftLocationAccess(
    tenantId: string,
    user: User,
    locationId: string,
  ): Promise<void> {
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('User does not belong to this tenant.');
    }
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found for this tenant.');
    }
    if (user.role !== UserRole.SUPER_ADMIN && user.locationId !== locationId) {
      throw new ForbiddenException("Location is outside the user's assigned location.");
    }
  }
}
