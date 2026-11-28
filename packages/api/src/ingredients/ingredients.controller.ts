import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { ApiTags } from '@nestjs/swagger';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';

@ApiTags('ingredients')
@Controller('ingredients')
@UseGuards(JwtAuthGuard, TenantRequiredGuard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  create(@Body() createIngredientDto: CreateIngredientDto, @CurrentTenant() tenantId: string) {
    return this.ingredientsService.create({ ...createIngredientDto, tenantId });
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.ingredientsService.findAll({ where: { tenantId } });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateIngredientDto: UpdateIngredientDto,
    @CurrentTenant() tenantId: string,
  ) {
    if (updateIngredientDto.quantity !== undefined) {
      throw new BadRequestException(
        'Para modificar existencias, crea una modificación desde el módulo Inventarios.',
      );
    }
    return this.ingredientsService.update(id, updateIngredientDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }
}
