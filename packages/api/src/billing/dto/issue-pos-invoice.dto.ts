import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class BillingCustomerDto {
  @IsString()
  @IsNotEmpty()
  identificationDocumentCode: string;

  @IsString()
  @IsNotEmpty()
  identification: string;

  @IsString()
  @IsNotEmpty()
  legalOrganizationCode: string;

  @ValidateIf((customer: BillingCustomerDto) => customer.legalOrganizationCode === '1')
  @IsString()
  @IsNotEmpty()
  company?: string;

  @ValidateIf((customer: BillingCustomerDto) => customer.legalOrganizationCode === '2')
  @IsString()
  @IsNotEmpty()
  names?: string;

  @IsOptional()
  @IsString()
  dv?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tributeCode?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  @IsOptional()
  @IsString()
  municipalityCode?: string;
}

export class IssuePosInvoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderIds: string[];

  @ValidateNested()
  @Type(() => BillingCustomerDto)
  customer: BillingCustomerDto;
}

export class DeclineTableInvoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderIds: string[];
}

export class IssueSplitPaymentInvoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  paymentIds: string[];

  @ValidateNested()
  @Type(() => BillingCustomerDto)
  customer: BillingCustomerDto;
}

export class DeclineSplitPaymentInvoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  paymentIds: string[];
}
