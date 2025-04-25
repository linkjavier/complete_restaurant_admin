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
import { CategoriesService } from './categories.service';
import { Category as CategoryModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Body() data: Prisma.CategoryCreateInput): Promise<CategoryModel> {
    return this.categoriesService.createCategory(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<CategoryModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.CategoryWhereInput;
      orderBy?: Prisma.CategoryOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.categoriesService.categories(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CategoryModel | null> {
    return this.categoriesService.category({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.CategoryUpdateInput,
  ): Promise<CategoryModel> {
    return this.categoriesService.updateCategory({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<CategoryModel> {
    return this.categoriesService.deleteCategory({ id });
  }
} 