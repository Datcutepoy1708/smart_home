export interface EnergySummaryDto {
  today: {
    kwh: number;
    costVnd: number;
    diffPercent: number; // vs yesterday (+15% or -10%)
    runningHours: number;
  };
  thisMonth: {
    kwh: number;
    costVnd: number;
    projectedCostVnd: number;
    currentTier: number; // 1 to 6
    tierPrice: number;   // VND per kWh in current tier
    nextTierKwh: number; // remaining kWh before jumping to next tier
  };
  activePowerWatts: number;
  activeDeviceCount: number;
  totalDeviceCount: number;
}

export interface EnergyChartPoint {
  label: string;       // e.g. "08:00", "T2", "15/09"
  kwh: number;
  costVnd: number;
  timestamp: string;
  isPeak?: boolean;
}

export interface EnergyChartResponseDto {
  range: 'today' | 'week' | 'month';
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

export interface DeviceEnergyBreakdownResponseDto {
  period: 'today' | 'week' | 'month';
  devices: DeviceEnergyItem[];
  totalKwh: number;
  totalCostVnd: number;
}

export class UpdateDevicePowerDto {
  wattage!: number;
}
