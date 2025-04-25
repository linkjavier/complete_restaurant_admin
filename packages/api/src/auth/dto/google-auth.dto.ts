import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ example: 'google_id_token' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
} 