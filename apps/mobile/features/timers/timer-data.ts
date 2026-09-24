import type { Session } from "../../core/session";

export interface TimerStatus {
  active: boolean;
  deviceId?: string;
  action?: string;
  angle?: number;
  finishesAt?: string;
  remainingSeconds: number;
}

export async function fetchDeviceTimer(
  session: Session,
  householdId: string,
  deviceId: string,
): Promise<TimerStatus> {
  const data = await session.get(
    `/households/${householdId}/devices/${deviceId}/timer`,
  );
  return data as TimerStatus;
}

export async function setDeviceTimer(
  session: Session,
  householdId: string,
  deviceId: string,
  durationMinutes: number,
  action: string,
  angle?: number,
): Promise<TimerStatus> {
  const data = await session.post(
    `/households/${householdId}/devices/${deviceId}/timer`,
    { durationMinutes, action, ...(angle !== undefined ? { angle } : {}) },
  );
  return data as TimerStatus;
}

export async function cancelDeviceTimer(
  session: Session,
  householdId: string,
  deviceId: string,
): Promise<TimerStatus> {
  const data = await session.delete(
    `/households/${householdId}/devices/${deviceId}/timer`,
  );
  return data as TimerStatus;
}
