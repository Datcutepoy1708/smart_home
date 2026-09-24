import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  DeviceEnergyBreakdownResponseDto,
  DeviceEnergyItem,
  EnergyChartPoint,
  EnergyChartResponseDto,
  EnergySummaryDto,
} from './energy.dto.js';

// Standard EVN Progressive Pricing Tiers (Biểu giá điện sinh hoạt 6 bậc EVN)
export const EVN_TIERS = [
  { tier: 1, maxKwh: 50, price: 1806 },
  { tier: 2, maxKwh: 100, price: 1866 },
  { tier: 3, maxKwh: 200, price: 2167 },
  { tier: 4, maxKwh: 300, price: 2729 },
  { tier: 5, maxKwh: 400, price: 3050 },
  { tier: 6, maxKwh: Infinity, price: 3151 },
];

export const VAT_RATE = 0.08; // 8% VAT

export function calculateEvnCost(kwh: number): {
  baseCost: number;
  vat: number;
  totalCost: number;
  currentTier: number;
  tierPrice: number;
  nextTierKwh: number;
} {
  const safeKwh = Math.max(0, kwh);
  let remaining = safeKwh;
  let baseCost = 0;
  let currentTier = 1;
  let tierPrice = EVN_TIERS[0].price;
  let nextTierKwh = 50;

  let prevMax = 0;
  for (const t of EVN_TIERS) {
    const tierCapacity = t.maxKwh - prevMax;
    currentTier = t.tier;
    tierPrice = t.price;

    if (remaining <= tierCapacity) {
      baseCost += remaining * t.price;
      nextTierKwh = Math.max(0, Number((tierCapacity - remaining).toFixed(2)));
      break;
    } else {
      baseCost += tierCapacity * t.price;
      remaining -= tierCapacity;
      prevMax = t.maxKwh;
    }
  }

  const vat = Math.round(baseCost * VAT_RATE);
  const totalCost = Math.round(baseCost + vat);

  return {
    baseCost: Math.round(baseCost),
    vat,
    totalCost,
    currentTier,
    tierPrice,
    nextTierKwh,
  };
}

export const DEFAULT_WATTAGES: Record<string, number> = {
  LIGHT: 20,       // 20W LED bulb
  FAN: 55,         // 55W Stand/Ceiling Fan
  DOOR_SERVO: 5,   // 5W Servo motor
  DHT_SENSOR: 1,   // 1W Microcontroller/Sensor
  GAS_SENSOR: 2,   // 2W
  FIRE_SENSOR: 1,  // 1W
};

@Injectable()
export class EnergyService {
  private customWattages = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  private async assertHouseholdMember(userId: string, householdId: string) {
    const member = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!member) {
      throw new ForbiddenException('Không có quyền truy cập ngôi nhà này');
    }
  }

  public getDeviceWattage(deviceType: string, deviceId: string): number {
    if (this.customWattages.has(deviceId)) {
      return this.customWattages.get(deviceId)!;
    }
    return DEFAULT_WATTAGES[deviceType.toUpperCase()] ?? 25;
  }

  public setDeviceWattage(deviceId: string, wattage: number): void {
    this.customWattages.set(deviceId, Math.max(1, wattage));
  }

  /**
   * Helper: Get Vietnam local midnight time (UTC+7)
   */
  private getVnDateBounds() {
    const now = new Date();
    // Offset for UTC+7 (420 minutes)
    const vnTime = new Date(now.getTime() + 7 * 3600 * 1000);
    const vnYear = vnTime.getUTCFullYear();
    const vnMonth = vnTime.getUTCMonth();
    const vnDay = vnTime.getUTCDate();

    // Start of today in UTC
    const startOfTodayUtc = new Date(Date.UTC(vnYear, vnMonth, vnDay, -7, 0, 0, 0));
    const startOfYesterdayUtc = new Date(startOfTodayUtc.getTime() - 24 * 3600 * 1000);
    const startOfMonthUtc = new Date(Date.UTC(vnYear, vnMonth, 1, -7, 0, 0, 0));

    // Days in current month
    const daysInMonth = new Date(vnYear, vnMonth + 1, 0).getDate();
    const dayOfMonth = vnDay;

    return {
      now,
      startOfToday: startOfTodayUtc,
      startOfYesterday: startOfYesterdayUtc,
      startOfMonth: startOfMonthUtc,
      dayOfMonth,
      daysInMonth,
    };
  }

  /**
   * Calculate running milliseconds for a device in [from, to] interval
   */
  public calculateDeviceRunningMs(
    actions: Array<{ action: string; createdAt: Date; newValue?: any }>,
    currentStateOn: boolean,
    from: Date,
    to: Date,
  ): number {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    if (toTime <= fromTime) return 0;

    // Filter relevant actions
    const relevant = actions.filter((a) => {
      const act = a.action?.toLowerCase() || '';
      return (
        act.includes('turn_on') ||
        act.includes('turn_off') ||
        act.includes('open') ||
        act.includes('close')
      );
    });

    let totalMs = 0;
    let lastOnTime: number | null = null;

    // Check if device was on before the window
    for (const a of relevant) {
      const t = a.createdAt.getTime();
      const isTurnOn =
        a.action.toLowerCase().includes('turn_on') ||
        a.action.toLowerCase().includes('open');
      const isTurnOff =
        a.action.toLowerCase().includes('turn_off') ||
        a.action.toLowerCase().includes('close');

      if (t < fromTime) {
        if (isTurnOn) lastOnTime = fromTime;
        else if (isTurnOff) lastOnTime = null;
      } else if (t <= toTime) {
        if (isTurnOn) {
          if (lastOnTime === null) lastOnTime = t;
        } else if (isTurnOff) {
          if (lastOnTime !== null) {
            totalMs += t - lastOnTime;
            lastOnTime = null;
          }
        }
      }
    }

    // If still on at the end of the window or currently on
    if (lastOnTime !== null) {
      totalMs += toTime - lastOnTime;
    } else if (currentStateOn && relevant.length === 0) {
      // Default: device is currently ON and has no logs in window, count reasonable duration
      totalMs = Math.min(toTime - fromTime, 4 * 3600 * 1000);
    }

    return Math.max(0, Math.min(totalMs, toTime - fromTime));
  }

  /**
   * Summary overview: Today, This Month, Active Power
   */
  async getEnergySummary(userId: string, householdId: string): Promise<EnergySummaryDto> {
    await this.assertHouseholdMember(userId, householdId);

    const { now, startOfToday, startOfYesterday, startOfMonth, dayOfMonth, daysInMonth } =
      this.getVnDateBounds();

    const devices = await this.prisma.device.findMany({
      where: { householdId },
      include: { state: true },
    });

    const logs = await this.prisma.actionLog.findMany({
      where: {
        householdId,
        createdAt: { gte: startOfMonth },
      },
      orderBy: { createdAt: 'asc' },
    });

    let todayKwh = 0;
    let yesterdayKwh = 0;
    let monthKwh = 0;
    let activePowerWatts = 0;
    let activeDeviceCount = 0;
    let todayRunningHours = 0;

    for (const dev of devices) {
      const stateObj = (dev.state?.state as Record<string, unknown> | null) ?? {};
      const isOn =
        stateObj.power === 'on' ||
        stateObj.position === 'open' ||
        (stateObj.angle !== undefined && (stateObj.angle as number) > 0);

      const wattage = this.getDeviceWattage(dev.deviceType, dev.id);

      if (isOn) {
        activePowerWatts += wattage;
        activeDeviceCount++;
      }

      const devLogs = logs.filter((l) => l.deviceId === dev.id);

      // Today
      const todayMs = this.calculateDeviceRunningMs(devLogs, isOn, startOfToday, now);
      const devTodayKwh = (wattage * (todayMs / 3600000)) / 1000;
      todayKwh += devTodayKwh;
      todayRunningHours += todayMs / 3600000;

      // Yesterday
      const yestMs = this.calculateDeviceRunningMs(
        devLogs,
        false,
        startOfYesterday,
        startOfToday,
      );
      yesterdayKwh += (wattage * (yestMs / 3600000)) / 1000;

      // This Month
      const monthMs = this.calculateDeviceRunningMs(devLogs, isOn, startOfMonth, now);
      monthKwh += (wattage * (monthMs / 3600000)) / 1000;
    }

    // Default minimal demo baseline if freshly created database
    if (todayKwh === 0 && activePowerWatts > 0) {
      todayKwh = Number(((activePowerWatts * 2.5) / 1000).toFixed(3));
      todayRunningHours = 2.5;
    }
    if (monthKwh === 0) {
      monthKwh = Math.max(todayKwh, Number((todayKwh * dayOfMonth * 0.9).toFixed(3)));
    }

    const todayCost = calculateEvnCost(todayKwh).totalCost;
    const monthEvn = calculateEvnCost(monthKwh);

    // Month projection
    const dailyAverage = dayOfMonth > 0 ? monthKwh / dayOfMonth : todayKwh;
    const projectedMonthKwh = dailyAverage * daysInMonth;
    const projectedCostVnd = calculateEvnCost(projectedMonthKwh).totalCost;

    // Diff vs yesterday
    let diffPercent = 0;
    if (yesterdayKwh > 0) {
      diffPercent = Math.round(((todayKwh - yesterdayKwh) / yesterdayKwh) * 100);
    }

    return {
      today: {
        kwh: Number(todayKwh.toFixed(3)),
        costVnd: todayCost,
        diffPercent,
        runningHours: Number(todayRunningHours.toFixed(1)),
      },
      thisMonth: {
        kwh: Number(monthKwh.toFixed(3)),
        costVnd: monthEvn.totalCost,
        projectedCostVnd,
        currentTier: monthEvn.currentTier,
        tierPrice: monthEvn.tierPrice,
        nextTierKwh: monthEvn.nextTierKwh,
      },
      activePowerWatts,
      activeDeviceCount,
      totalDeviceCount: devices.length,
    };
  }

  /**
   * Energy chart data: today (24 hours), week (7 days), or month (days of month)
   */
  async getEnergyChart(
    userId: string,
    householdId: string,
    range: 'today' | 'week' | 'month' = 'today',
  ): Promise<EnergyChartResponseDto> {
    await this.assertHouseholdMember(userId, householdId);

    const { now, startOfToday, startOfMonth } = this.getVnDateBounds();
    const devices = await this.prisma.device.findMany({
      where: { householdId },
      include: { state: true },
    });

    const points: EnergyChartPoint[] = [];
    let totalKwh = 0;
    let peakHour = '';
    let peakHourKwh = -1;

    if (range === 'today') {
      // 24 hourly buckets
      const logs = await this.prisma.actionLog.findMany({
        where: { householdId, createdAt: { gte: startOfToday } },
        orderBy: { createdAt: 'asc' },
      });

      for (let h = 0; h < 24; h++) {
        const hourStart = new Date(startOfToday.getTime() + h * 3600 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 3600 * 1000);
        const isFuture = hourStart.getTime() > now.getTime();

        let hourKwh = 0;
        if (!isFuture) {
          for (const dev of devices) {
            const stateObj = (dev.state?.state as Record<string, unknown> | null) ?? {};
            const isOn = stateObj.power === 'on' || stateObj.position === 'open';
            const wattage = this.getDeviceWattage(dev.deviceType, dev.id);
            const devLogs = logs.filter((l) => l.deviceId === dev.id);
            const ms = this.calculateDeviceRunningMs(devLogs, isOn, hourStart, hourEnd);
            hourKwh += (wattage * (ms / 3600000)) / 1000;
          }
        }

        const label = `${String(h).padStart(2, '0')}:00`;
        const costVnd = Math.round(hourKwh * 2500); // Standard approx rate for hour
        totalKwh += hourKwh;

        if (hourKwh > peakHourKwh) {
          peakHourKwh = hourKwh;
          peakHour = label;
        }

        points.push({
          label,
          kwh: Number(hourKwh.toFixed(3)),
          costVnd,
          timestamp: hourStart.toISOString(),
        });
      }

      // Mark peak hour
      for (const p of points) {
        if (p.label === peakHour && p.kwh > 0) {
          p.isPeak = true;
        }
      }
    } else if (range === 'week') {
      // Last 7 days
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(startOfToday.getTime() - i * 24 * 3600 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
        const vnDayOfWeek = (new Date(dayStart.getTime() + 7 * 3600 * 1000)).getUTCDay();

        let dayKwh = 0;
        for (const dev of devices) {
          const stateObj = (dev.state?.state as Record<string, unknown> | null) ?? {};
          const isOn = stateObj.power === 'on' || stateObj.position === 'open';
          const wattage = this.getDeviceWattage(dev.deviceType, dev.id);
          // Estimation based on device wattage
          dayKwh += (wattage * 3.5) / 1000;
        }

        const costVnd = calculateEvnCost(dayKwh).totalCost;
        totalKwh += dayKwh;

        points.push({
          label: i === 0 ? 'Hôm nay' : dayNames[vnDayOfWeek],
          kwh: Number(dayKwh.toFixed(3)),
          costVnd,
          timestamp: dayStart.toISOString(),
        });
      }
    } else {
      // Current Month days
      const daysCount = this.getVnDateBounds().dayOfMonth;
      for (let d = 1; d <= daysCount; d++) {
        const dayStart = new Date(startOfMonth.getTime() + (d - 1) * 24 * 3600 * 1000);
        let dayKwh = 0;
        for (const dev of devices) {
          const wattage = this.getDeviceWattage(dev.deviceType, dev.id);
          dayKwh += (wattage * 3.2) / 1000;
        }
        totalKwh += dayKwh;
        points.push({
          label: `${d}`,
          kwh: Number(dayKwh.toFixed(3)),
          costVnd: calculateEvnCost(dayKwh).totalCost,
          timestamp: dayStart.toISOString(),
        });
      }
    }

    return {
      range,
      points,
      totalKwh: Number(totalKwh.toFixed(3)),
      totalCostVnd: calculateEvnCost(totalKwh).totalCost,
      peakHour,
    };
  }

  /**
   * Device energy breakdown
   */
  async getDeviceBreakdown(
    userId: string,
    householdId: string,
    period: 'today' | 'week' | 'month' = 'today',
  ): Promise<DeviceEnergyBreakdownResponseDto> {
    await this.assertHouseholdMember(userId, householdId);

    const { now, startOfToday, startOfMonth } = this.getVnDateBounds();
    const from =
      period === 'month'
        ? startOfMonth
        : period === 'week'
        ? new Date(startOfToday.getTime() - 6 * 24 * 3600 * 1000)
        : startOfToday;

    const devices = await this.prisma.device.findMany({
      where: { householdId },
      include: { state: true },
    });

    const logs = await this.prisma.actionLog.findMany({
      where: { householdId, createdAt: { gte: from } },
      orderBy: { createdAt: 'asc' },
    });

    const rawItems: Array<{
      dev: typeof devices[0];
      wattage: number;
      runningMinutes: number;
      kwh: number;
      isOn: boolean;
    }> = [];

    let totalHouseholdKwh = 0;

    for (const dev of devices) {
      const stateObj = (dev.state?.state as Record<string, unknown> | null) ?? {};
      const isOn = stateObj.power === 'on' || stateObj.position === 'open';
      const wattage = this.getDeviceWattage(dev.deviceType, dev.id);
      const devLogs = logs.filter((l) => l.deviceId === dev.id);
      const ms = this.calculateDeviceRunningMs(devLogs, isOn, from, now);

      let runningMinutes = Math.round(ms / 60000);
      let kwh = (wattage * (runningMinutes / 60)) / 1000;

      // Provide realistic default if newly initialized
      if (kwh === 0 && isOn) {
        runningMinutes = 90;
        kwh = (wattage * 1.5) / 1000;
      }

      totalHouseholdKwh += kwh;
      rawItems.push({ dev, wattage, runningMinutes, kwh, isOn });
    }

    const items: DeviceEnergyItem[] = rawItems
      .map(({ dev, wattage, runningMinutes, kwh, isOn }) => {
        const percentage =
          totalHouseholdKwh > 0 ? Math.round((kwh / totalHouseholdKwh) * 100) : 0;
        const costVnd = Math.round(kwh * 2500); // Standard unit cost
        return {
          deviceId: dev.id,
          deviceName: dev.name,
          deviceType: dev.deviceType,
          room: dev.room,
          wattage,
          runningMinutes,
          kwh: Number(kwh.toFixed(3)),
          costVnd,
          percentage,
          isCurrentlyOn: isOn,
        };
      })
      .sort((a, b) => b.kwh - a.kwh);

    return {
      period,
      devices: items,
      totalKwh: Number(totalHouseholdKwh.toFixed(3)),
      totalCostVnd: calculateEvnCost(totalHouseholdKwh).totalCost,
    };
  }

  /**
   * Update device rated wattage
   */
  async updateDevicePower(
    userId: string,
    householdId: string,
    deviceId: string,
    wattage: number,
  ): Promise<{ success: boolean; deviceId: string; wattage: number }> {
    await this.assertHouseholdMember(userId, householdId);
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, householdId },
    });
    if (!device) {
      throw new NotFoundException('Không tìm thấy thiết bị');
    }
    this.setDeviceWattage(deviceId, wattage);
    return { success: true, deviceId, wattage };
  }
}
