import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  readonly currentPassword!: string;

  @IsString()
  @MinLength(6)
  readonly newPassword!: string;
}
