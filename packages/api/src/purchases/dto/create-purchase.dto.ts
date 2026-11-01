import { IsString, IsOptional, IsNumber, IsISO8601, ValidateNested, ArrayMinSize, IsNotEmpty } from 'class-validator'
import { Type } from 'class-transformer'
import { CreatePurchaseItemDto } from './create-purchase-item.dto'

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  supplierName: string

  @IsString()
  @IsNotEmpty()
  locationId: string

  @IsISO8601()
  purchaseDate: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalCost?: number

  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  @ArrayMinSize(1)
  items: CreatePurchaseItemDto[]
}
