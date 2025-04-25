import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateIngredientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minQuantity?: number;

  @IsString()
  @IsOptional()
  locationId?: string;
} 