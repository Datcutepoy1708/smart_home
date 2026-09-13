import { ApiError } from "../../core/api-client";
import { isRecord } from "../../core/session";
export interface Device {
  id: string;
  name: string;
  room: string | null;
  deviceType: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  readings: {
    metric: string;
    value: number;
    unit: string;
    recordedAt: string;
  }[];
}
export function parseDevices(value: unknown): {
  items: Device[];
  nextCursor: string | null;
} {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !(value.nextCursor === null || typeof value.nextCursor === "string") ||
    !value.items.every(
      (d) =>
        isRecord(d) &&
        typeof d.id === "string" &&
        typeof d.name === "string" &&
        typeof d.deviceType === "string" &&
        typeof d.isOnline === "boolean" &&
        (d.room === null || typeof d.room === "string") &&
        (d.lastSeenAt === null ||
          (typeof d.lastSeenAt === "string" &&
            Number.isFinite(Date.parse(d.lastSeenAt)))) &&
        Array.isArray(d.readings) &&
        d.readings.every(
          (r) =>
            isRecord(r) &&
            typeof r.metric === "string" &&
            typeof r.value === "number" &&
            Number.isFinite(r.value) &&
            typeof r.unit === "string" &&
            typeof r.recordedAt === "string" &&
            Number.isFinite(Date.parse(r.recordedAt)),
        ),
    )
  )
    throw new ApiError("Invalid device response.");
  return value as unknown as { items: Device[]; nextCursor: string | null };
}
