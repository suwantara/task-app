import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @IsNotEmpty()
  @MaxLength(128)
  readonly password!: string;
}
