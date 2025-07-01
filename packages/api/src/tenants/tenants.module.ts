import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TenantsController],
  providers: [PrismaService],
})
export class TenantsModule {} 