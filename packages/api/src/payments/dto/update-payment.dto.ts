import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class UpdatePaymentDto {
  @IsString()
  @IsOptional()
  orderId?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;
} 