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
} from '@nestjs/common';
import { TablesService } from './tables.service';
import { Table as TableModel, Prisma } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tables')
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  async create(@Body() data: Prisma.TableCreateInput): Promise<TableModel> {
    return this.tablesService.createTable(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<TableModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.TableWhereInput;
      orderBy?: Prisma.TableOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.tablesService.tables(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TableModel | null> {
    return this.tablesService.table({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.TableUpdateInput,
  ): Promise<TableModel> {
    return this.tablesService.updateTable({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<TableModel> {
    return this.tablesService.deleteTable({ id });
  }

  @Get(':id/qr-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
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