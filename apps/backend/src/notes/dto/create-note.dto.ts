import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsJSON,
} from 'class-validator';

export class CreateNoteDto {
  @IsNotEmpty()
  @IsString()
  readonly title!: string;

  @IsNotEmpty()
  @IsUUID()
  readonly workspaceId!: string;

  @IsOptional()
  @IsString()
  readonly content?: string; // Rich text content (HTML or JSON string)

  @IsOptional()
  @IsString()
  readonly emoji?: string;

  @IsOptional()
  @IsUUID()
  readonly parentId?: string;
}
