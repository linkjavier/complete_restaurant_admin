import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBillingLocationConfigurationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuerLegalName?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5,15}$/)
  issuerTaxId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d$/)
  issuerTaxIdDv?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  establishmentName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  establishmentAddress?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  establishmentMunicipalityCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  establishmentPhone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  establishmentEmail?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  numberingRangeId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  factusClientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  factusClientSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  factusUsername?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  factusPassword?: string;
}
