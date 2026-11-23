import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem as InventoryItemModel, Prisma, User, UserRole } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateInventoryModificationDto } from './dto/create-inventory-modification.dto';
import { CountInventoryItemDto } from './dto/count-inventory-item.dto';

const MAX_TAKE = 100;
const DEFAULT_TAKE = 50;

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async stockOverview(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Query('locationId') requestedLocationId?: string,
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.locationId) {
      throw new ForbiddenException('Tu usuario no tiene una sucursal asignada');
    }

    return this.inventoryService.findStockOverview(
      tenantId,
      user.role === UserRole.SUPER_ADMIN ? requestedLocationId : (user.locationId ?? undefined),
    );
  }

  @Get('modifications')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async findModifications(@CurrentTenant() tenantId: string, @CurrentUser() user: User) {
    const locationId = this.getUserLocationScope(user);
    return this.inventoryService.findModifications(tenantId, locationId);
  }

  @Get('modifications/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async findModification(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    const modification = await this.inventoryService.findModification(
      id,
      tenantId,
      this.getUserLocationScope(user),
    );
    if (!modification) {
      throw new NotFoundException('No se encontró la modificación');
    }
    return modification;
  }

  @Post('modifications')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async createModification(
    @Body() data: CreateInventoryModificationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    const assignedLocationId = this.getUserLocationScope(user);
    return this.inventoryService.createModification({
      tenantId,
      locationId: assignedLocationId ?? data.locationId,
      createdById: user.id,
      notes: data.notes,
    });
  }

  @Post('modifications/:id/items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async countModificationItem(
    @Param('id') modificationId: string,
    @Body() data: CountInventoryItemDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.countModificationItem({
      modificationId,
      tenantId,
      locationId: this.getUserLocationScope(user),
      itemId: data.itemId,
      itemType: data.itemType,
      countedQuantity: data.countedQuantity,
      countedById: user.id,
    });
  }

  @Delete('modifications/:id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async removeModificationItem(
    @Param('id') modificationId: string,
    @Param('itemId') itemId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.removeModificationItem({
      modificationId,
      itemId,
      tenantId,
      locationId: this.getUserLocationScope(user),
    });
  }

  @Post('modifications/:id/apply')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async applyModification(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    return this.inventoryService.applyModification({
      id,
      tenantId,
      locationId: this.getUserLocationScope(user),
      appliedById: user.id,
    });
  }

  private getUserLocationScope(user: User): string | undefined {
    if (user.role === UserRole.SUPER_ADMIN) return undefined;
    if (!user.locationId) {
      throw new ForbiddenException('Tu usuario no tiene una sucursal asignada');
    }
    return user.locationId;
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
}
