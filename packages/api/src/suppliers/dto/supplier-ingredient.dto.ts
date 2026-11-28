import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SupplierIngredientDto {
  @IsString()
  ingredientId: string;

  @IsString()
  @IsOptional()
  supplierSku?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @IsString()
  @IsOptional()
  packaging?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumOrderQuantity?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
