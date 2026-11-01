import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CountInventoryItemDto {
  @IsIn(['INGREDIENT', 'PRODUCT'])
  itemType: 'INGREDIENT' | 'PRODUCT';

  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @Min(0)
  countedQuantity: number;
}
