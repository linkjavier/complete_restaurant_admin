import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async create(createLocationDto: CreateLocationDto) {
    return this.prisma.location.create({
      data: createLocationDto,
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

  async updateLocation(data: { id: string; name?: string; address?: string; phone?: string }) {
    const { id, ...updateData } = data;
    return this.prisma.location.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteLocation({ id }: { id: string }) {
    return this.prisma.location.delete({
      where: { id },
    });
  }
} 