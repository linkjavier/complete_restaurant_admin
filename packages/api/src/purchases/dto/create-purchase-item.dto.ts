import { IsString, IsNumber, IsPositive, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreatePurchaseItemDto {
  @IsString()
  ingredientId: string

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost: number
}
