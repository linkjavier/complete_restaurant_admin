import { Controller, Get, Post, Body, Param, Delete, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Public()
  @Get('test')
  test() {
    return { message: 'Customers controller is working' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createCustomerDto: CreateCustomerDto, @CurrentTenant() tenantId: string) {
    return this.customersService.create(createCustomerDto, tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('locationId') locationId: string, @CurrentTenant() tenantId: string) {
    return this.customersService.findAll(locationId, tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.customersService.findOne(id, tenantId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @CurrentTenant() tenantId: string) {
    return this.customersService.update(id, updateCustomerDto, tenantId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.customersService.remove(id, tenantId);
  }

  @Post('seed/:locationId')
  @UseGuards(JwtAuthGuard)
  seedCustomers(@Param('locationId') locationId: string, @CurrentTenant() tenantId: string) {
    return this.customersService.seedCustomers(locationId, tenantId);
  }

  @Post('sync-whatsapp/:locationId')
  @UseGuards(JwtAuthGuard)
  syncFromWhatsApp(@Param('locationId') locationId: string, @CurrentTenant() tenantId: string) {
    return this.customersService.syncFromWhatsApp(locationId, tenantId);
  }
} 