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
  title: string;

  @IsNotEmpty()
  @IsUUID()
  workspaceId: string;

  @IsOptional()
  @IsString()
  content?: string; // Rich text content (HTML or JSON string)

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
