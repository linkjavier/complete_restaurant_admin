import { IsString, IsArray, ValidateNested, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export enum OrderType {
  TABLE = 'TABLE',
  TAKEOUT = 'TAKEOUT',
  DELIVERY = 'DELIVERY'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  TRANSFER = 'TRANSFER'
}

export enum OrderSource {
  POS = 'POS',
  QR = 'QR',
  WHATSAPP = 'WHATSAPP'
}

class OrderItemVariantDto {
  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsString()
  @IsOptional()
  groupName?: string;
}

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  quantity: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemVariantDto)
  variants: OrderItemVariantDto[];
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

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsEnum(OrderType)
  @IsNotEmpty()
  type: OrderType;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsEnum(OrderSource)
  source: OrderSource;

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}