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
import { IngredientsService } from './ingredients.service';
import { Ingredient as IngredientModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  async create(@Body() data: Prisma.IngredientCreateInput): Promise<IngredientModel> {
    return this.ingredientsService.createIngredient(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<IngredientModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.IngredientWhereInput;
      orderBy?: Prisma.IngredientOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.ingredientsService.ingredients(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IngredientModel | null> {
    return this.ingredientsService.ingredient({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.IngredientUpdateInput,
  ): Promise<IngredientModel> {
    return this.ingredientsService.updateIngredient({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<IngredientModel> {
    return this.ingredientsService.deleteIngredient({ id });
  }
} 