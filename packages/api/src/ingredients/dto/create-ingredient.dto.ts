import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  unit: string;

  @IsNumber()
  @Min(0)
  minQuantity: number;

  @IsString()
  locationId: string;
} 