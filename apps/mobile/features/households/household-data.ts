import type { Session } from "../../core/session";

export type HouseholdRole = "OWNER" | "MEMBER" | "GUEST";

export interface HouseholdMemberItem {
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

export interface InviteCodeData {
  code: string;
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  expiresAt: string;
}

export interface JoinHouseholdResult {
  success: boolean;
  householdId: string;
  householdName: string;
  role: string;
}

export async function fetchHouseholdMembers(
  session: Session,
  householdId: string,
): Promise<HouseholdMemberItem[]> {
  const data = await session.get(`/households/${householdId}/members`);
  return (data as { members: HouseholdMemberItem[] }).members;
}

export async function createInviteCode(
  session: Session,
  householdId: string,
  role: HouseholdRole = "MEMBER",
  validHours = 24,
): Promise<InviteCodeData> {
  const data = await session.post(`/households/${householdId}/invites`, {
    role,
    validHours,
  });
  return data as InviteCodeData;
}

export async function joinHouseholdByCode(
  session: Session,
  code: string,
): Promise<JoinHouseholdResult> {
  const data = await session.post("/households/join", {
    code: code.trim().toUpperCase(),
  });
  return data as JoinHouseholdResult;
}

export async function updateMemberRole(
  session: Session,
  householdId: string,
  memberId: string,
  role: HouseholdRole,
  expiresAt?: string | null,
): Promise<{ id: string; role: HouseholdRole; expiresAt: string | null }> {
  const data = await session.patch(
    `/households/${householdId}/members/${memberId}`,
    { role, expiresAt },
  );
  return data as { id: string; role: HouseholdRole; expiresAt: string | null };
}

export async function removeMember(
  session: Session,
  householdId: string,
  memberId: string,
): Promise<{ success: boolean; memberId: string }> {
  const data = await session.delete(
    `/households/${householdId}/members/${memberId}`,
  );
  return data as { success: boolean; memberId: string };
}

export async function createHousehold(
  session: Session,
  name: string,
): Promise<{ id: string; name: string; role: string }> {
  const data = await session.post("/households", { name: name.trim() });
  return data as { id: string; name: string; role: string };
}
