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

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private normalizeString(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  async findNearestLocation(tenantId: string, lat: number, lng: number, city?: string) {
    const locations = await this.prisma.location.findMany({
      where: {
        tenantId,
      },
    });

    if (locations.length === 0) return null;

    let filteredLocations = locations;
    if (city) {
      const normalizedCity = this.normalizeString(city);
      filteredLocations = locations.filter(loc =>
        loc.city && this.normalizeString(loc.city) === normalizedCity
      );
    }

    if (filteredLocations.length === 0) return null;

    let nearest = filteredLocations[0];
    let minDistance = this.calculateDistance(lat, lng, nearest.latitude || 0, nearest.longitude || 0);

    for (let i = 1; i < filteredLocations.length; i++) {
      const loc = filteredLocations[i];
      const distance = this.calculateDistance(lat, lng, loc.latitude || 0, loc.longitude || 0);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = loc;
      }
    }

    return {
      location: nearest,
      distance: minDistance,
    };
  }

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