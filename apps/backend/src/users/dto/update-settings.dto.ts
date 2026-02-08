import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  readonly language?: string;

  @IsOptional()
  @IsString()
  readonly timezone?: string;

  @IsOptional()
  @IsBoolean()
  readonly emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly realtimeNotifications?: boolean;
}
