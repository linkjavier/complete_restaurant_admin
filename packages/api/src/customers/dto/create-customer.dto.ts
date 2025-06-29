import { IsString, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  whatsappId?: string;

  @IsString()
  locationId: string;
} 