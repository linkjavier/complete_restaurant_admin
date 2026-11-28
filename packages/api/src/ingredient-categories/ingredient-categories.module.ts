import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IngredientCategoriesController } from './ingredient-categories.controller';
import { IngredientCategoriesService } from './ingredient-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [IngredientCategoriesController],
  providers: [IngredientCategoriesService],
  exports: [IngredientCategoriesService],
})
export class IngredientCategoriesModule {}
