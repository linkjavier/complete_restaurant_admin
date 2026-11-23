import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInventoryModificationDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
