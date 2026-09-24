import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutomationsService } from './automations.service.js';

describe('AutomationsService', () => {
  let service: AutomationsService;
  let mockPrisma: any;
  let mockCommands: any;

  beforeEach(() => {
    mockPrisma = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({ id: 'member-1', role: 'OWNER' }),
      },
      rule: {
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
      },
      device: {
        findFirst: vi.fn(),
      },
      deviceState: {
        findUnique: vi.fn(),
      },
      actionLog: {
        create: vi.fn(),
      },
    };

    mockCommands = {
      executeCommand: vi.fn(),
    };

    const mockTelemetry = {
      onTelemetry: vi.fn(),
    } as any;

    service = new AutomationsService(mockPrisma, mockCommands, mockTelemetry);
  });

  it('triggers fan turn_on when temperature exceeds rule threshold', async () => {
    mockPrisma.rule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        name: 'Bật quạt khi trời nóng',
        condition: { metric: 'temperature', operator: '>', value: 30 },
        action: { targetDeviceId: 'fan-123', action: 'turn_on', params: { power: 'on' } },
        isActive: true,
        createdBy: 'user-1',
      },
    ]);

    // Fan is currently off
    mockPrisma.deviceState.findUnique.mockResolvedValue({
      state: { power: 'off' },
    });

    await service.evaluateTelemetry('hh-1', [{ metric: 'temperature', value: 31.5 }]);

    expect(mockCommands.executeCommand).toHaveBeenCalledWith(
      'user-1',
      'hh-1',
      'fan-123',
      { action: 'turn_on' },
    );
    expect(mockPrisma.actionLog.create).toHaveBeenCalled();
  });

  it('does not trigger command if target device is already in desired state', async () => {
    mockPrisma.rule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        name: 'Bật quạt khi trời nóng',
        condition: { metric: 'temperature', operator: '>', value: 30 },
        action: { targetDeviceId: 'fan-123', action: 'turn_on', params: { power: 'on' } },
        isActive: true,
        createdBy: 'user-1',
      },
    ]);

    // Fan is ALREADY on
    mockPrisma.deviceState.findUnique.mockResolvedValue({
      state: { power: 'on' },
    });

    await service.evaluateTelemetry('hh-1', [{ metric: 'temperature', value: 32 }]);

    expect(mockCommands.executeCommand).not.toHaveBeenCalled();
  });
});
