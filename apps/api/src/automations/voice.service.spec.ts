import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceService } from './voice.service.js';
import { CommandSource, DeviceType } from '@prisma/client';

describe('VoiceService', () => {
  let service: VoiceService;
  let mockPrisma: any;
  let mockCommands: any;
  let mockScenes: any;

  beforeEach(() => {
    mockPrisma = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'u1', role: 'OWNER' }),
      },
      device: {
        findFirst: vi.fn(),
      },
      sensorReading: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockCommands = {
      executeCommand: vi.fn().mockResolvedValue({ status: 'ACKNOWLEDGED' }),
    };

    mockScenes = {
      listScenes: vi.fn().mockResolvedValue([]),
      triggerScene: vi.fn().mockResolvedValue({ success: true }),
    };

    service = new VoiceService(mockPrisma, mockCommands, mockScenes);
  });

  it('parses "Mở cửa 90 độ" and executes door open command with angle 90', async () => {
    mockPrisma.device.findFirst.mockResolvedValue({
      id: 'door-1',
      name: 'Cửa phòng khách',
      deviceType: DeviceType.DOOR_SERVO,
    });

    const res = await service.processVoiceCommand('u1', 'h1', {
      text: 'Mở cửa 90 độ',
    });

    expect(res.success).toBe(true);
    expect(res.matchedType).toBe('DEVICE');
    expect(res.action).toBe('open');
    expect(res.angle).toBe(90);
    expect(mockCommands.executeCommand).toHaveBeenCalledWith(
      'u1',
      'h1',
      'door-1',
      { action: 'open', angle: 90 },
      CommandSource.VOICE,
    );
  });

  it('parses "Bật quạt" and executes fan turn_on command', async () => {
    mockPrisma.device.findFirst.mockResolvedValue({
      id: 'fan-1',
      name: 'Quạt phòng khách',
      deviceType: DeviceType.FAN,
    });

    const res = await service.processVoiceCommand('u1', 'h1', {
      text: 'Bật quạt',
    });

    expect(res.success).toBe(true);
    expect(res.matchedType).toBe('DEVICE');
    expect(res.action).toBe('turn_on');
    expect(mockCommands.executeCommand).toHaveBeenCalledWith(
      'u1',
      'h1',
      'fan-1',
      { action: 'turn_on' },
      CommandSource.VOICE,
    );
  });

  it('parses temperature query and returns latest reading', async () => {
    mockPrisma.sensorReading.findMany.mockResolvedValue([
      { metric: 'temperature', value: 29.5 },
      { metric: 'humidity', value: 65 },
    ]);

    const res = await service.processVoiceCommand('u1', 'h1', {
      text: 'Nhiệt độ phòng bao nhiêu',
    });

    expect(res.success).toBe(true);
    expect(res.matchedType).toBe('QUERY');
    expect(res.message).toContain('29.5°C');
    expect(res.message).toContain('65%');
  });

  it('handles unknown command with helpful guidance message', async () => {
    const res = await service.processVoiceCommand('u1', 'h1', {
      text: 'Hôm nay ăn gì',
    });

    expect(res.success).toBe(false);
    expect(res.matchedType).toBe('UNKNOWN');
    expect(res.message).toContain('Mở cửa 90 độ');
  });
});
