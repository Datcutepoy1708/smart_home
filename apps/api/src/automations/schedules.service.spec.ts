import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SchedulesService } from './schedules.service.js';
import { CommandSource } from '@prisma/client';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let mockPrisma: any;
  let mockCommands: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockPrisma = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'u1', role: 'OWNER' }),
      },
      schedule: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      device: {
        findFirst: vi.fn(),
      },
    };

    mockCommands = {
      executeCommand: vi.fn().mockResolvedValue({ status: 'ACKNOWLEDGED' }),
    };

    service = new SchedulesService(mockPrisma, mockCommands);
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it('lists schedules and formats timeOfDay as HH:mm', async () => {
    const time = new Date(Date.UTC(1970, 0, 1, 7, 30, 0));
    mockPrisma.schedule.findMany.mockResolvedValue([
      {
        id: 'sched-1',
        householdId: 'h1',
        deviceId: 'dev-1',
        action: { action: 'open', name: 'Mở cửa sáng', params: { angle: 90 } },
        timeOfDay: time,
        repeatDays: [1, 2, 3, 4, 5, 6, 7],
        isActive: true,
        device: { name: 'Cửa chính', deviceType: 'DOOR_SERVO', room: 'Phòng khách' },
        createdAt: new Date(),
      },
    ]);

    const result = await service.listSchedules('u1', 'h1');
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe('07:30');
    expect(result[0].action).toBe('open');
    expect(result[0].name).toBe('Mở cửa sáng');
  });

  it('triggers a schedule manually using executeCommand with SCHEDULE source', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'sched-1',
      householdId: 'h1',
      deviceId: 'dev-1',
      action: { action: 'open', params: { angle: 90 } },
      timeOfDay: new Date(Date.UTC(1970, 0, 1, 7, 0, 0)),
      createdBy: 'u1',
    });

    const res = await service.triggerSchedule('u1', 'h1', 'sched-1');
    expect(res.success).toBe(true);
    expect(mockCommands.executeCommand).toHaveBeenCalledWith(
      'u1',
      'h1',
      'dev-1',
      { action: 'open', angle: 90 },
      CommandSource.SCHEDULE,
    );
  });
});
