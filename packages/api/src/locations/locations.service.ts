import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Prisma } from '@prisma/client';
import { HereService } from '../ai/services/here.service';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class LocationsService {
  constructor(
    private prisma: PrismaService,
    private hereService: HereService,
  ) { }

  private async validateAndEnrichAddress(data: Partial<CreateLocationDto>) {
    if (data.address) {
      // Build search string with city and country if available for better precision
      const searchQuery = [data.address, data.city, data.country].filter(Boolean).join(', ');
      const validation = await this.hereService.validateAddress(searchQuery);

      if (!validation.isValid) {
        throw new BadRequestException(`No se pudo validar la dirección: "${searchQuery}". Por favor, verifica que sea correcta y específica.`);
      }

      // If valid, enrich the data with coordinates and normalized address if desired
      data.latitude = validation.lat;
      data.longitude = validation.lng;
      // We could also overwrite data.address with validation.formattedAddress if we want to normalize it
      // For now, let's just store the coordinates and keep the user's address.
    }
  }

  async create(data: CreateLocationDto, tenantId: string) {
    await this.validateAndEnrichAddress(data);
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
    await this.validateAndEnrichAddress(data);
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