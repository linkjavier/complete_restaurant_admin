import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category as CategoryModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async createCategory(
    @Body() categoryData: { name: string; description?: string },
    @Req() req: Request,
  ): Promise<CategoryModel> {
    const tenantId = (req as any).tenantId;
    return this.categoriesService.createCategory({
      name: categoryData.name,
      description: categoryData.description,
      tenantId,
    });
  }

  @Patch('order')
  updateOrder(@Body() body: { orderedIds: string[] }) {
    return this.categoriesService.updateOrder(body.orderedIds);
  }

  @Get()
  async getCategories(@Req() req: Request): Promise<CategoryModel[]> {
    const tenantId = (req as any).tenantId;
    return this.categoriesService.categories({ where: { tenantId } });
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: string): Promise<CategoryModel> {
    return this.categoriesService.category({ id });
  }

  @Patch(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() categoryData: { name?: string; description?: string },
  ): Promise<CategoryModel> {
    return this.categoriesService.updateCategory({
      where: { id },
      data: categoryData,
    });
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: string): Promise<CategoryModel> {
    return this.categoriesService.deleteCategory({ id });
  }
} 