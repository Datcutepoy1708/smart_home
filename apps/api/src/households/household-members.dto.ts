import { HouseholdRole } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateInviteCodeDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(HouseholdRole)
  role?: HouseholdRole = HouseholdRole.MEMBER;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  validHours?: number = 24;
}

export class JoinHouseholdDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class UpdateMemberRoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(HouseholdRole)
  role!: HouseholdRole;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

export class CreateHouseholdDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export interface HouseholdMemberItemDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: HouseholdRole;
  joinedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  isCurrent: boolean;
}

export interface InviteCodeResponseDto {
  code: string;
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  expiresAt: string;
}
