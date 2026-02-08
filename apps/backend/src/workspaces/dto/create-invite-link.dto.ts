import { IsEnum, IsOptional, IsBoolean, IsInt, IsDateString, Min } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class CreateInviteLinkDto {
  @IsOptional()
  @IsEnum(MemberRole)
  readonly role?: MemberRole;

  @IsOptional()
  @IsDateString()
  readonly expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly maxUses?: number;
}

export class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  readonly role!: MemberRole;
}
