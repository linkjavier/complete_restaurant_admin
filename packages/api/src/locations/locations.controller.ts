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
  Request,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Location as LocationModel, Prisma } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateLocationDto } from './dto/create-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('locations')
@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({ status: 201, description: 'Location created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all locations' })
  @ApiResponse({ status: 200, description: 'Return all locations' })
  async findAll(@Request() req) {
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return this.locationsService.findAll();
    }
    return this.locationsService.findByUser(req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get location by id' })
  @ApiResponse({ status: 200, description: 'Return location by id' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return this.locationsService.findOne(id);
    }
    return this.locationsService.findOneByUser(id, req.user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; address?: string; phone?: string },
  ): Promise<LocationModel> {
    return this.locationsService.updateLocation({
      id,
      ...data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<LocationModel> {
    return this.locationsService.deleteLocation({ id });
  }
} 