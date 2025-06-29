import { Controller, Get, Post, Body, Param, Delete, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  findAll(@Query('locationId') locationId: string, @Req() req) {
    const effectiveLocationId = locationId || req.user?.locationId;
    return this.customersService.findAll(effectiveLocationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Post('seed/:locationId')
  seedCustomers(@Param('locationId') locationId: string) {
    return this.customersService.seedCustomers(locationId);
  }

  @Post('sync-whatsapp/:locationId')
  syncFromWhatsApp(@Param('locationId') locationId: string) {
    return this.customersService.syncFromWhatsApp(locationId);
  }
} 