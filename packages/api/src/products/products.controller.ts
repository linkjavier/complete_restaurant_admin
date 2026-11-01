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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateProductDto, UpdateProductDto } from './product.dto';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto, @CurrentTenant() tenantId: string) {
    return this.productsService.create(createProductDto, tenantId);
  }

  @Public()
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll({
      tenantId,
      locationId,
      categoryId,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentTenant() tenantId: string,
  ) {
    if (updateProductDto.quantity !== undefined) {
      throw new BadRequestException(
        'Para modificar existencias, crea una modificación desde el módulo Inventarios.',
      );
    }
    return this.productsService.update(id, updateProductDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
