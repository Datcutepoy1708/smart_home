import { HouseholdRole } from '@prisma/client';

export class CreateInviteCodeDto {
  role?: HouseholdRole = HouseholdRole.MEMBER;
  validHours?: number = 24;
}

export class JoinHouseholdDto {
  code!: string;
}

export class UpdateMemberRoleDto {
  role!: HouseholdRole;
  expiresAt?: string | null;
}

export class CreateHouseholdDto {
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
