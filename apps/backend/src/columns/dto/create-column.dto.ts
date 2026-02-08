import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateColumnDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsUUID()
  readonly boardId: string;

  @IsOptional()
  @IsNumber()
  readonly order?: number;
}
