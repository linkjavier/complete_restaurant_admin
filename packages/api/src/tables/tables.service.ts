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

  async create(data: { number: number; seats: number; locationId: string }): Promise<Table> {
    // Verificar si la ubicación existe
    const location = await this.prisma.location.findUnique({
      where: { id: data.locationId },
    });

    if (!location) {
      throw new NotFoundException(`Ubicación con ID ${data.locationId} no encontrada`);
    }

    return this.prisma.table.create({
      data: {
        number: data.number,
        seats: data.seats,
        location: {
          connect: {
            id: data.locationId,
          },
        },
      },
    });
  }

  async update(id: string, data: { number?: number; seats?: number; locationId?: string }): Promise<Table> {
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

  async findAll(): Promise<Table[]> {
    return this.prisma.table.findMany({
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
} 