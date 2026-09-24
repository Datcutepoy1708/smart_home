import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommandsService } from './commands.service.js';

describe('CommandsService', () => {
  let service: CommandsService;
  let prismaMock: any;
  let configMock: any;
  let mqttMock: any;

  beforeEach(() => {
    prismaMock = {
      householdMember: { findFirst: vi.fn() },
      device: { findFirst: vi.fn() },
      deviceCommand: {
        create: vi.fn().mockResolvedValue({ id: 'cmd-1', status: 'PENDING' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: 'cmd-1' }),
      },
      deviceState: { upsert: vi.fn().mockResolvedValue({}) },
      actionLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<unknown>) => cb(prismaMock)),
    };

    configMock = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'DEVICE_OFFLINE_AFTER_MS') return '30000';
        if (key === 'MQTT_TOPIC_ROOT') return 'home';
        throw new Error(`Unexpected config key ${key}`);
      }),
    };

    mqttMock = {
      publish: vi.fn().mockResolvedValue(undefined),
      registerAckHandler: vi.fn(),
      unregisterAckHandler: vi.fn(),
    };

    service = new CommandsService(prismaMock, configMock, mqttMock);
  });

  it('rejects command if user is not an active household member', async () => {
    prismaMock.householdMember.findFirst.mockResolvedValue(null);

    await expect(
      service.executeCommand('user-1', 'house-1', 'dev-1', { action: 'turn_on' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects command if device is not found in household', async () => {
    prismaMock.householdMember.findFirst.mockResolvedValue({ id: 'mem-1' });
    prismaMock.device.findFirst.mockResolvedValue(null);

    await expect(
      service.executeCommand('user-1', 'house-1', 'dev-1', { action: 'turn_on' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects command if device is offline', async () => {
    prismaMock.householdMember.findFirst.mockResolvedValue({ id: 'mem-1' });
    prismaMock.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      deviceType: 'LIGHT',
      isOnline: false,
      lastSeenAt: null,
      state: null,
    });

    await expect(
      service.executeCommand('user-1', 'house-1', 'dev-1', { action: 'turn_on' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects command if device lastSeenAt has expired', async () => {
    prismaMock.householdMember.findFirst.mockResolvedValue({ id: 'mem-1' });
    prismaMock.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      deviceType: 'LIGHT',
      isOnline: true,
      lastSeenAt: new Date(Date.now() - 40000), // > 30000ms
      state: null,
    });

    await expect(
      service.executeCommand('user-1', 'house-1', 'dev-1', { action: 'turn_on' }),
    ).rejects.toThrow(ConflictException);
  });

  it('successfully executes command on receiving device ACK', async () => {
    prismaMock.householdMember.findFirst.mockResolvedValue({ id: 'mem-1' });
    prismaMock.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      deviceType: 'LIGHT',
      isOnline: true,
      lastSeenAt: new Date(),
      state: { state: { power: 'off' } },
    });

    mqttMock.registerAckHandler.mockImplementation((_cmdId: string, _hId: string, _dId: string, cb: (ack: { status: string; state?: Record<string, unknown> }) => void) => {
      // Simulate immediate device ACK
      cb({ status: 'success', state: { power: 'on' } });
    });

    const result = await service.executeCommand('user-1', 'house-1', 'dev-1', { action: 'turn_on' });

    expect(result.status).toBe('ACKNOWLEDGED');
    expect(result.state).toEqual({ power: 'on' });
    expect(mqttMock.publish).toHaveBeenCalledWith(
      'home/house-1/device/dev-1/command',
      expect.stringContaining('"action":"turn_on"'),
    );
    expect(prismaMock.actionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        householdId: 'house-1',
        deviceId: 'dev-1',
        userId: 'user-1',
        action: 'turn_on',
        oldValue: { power: 'off' },
        newValue: { power: 'on' },
      }),
    });
  });

  it('rejects if device reported failure in ACK', async () => {
    prismaMock.householdMember.findFirst.mockResolvedValue({ id: 'mem-1' });
    prismaMock.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      deviceType: 'LIGHT',
      isOnline: true,
      lastSeenAt: new Date(),
      state: null,
    });

    mqttMock.registerAckHandler.mockImplementation((_cmdId: string, _hId: string, _dId: string, cb: (ack: { status: string; state?: Record<string, unknown> }) => void) => {
      cb({ status: 'hardware_fault' });
    });

    await expect(
      service.executeCommand('user-1', 'house-1', 'dev-1', { action: 'turn_on' }),
    ).rejects.toThrow(ConflictException);
  });
});
