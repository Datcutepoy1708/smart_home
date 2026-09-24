import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ActivityService } from './activity.service.js';

describe('ActivityService', () => {
  let service: ActivityService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }),
      },
      deviceCommand: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'cmd-1',
            householdId: 'hh-1',
            deviceId: 'dev-1',
            command: { action: 'turn_on', params: { power: 'on' } },
            source: 'APP',
            status: 'ACKNOWLEDGED',
            errorMessage: null,
            requestedAt: new Date('2026-09-23T15:00:00Z'),
            device: { id: 'dev-1', name: 'Đèn phòng khách', deviceType: 'LIGHT' },
            requester: { id: 'usr-1', name: 'Admin' },
          },
        ]),
      },
      actionLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: BigInt(1),
            householdId: 'hh-1',
            deviceId: 'dev-2',
            action: '[Tự động] Bật quạt khi nhiệt độ > 30°C',
            source: 'RULE',
            createdAt: new Date('2026-09-23T15:05:00Z'),
            device: { id: 'dev-2', name: 'Quạt phòng khách', deviceType: 'FAN' },
            user: { id: 'usr-1', name: 'Admin' },
          },
        ]),
      },
      alert: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    service = new ActivityService(mockPrisma);
  });

  it('aggregates commands and action logs in chronological order descending', async () => {
    const res = await service.listActivity('usr-1', 'hh-1', 10);
    expect(res.items).toHaveLength(2);
    // ActionLog is 15:05:00, Command is 15:00:00 -> ActionLog should come first
    expect(res.items[0].type).toBe('AUTOMATION');
    expect(res.items[0].title).toBe('[Tự động] Bật quạt khi nhiệt độ > 30°C');
    expect(res.items[1].type).toBe('COMMAND');
    expect(res.items[1].title).toBe('Bật Đèn phòng khách');
    expect(res.items[1].status).toBe('ACKNOWLEDGED');
  });
});
