import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body('name') name: string) {
    // Evitar duplicados
    let tenant = await this.prisma.tenant.findFirst({ where: { name } });
    if (!tenant) {
      tenant = await this.prisma.tenant.create({ data: { name } });
    }
    return tenant;
  }

  @Get()
  async find(@Query('name') name?: string) {
    if (name) {
      return this.prisma.tenant.findMany({ where: { name } });
    }
    return this.prisma.tenant.findMany();
  }
} 