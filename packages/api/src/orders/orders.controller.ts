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
import { OrdersService } from './orders.service';
import { Order as OrderModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body() data: Prisma.OrderCreateInput): Promise<OrderModel> {
    return this.ordersService.createOrder(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<OrderModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.OrderWhereInput;
      orderBy?: Prisma.OrderOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.ordersService.orders(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<OrderModel | null> {
    return this.ordersService.order({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.OrderUpdateInput,
  ): Promise<OrderModel> {
    return this.ordersService.updateOrder({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<OrderModel> {
    return this.ordersService.deleteOrder({ id });
  }
} 