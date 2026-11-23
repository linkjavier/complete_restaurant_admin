import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateLocationDto } from './dto/create-location.dto';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('locations')
@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) { }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las ubicaciones' })
  @ApiResponse({ status: 200, description: 'Lista de ubicaciones' })
  async findAll(@CurrentTenant() tenantId: string) {
    return this.locationsService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una ubicación por ID' })
  @ApiResponse({ status: 200, description: 'Ubicación encontrada' })
  @ApiResponse({ status: 404, description: 'Ubicación no encontrada' })
  async findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    const location = await this.locationsService.findOne(id, tenantId);
    if (!location) {
      throw new NotFoundException(`Ubicación con ID ${id} no encontrada`);
    }
    return location;
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva ubicación' })
  @ApiResponse({ status: 201, description: 'Ubicación creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() data: CreateLocationDto, @CurrentTenant() tenantId: string) {
    return this.locationsService.create(data, tenantId);
  }

  @Post('first')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create and assign the Super Admin first location' })
  async createFirst(
    @Body() data: CreateLocationDto,
    @CurrentTenant() tenantId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.locationsService.createAndAssignToSuperAdmin(
      data,
      tenantId,
      req.user.id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una ubicación' })
  @ApiResponse({ status: 200, description: 'Ubicación actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Ubicación no encontrada' })
  async update(@Param('id') id: string, @Body() data: Partial<CreateLocationDto>, @CurrentTenant() tenantId: string) {
    const location = await this.locationsService.findOne(id, tenantId);
    if (!location) {
      throw new NotFoundException(`Ubicación con ID ${id} no encontrada`);
    }
    return this.locationsService.update(id, data, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una ubicación' })
  @ApiResponse({ status: 200, description: 'Ubicación eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Ubicación no encontrada' })
  async remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    const location = await this.locationsService.findOne(id, tenantId);
    if (!location) {
      throw new NotFoundException(`Ubicación con ID ${id} no encontrada`);
    }
    return this.locationsService.remove(id, tenantId);
  }
} 