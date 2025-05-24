import { IsString, IsArray, ValidateNested, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@prisma/client';

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsEnum(OrderType)
  @IsNotEmpty()
  type: OrderType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}