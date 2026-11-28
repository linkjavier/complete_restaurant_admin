import { IsBoolean, IsEmail, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class UpdateSupplierDto {
  @IsString()
  @Matches(/\S/)
  @ValidateIf((_, value) => value !== undefined)
  name?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsEmail()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
