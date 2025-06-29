import { Controller, Get, Post, Body, Param, Delete, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

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
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('locationId') locationId: string, @Req() req) {
    const effectiveLocationId = locationId || req.user?.locationId;
    return this.customersService.findAll(effectiveLocationId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Post('seed/:locationId')
  @UseGuards(JwtAuthGuard)
  seedCustomers(@Param('locationId') locationId: string) {
    return this.customersService.seedCustomers(locationId);
  }

  @Post('sync-whatsapp/:locationId')
  @UseGuards(JwtAuthGuard)
  syncFromWhatsApp(@Param('locationId') locationId: string) {
    return this.customersService.syncFromWhatsApp(locationId);
  }
} 