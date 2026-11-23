import { IsBoolean, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveWhatsappCloudIntegrationDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsNotEmpty()
  phoneNumberId: string;

  @IsString()
  @IsNotEmpty()
  wabaId: string;

  @IsString()
  @MinLength(20)
  accessToken: string;
}

export class WhatsappCloudConversationActionDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @MaxLength(4096)
  message: string;
}

export class WhatsappCloudAiToggleDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsBoolean()
  aiEnabled: boolean;
}
