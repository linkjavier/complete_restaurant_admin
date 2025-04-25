import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Table, Prisma, Order, Notification, NotificationType } from '@prisma/client';
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

  async table(
    tableWhereUniqueInput: Prisma.TableWhereUniqueInput,
  ): Promise<Table | null> {
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

  async createTable(data: Prisma.TableCreateInput): Promise<Table> {
    return this.prisma.table.create({
      data,
    });
  }

  async updateTable(params: {
    where: Prisma.TableWhereUniqueInput;
    data: Prisma.TableUpdateInput;
  }): Promise<Table> {
    const { where, data } = params;
    return this.prisma.table.update({
      data,
      where,
    });
  }

  async deleteTable(where: Prisma.TableWhereUniqueInput): Promise<Table> {
    return this.prisma.table.delete({
      where,
    });
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
} 