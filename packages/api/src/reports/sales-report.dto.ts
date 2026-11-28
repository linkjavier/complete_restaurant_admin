import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class SalesReportQueryDto {
  @IsDateString({ strict: true })
  from!: string;

  @IsDateString({ strict: true })
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationId?: string;
}
