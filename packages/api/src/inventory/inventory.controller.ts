import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem as InventoryItemModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  async create(@Body() data: Prisma.InventoryItemCreateInput): Promise<InventoryItemModel> {
    return this.inventoryService.createInventoryItem(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<InventoryItemModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.InventoryItemWhereInput;
      orderBy?: Prisma.InventoryItemOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.inventoryService.inventoryItems(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<InventoryItemModel | null> {
    return this.inventoryService.inventoryItem({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.InventoryItemUpdateInput,
  ): Promise<InventoryItemModel> {
    return this.inventoryService.updateInventoryItem({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<InventoryItemModel> {
    return this.inventoryService.deleteInventoryItem({ id });
  }
} 