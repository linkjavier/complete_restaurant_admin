import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class UpdateIngredientCategoryDto {
  @IsString()
  @Matches(/\S/)
  @ValidateIf((_, value) => value !== undefined)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
