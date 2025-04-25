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
import { ProductsService } from './products.service';
import { Product as ProductModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() data: Prisma.ProductCreateInput): Promise<ProductModel> {
    return this.productsService.createProduct(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<ProductModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.ProductWhereInput;
      orderBy?: Prisma.ProductOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.productsService.products(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProductModel | null> {
    return this.productsService.product({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.ProductUpdateInput,
  ): Promise<ProductModel> {
    return this.productsService.updateProduct({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ProductModel> {
    return this.productsService.deleteProduct({ id });
  }
} 