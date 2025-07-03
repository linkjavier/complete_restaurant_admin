import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateLocationDto, tenantId: string) {
    return this.prisma.location.create({
      data: { ...data, tenant: { connect: { id: tenantId } } },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.location.findMany({ where: { tenantId } });
  }

  async findByUser(userId: string) {
    return this.prisma.location.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
    });
  }

  async findOne(id: string, tenantId: string): Promise<any> {
    return this.prisma.location.findFirst({ where: { id, tenantId } });
  }

  async findOneByUser(id: string, userId: string) {
    return this.prisma.location.findFirst({
      where: {
        id,
        users: {
          some: {
            id: userId,
          },
        },
      },
    });
  }

  async update(id: string, data: Partial<CreateLocationDto>, tenantId: string) {
    return this.prisma.location.update({
      where: { id, tenantId },
      data,
    });
  }

  async remove(id: string, tenantId: string) {
    return this.prisma.location.delete({
      where: { id, tenantId },
    });
  }
} 