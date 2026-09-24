import { ApiError } from "../../core/api-client";

export interface AutomationRule {
  id: string;
  householdId: string;
  name: string;
  condition: {
    metric?: string;
    operator?: string;
    value?: number | string;
    deviceId?: string;
  };
  action: {
    targetDeviceId?: string;
    action?: string;
    params?: Record<string, unknown>;
  };
  isActive: boolean;
  createdAt: string;
}

export async function fetchRules(
  session: { get: (path: string) => Promise<unknown> },
  householdId: string
): Promise<AutomationRule[]> {
  const raw = await session.get(`/households/${householdId}/rules`);
  if (!Array.isArray(raw)) {
    throw new ApiError("Dữ liệu tự động hoá không hợp lệ.");
  }
  return raw as AutomationRule[];
}

export async function toggleRule(
  session: { patch: (path: string, body: unknown) => Promise<unknown> },
  householdId: string,
  ruleId: string,
  isActive: boolean
): Promise<AutomationRule> {
  const raw = await session.patch(`/households/${householdId}/rules/${ruleId}`, {
    isActive,
  });
  return raw as AutomationRule;
}

export async function createRuleApi(
  session: { post: (path: string, body: unknown) => Promise<unknown> },
  householdId: string,
  payload: {
    name: string;
    condition: Record<string, unknown>;
    action: Record<string, unknown>;
    isActive?: boolean;
  }
): Promise<AutomationRule> {
  const raw = await session.post(`/households/${householdId}/rules`, payload);
  return raw as AutomationRule;
}

export async function deleteRuleApi(
  session: { delete: (path: string) => Promise<unknown> },
  householdId: string,
  ruleId: string
): Promise<void> {
  await session.delete(`/households/${householdId}/rules/${ruleId}`);
}
