import { IsEnum, IsOptional, IsBoolean, IsInt, IsDateString, Min } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class CreateInviteLinkDto {
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}

export class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  role: MemberRole;
}
