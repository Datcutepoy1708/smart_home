import { describe, expect, it, vi } from 'vitest';
import { calculateEvnCost, DEFAULT_WATTAGES, EnergyService } from './energy.service.js';

describe('EnergyService & EVN Calculation', () => {
  it('calculates EVN cost correctly for Tier 1 (< 50 kWh)', () => {
    // 30 kWh: 30 * 1806 = 54,180. VAT (8%) = 4,334. Total = 58,514
    const res = calculateEvnCost(30);
    expect(res.currentTier).toBe(1);
    expect(res.baseCost).toBe(54180);
    expect(res.vat).toBe(4334);
    expect(res.totalCost).toBe(58514);
    expect(res.nextTierKwh).toBe(20);
  });

  it('calculates EVN cost across multiple progressive tiers (Tier 2: 80 kWh)', () => {
    // Tier 1: 50 * 1806 = 90,300
    // Tier 2: 30 * 1866 = 55,980
    // Base: 146,280. VAT: 11,702. Total: 157,982
    const res = calculateEvnCost(80);
    expect(res.currentTier).toBe(2);
    expect(res.baseCost).toBe(146280);
    expect(res.totalCost).toBe(157982);
    expect(res.nextTierKwh).toBe(20); // 100 - 80 = 20 kWh left in tier 2
  });

  it('calculates EVN cost for Tier 3 (150 kWh)', () => {
    // Tier 1: 50 * 1806 = 90,300
    // Tier 2: 50 * 1866 = 93,300
    // Tier 3: 50 * 2167 = 108,350
    // Base: 291,950. VAT: 23,356. Total: 315,306
    const res = calculateEvnCost(150);
    expect(res.currentTier).toBe(3);
    expect(res.baseCost).toBe(291950);
    expect(res.totalCost).toBe(315306);
    expect(res.nextTierKwh).toBe(50); // 200 - 150 = 50 kWh left in tier 3
  });

  it('calculates EVN cost for Tier 6 (> 400 kWh)', () => {
    const res = calculateEvnCost(450);
    expect(res.currentTier).toBe(6);
    expect(res.tierPrice).toBe(3151);
    expect(res.totalCost).toBeGreaterThan(1000000);
  });

  it('calculates device running milliseconds accurately for bounded turn_on and turn_off logs', () => {
    const service = new EnergyService({} as any);
    const from = new Date('2026-09-24T00:00:00Z');
    const to = new Date('2026-09-24T10:00:00Z'); // 10 hour window

    // Event 1: on at 02:00, off at 05:00 (3 hours = 10,800,000 ms)
    // Event 2: on at 07:00, still on at end (3 hours = 10,800,000 ms)
    const logs = [
      { action: 'turn_on', createdAt: new Date('2026-09-24T02:00:00Z') },
      { action: 'turn_off', createdAt: new Date('2026-09-24T05:00:00Z') },
      { action: 'turn_on', createdAt: new Date('2026-09-24T07:00:00Z') },
    ];

    const ms = service.calculateDeviceRunningMs(logs, true, from, to);
    expect(ms).toBe(6 * 3600 * 1000); // exactly 6 hours
  });

  it('handles custom device wattage overriding defaults', async () => {
    const prismaMock = {
      householdMember: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
      device: { findFirst: vi.fn().mockResolvedValue({ id: 'dev-1', householdId: 'h1' }) },
    };
    const service = new EnergyService(prismaMock as any);

    expect(service.getDeviceWattage('LIGHT', 'dev-1')).toBe(DEFAULT_WATTAGES.LIGHT);

    await service.updateDevicePower('user-1', 'h1', 'dev-1', 45);
    expect(service.getDeviceWattage('LIGHT', 'dev-1')).toBe(45);
  });

  it('returns energy summary for household with devices and logs', async () => {
    const prismaMock = {
      householdMember: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
      device: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'dev-light',
            name: 'Đèn phòng khách',
            deviceType: 'LIGHT',
            state: { state: { power: 'on' } },
          },
          {
            id: 'dev-fan',
            name: 'Quạt phòng khách',
            deviceType: 'FAN',
            state: { state: { power: 'off' } },
          },
        ]),
      },
      actionLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            deviceId: 'dev-light',
            action: 'turn_on',
            createdAt: new Date(),
          },
        ]),
      },
    };

    const service = new EnergyService(prismaMock as any);
    const summary = await service.getEnergySummary('u1', 'h1');

    expect(summary.activePowerWatts).toBe(20); // 1 light ON (20W)
    expect(summary.activeDeviceCount).toBe(1);
    expect(summary.totalDeviceCount).toBe(2);
    expect(summary.today.costVnd).toBeGreaterThanOrEqual(0);
    expect(summary.thisMonth.currentTier).toBeGreaterThanOrEqual(1);
  });
});
