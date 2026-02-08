import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateBoardDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsUUID()
  readonly workspaceId: string;
}
