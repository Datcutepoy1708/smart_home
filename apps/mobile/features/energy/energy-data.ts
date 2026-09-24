import type { Session } from "../../core/session";

export interface EnergySummary {
  today: {
    kwh: number;
    costVnd: number;
    diffPercent: number;
    runningHours: number;
  };
  thisMonth: {
    kwh: number;
    costVnd: number;
    projectedCostVnd: number;
    currentTier: number;
    tierPrice: number;
    nextTierKwh: number;
  };
  activePowerWatts: number;
  activeDeviceCount: number;
  totalDeviceCount: number;
}

export interface EnergyChartPoint {
  label: string;
  kwh: number;
  costVnd: number;
  timestamp: string;
  isPeak?: boolean;
}

export interface EnergyChartData {
  range: "today" | "week" | "month";
  points: EnergyChartPoint[];
  totalKwh: number;
  totalCostVnd: number;
  peakHour?: string;
}

export interface DeviceEnergyItem {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  room?: string | null;
  wattage: number;
  runningMinutes: number;
  kwh: number;
  costVnd: number;
  percentage: number;
  isCurrentlyOn: boolean;
}

export interface DeviceEnergyBreakdown {
  period: "today" | "week" | "month";
  devices: DeviceEnergyItem[];
  totalKwh: number;
  totalCostVnd: number;
}

export async function fetchEnergySummary(
  session: Session,
  householdId: string,
): Promise<EnergySummary> {
  const data = await session.get(`/households/${householdId}/energy/summary`);
  return data as EnergySummary;
}

export async function fetchEnergyChart(
  session: Session,
  householdId: string,
  range: "today" | "week" | "month" = "today",
): Promise<EnergyChartData> {
  const data = await session.get(
    `/households/${householdId}/energy/chart?range=${range}`,
  );
  return data as EnergyChartData;
}

export async function fetchEnergyBreakdown(
  session: Session,
  householdId: string,
  period: "today" | "week" | "month" = "today",
): Promise<DeviceEnergyBreakdown> {
  const data = await session.get(
    `/households/${householdId}/energy/breakdown?period=${period}`,
  );
  return data as DeviceEnergyBreakdown;
}

export async function updateDeviceWattage(
  session: Session,
  householdId: string,
  deviceId: string,
  wattage: number,
): Promise<{ success: boolean; deviceId: string; wattage: number }> {
  const data = await session.patch(
    `/households/${householdId}/energy/devices/${deviceId}/power`,
    { wattage },
  );
  return data as { success: boolean; deviceId: string; wattage: number };
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}
