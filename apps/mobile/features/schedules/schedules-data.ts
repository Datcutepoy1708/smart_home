import type { Session } from "../../core/session";

export interface ScheduleItem {
  id: string;
  householdId: string;
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  room?: string;
  name: string;
  time: string; // "HH:mm"
  action: 'turn_on' | 'turn_off' | 'open' | 'close' | 'set_angle';
  params: Record<string, unknown>;
  repeatDays: number[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateScheduleInput {
  deviceId: string;
  name?: string;
  time: string; // "HH:mm"
  action: 'turn_on' | 'turn_off' | 'open' | 'close' | 'set_angle';
  params?: Record<string, unknown>;
  repeatDays?: number[];
  isActive?: boolean;
}

export async function fetchSchedules(
  session: Session,
  householdId: string,
): Promise<ScheduleItem[]> {
  const data = await session.get(`/households/${householdId}/schedules`);
  return Array.isArray(data) ? (data as ScheduleItem[]) : [];
}

export async function createScheduleApi(
  session: Session,
  householdId: string,
  input: CreateScheduleInput,
): Promise<ScheduleItem> {
  const res = await session.post(`/households/${householdId}/schedules`, input);
  return res as ScheduleItem;
}

export async function toggleSchedule(
  session: Session,
  householdId: string,
  scheduleId: string,
  isActive: boolean,
): Promise<ScheduleItem> {
  const res = await session.patch(
    `/households/${householdId}/schedules/${scheduleId}`,
    { isActive },
  );
  return res as ScheduleItem;
}

export async function deleteScheduleApi(
  session: Session,
  householdId: string,
  scheduleId: string,
): Promise<void> {
  await session.delete(`/households/${householdId}/schedules/${scheduleId}`);
}

export async function triggerScheduleApi(
  session: Session,
  householdId: string,
  scheduleId: string,
): Promise<unknown> {
  return await session.post(
    `/households/${householdId}/schedules/${scheduleId}/trigger`,
  );
}

export function formatRepeatDays(repeatDays: number[]): string {
  if (!repeatDays || repeatDays.length === 0) return 'Một lần';
  if (repeatDays.length === 7) return 'Hàng ngày';
  if (
    repeatDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => repeatDays.includes(d))
  )
    return 'Thứ 2 - Thứ 6';
  if (repeatDays.length === 2 && repeatDays.includes(6) && repeatDays.includes(7))
    return 'Cuối tuần (T7, CN)';

  const dayNames: Record<number, string> = {
    1: 'T2',
    2: 'T3',
    3: 'T4',
    4: 'T5',
    5: 'T6',
    6: 'T7',
    7: 'CN',
  };
  return repeatDays
    .sort()
    .map((d) => dayNames[d] || `${d}`)
    .join(', ');
}
