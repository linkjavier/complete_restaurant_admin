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
  BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem as InventoryItemModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

const MAX_TAKE = 100;
const DEFAULT_TAKE = 50;

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  async create(@Body() data: Prisma.InventoryItemCreateInput): Promise<InventoryItemModel> {
    return this.inventoryService.createInventoryItem(data);
  }

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ): Promise<InventoryItemModel[]> {
    const tenantId = (req as any).tenantId;

    const params: {
      skip?: number;
      take?: number;
      where: Prisma.InventoryItemWhereInput;
    } = {
      where: {
        ingredient: { tenantId },
      },
    };

    if (skip !== undefined) {
      const parsedSkip = parseInt(skip, 10);
      if (!Number.isInteger(parsedSkip) || parsedSkip < 0) {
        throw new BadRequestException('skip must be a non-negative integer');
      }
      params.skip = parsedSkip;
    }

    if (take !== undefined) {
      const parsedTake = parseInt(take, 10);
      if (!Number.isInteger(parsedTake) || parsedTake < 1 || parsedTake > MAX_TAKE) {
        throw new BadRequestException(`take must be an integer between 1 and ${MAX_TAKE}`);
      }
      params.take = parsedTake;
    } else {
      params.take = DEFAULT_TAKE;
    }

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
