import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SupplierIngredientDto } from './dto/supplier-ingredient.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, TenantRequiredGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.findAll(tenantId, search, includeInactive === 'true');
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateSupplierDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  archive(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.archive(tenantId, id);
  }

  @Post(':id/ingredients')
  saveIngredient(
    @CurrentTenant() tenantId: string,
    @Param('id') supplierId: string,
    @Body() dto: SupplierIngredientDto,
  ) {
    return this.service.saveIngredient(tenantId, supplierId, dto);
  }

  @Delete(':id/ingredients/:ingredientId')
  removeIngredient(
    @CurrentTenant() tenantId: string,
    @Param('id') supplierId: string,
    @Param('ingredientId') ingredientId: string,
  ) {
    return this.service.removeIngredient(tenantId, supplierId, ingredientId);
  }
}
