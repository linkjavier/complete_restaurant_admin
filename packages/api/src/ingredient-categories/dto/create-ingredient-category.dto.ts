import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateIngredientCategoryDto {
  @IsString()
  @Matches(/\S/)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
