import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandSource } from '@prisma/client';
import { CommandsService } from '../../devices/commands.service.js';
import { DevicesService } from '../../devices/devices.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GoogleHomeService } from './google-home.service.js';
import {
  GOOGLE_ACTIONS,
  GOOGLE_COMMANDS,
  GOOGLE_DEVICE_TYPES,
  GOOGLE_TRAITS,
} from './google-home.constants.js';

describe('GoogleHomeService', () => {
  let service: GoogleHomeService;
  let prisma: PrismaService;
  let devicesService: DevicesService;
  let commandsService: CommandsService;

  const mockPrisma = {
    householdMember: {
      findFirst: vi.fn(),
    },
  };

  const mockDevicesService = {
    list: vi.fn(),
    getById: vi.fn(),
  };

  const mockCommandsService = {
    executeCommand: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleHomeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: CommandsService, useValue: mockCommandsService },
      ],
    }).compile();

    service = module.get<GoogleHomeService>(GoogleHomeService);
    prisma = module.get<PrismaService>(PrismaService);
    devicesService = module.get<DevicesService>(DevicesService);
    commandsService = module.get<CommandsService>(CommandsService);
  });

  const userId = 'user-uuid-1';
  const householdId = 'household-uuid-1';

  beforeEach(() => {
    mockPrisma.householdMember.findFirst.mockResolvedValue({
      householdId,
      userId,
    });
  });

  describe('handleSync', () => {
    it('should map LIGHT, FAN, DOOR_SERVO, and DHT_SENSOR to Google Smart Home format', async () => {
      mockDevicesService.list.mockResolvedValue({
        items: [
          {
            id: 'light-1',
            name: 'Đèn phòng khách',
            room: 'Phòng khách',
            deviceType: 'light',
          },
          {
            id: 'fan-1',
            name: 'Quạt',
            room: 'Phòng khách',
            deviceType: 'fan',
          },
          {
            id: 'door-1',
            name: 'Cửa chính',
            room: 'Cửa',
            deviceType: 'door_servo',
          },
          {
            id: 'sensor-1',
            name: 'Cảm biến',
            room: 'Phòng khách',
            deviceType: 'dht_sensor',
          },
        ],
      });

      const res = await service.handleSync(userId);

      expect(res.agentUserId).toBe(userId);
      expect(res.devices).toHaveLength(4);

      const light = res.devices.find((d) => d.id === 'light-1');
      expect(light?.type).toBe(GOOGLE_DEVICE_TYPES.LIGHT);
      expect(light?.traits).toContain(GOOGLE_TRAITS.ON_OFF);

      const fan = res.devices.find((d) => d.id === 'fan-1');
      expect(fan?.type).toBe(GOOGLE_DEVICE_TYPES.FAN);
      expect(fan?.traits).toContain(GOOGLE_TRAITS.ON_OFF);

      const door = res.devices.find((d) => d.id === 'door-1');
      expect(door?.type).toBe(GOOGLE_DEVICE_TYPES.DOOR);
      expect(door?.traits).toContain(GOOGLE_TRAITS.OPEN_CLOSE);

      const sensor = res.devices.find((d) => d.id === 'sensor-1');
      expect(sensor?.type).toBe(GOOGLE_DEVICE_TYPES.SENSOR);
      expect(sensor?.traits).toContain(GOOGLE_TRAITS.TEMPERATURE_SETTING);
    });
  });

  describe('handleQuery', () => {
    it('should query state for devices correctly', async () => {
      mockDevicesService.getById.mockImplementation(
        async (_u: string, _h: string, id: string) => {
          if (id === 'light-1') {
            return {
              id: 'light-1',
              deviceType: 'light',
              state: { on: true },
              readings: [],
            };
          }
          if (id === 'sensor-1') {
            return {
              id: 'sensor-1',
              deviceType: 'dht_sensor',
              state: {},
              readings: [
                { metric: 'temperature', value: 27.5 },
                { metric: 'humidity', value: 68 },
              ],
            };
          }
          throw new Error('Not found');
        },
      );

      const res = await service.handleQuery(userId, [
        { id: 'light-1' },
        { id: 'sensor-1' },
      ]);

      expect(res.devices['light-1']).toEqual({
        status: 'SUCCESS',
        online: true,
        on: true,
      });

      expect(res.devices['sensor-1']).toEqual({
        status: 'SUCCESS',
        online: true,
        thermostatTemperatureAmbient: 27.5,
        currentSensorStateData: [{ name: 'Humidity', rawValue: 68 }],
      });
    });
  });

  describe('handleExecute', () => {
    it('should execute OnOff command with CommandSource.VOICE', async () => {
      mockCommandsService.executeCommand.mockResolvedValue({});

      const res = await service.handleExecute(userId, [
        {
          devices: [{ id: 'light-1' }],
          execution: [
            {
              command: GOOGLE_COMMANDS.ON_OFF,
              params: { on: true },
            },
          ],
        },
      ]);

      expect(mockCommandsService.executeCommand).toHaveBeenCalledWith(
        userId,
        householdId,
        'light-1',
        { action: 'turn_on' },
        CommandSource.VOICE,
      );

      expect(res.commands[0]).toEqual({
        ids: ['light-1'],
        status: 'SUCCESS',
        states: { on: true, online: true },
      });
    });

    it('should execute OpenClose command with CommandSource.VOICE', async () => {
      mockCommandsService.executeCommand.mockResolvedValue({});

      const res = await service.handleExecute(userId, [
        {
          devices: [{ id: 'door-1' }],
          execution: [
            {
              command: GOOGLE_COMMANDS.OPEN_CLOSE,
              params: { openPercent: 100 },
            },
          ],
        },
      ]);

      expect(mockCommandsService.executeCommand).toHaveBeenCalledWith(
        userId,
        householdId,
        'door-1',
        { action: 'open' },
        CommandSource.VOICE,
      );

      expect(res.commands[0]).toEqual({
        ids: ['door-1'],
        status: 'SUCCESS',
        states: { openPercent: 100, online: true },
      });
    });
  });
});
