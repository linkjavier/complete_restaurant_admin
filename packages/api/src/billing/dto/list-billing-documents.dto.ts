import { BillingDocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ListBillingDocumentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationId?: string;

  @IsOptional()
  @IsEnum(BillingDocumentStatus)
  status?: BillingDocumentStatus;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{0,5}$/)
  page?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{0,2}$/)
  pageSize?: string;
}
