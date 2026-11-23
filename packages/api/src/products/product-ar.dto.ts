import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ModelScaleDto {
  @IsNumber()
  @Min(0.1)
  @Max(10)
  x: number;

  @IsNumber()
  @Min(0.1)
  @Max(10)
  y: number;

  @IsNumber()
  @Min(0.1)
  @Max(10)
  z: number;
}

export class UpdateProductArDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  model3dUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  modelUsdzUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  modelThumbnailUrl?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ModelScaleDto)
  modelScale?: ModelScaleDto | null;

  @IsOptional()
  @IsIn(['floor', 'wall'])
  arPlacement?: string;
}
