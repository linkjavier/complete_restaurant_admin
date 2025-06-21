import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateLocationDto) {
    return this.prisma.location.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.location.findMany();
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

  async findOne(id: string) {
    return this.prisma.location.findUnique({
      where: { id },
    });
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

  async update(id: string, data: Partial<CreateLocationDto>) {
    return this.prisma.location.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.location.delete({
      where: { id },
    });
  }
} 