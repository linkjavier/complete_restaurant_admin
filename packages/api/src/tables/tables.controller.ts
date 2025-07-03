import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TablesService } from './tables.service';
import { Table as TableModel, Prisma } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Request } from 'express';


@ApiTags('tables')
@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new table' })
  @ApiResponse({ status: 201, description: 'Table created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() data: { number: number; seats: number; locationId: string }) {
    // Obtener tenantId a partir de locationId
    const location = await this.tablesService['prisma'].location.findUnique({ where: { id: data.locationId } });
    if (!location) throw new Error('Location not found');
    return this.tablesService.create({ ...data, tenantId: location.tenantId });
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get all tables' })
  @ApiResponse({ status: 200, description: 'Return all tables' })
  async findAll(@Req() req: Request) {
    const tenantId = (req as any).tenantId;
    return this.tablesService.findAll({ where: { tenantId } });
  }

  @Public()
  @Get(':id')
  // @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get table by id' })
  @ApiResponse({ status: 200, description: 'Return table by id' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async findOne(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update table' })
  @ApiResponse({ status: 200, description: 'Table updated successfully' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async update(
    @Param('id') id: string,
    @Body() data: { number?: number; seats?: number; locationId?: string },
  ) {
    return this.tablesService.update(id, data);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Delete table' })
  @ApiResponse({ status: 200, description: 'Table deleted successfully' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async remove(@Param('id') id: string) {
    return this.tablesService.delete(id);
  }

  @Get(':id/qr-code')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAITER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate QR code for a table' })
  @ApiResponse({ status: 200, description: 'QR code generated successfully' })
  async generateQRCode(@Param('id') id: string) {
    return this.tablesService.generateQRCode(id);
  }

  @Get('qr/:qrData')
  @ApiOperation({ summary: 'Get table information by QR code data' })
  @ApiResponse({ status: 200, description: 'Table information retrieved successfully' })
  async getTableByQRData(@Param('qrData') qrData: string) {
    return this.tablesService.getTableByQRData(qrData);
  }

  @Post(':id/call-waiter')
  @ApiOperation({ summary: 'Call a waiter to a specific table' })
  @ApiResponse({ status: 201, description: 'Waiter call created successfully' })
  async createWaiterCall(@Param('id') id: string) {
    return this.tablesService.createWaiterCall(id);
  }
} 