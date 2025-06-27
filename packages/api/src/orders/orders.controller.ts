import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Request } from 'express';


@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Public()
  @Get()
  findAll(
    @Query('locationId') locationId?: string,
    @Query('tableId') tableId?: string,
    @Query('kitchen') kitchen?: boolean,
  ) {
    if (!kitchen && !tableId) {
      throw new BadRequestException('tableId is required for non-kitchen requests');
    }
    return this.ordersService.findAll(locationId, tableId, kitchen);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch(':orderId/items/:itemId/status')
  updateItemStatus(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body('status') status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED',
  ) {
    return this.ordersService.updateItemStatus(orderId, itemId, status);
  }

  @Patch(':id/delete')
  removeSoft(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.ordersService.remove(id, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Get('/deleted/list')
  findDeleted(@Query('locationId') locationId?: string) {
    return this.ordersService.findDeleted(locationId);
  }
} 