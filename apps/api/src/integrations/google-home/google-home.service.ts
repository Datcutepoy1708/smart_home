import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandSource, DeviceType } from '@prisma/client';
import { CommandsService } from '../../devices/commands.service.js';
import { DevicesService } from '../../devices/devices.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  GOOGLE_ACTIONS,
  GOOGLE_COMMANDS,
  GOOGLE_DEVICE_TYPES,
  GOOGLE_TRAITS,
} from './google-home.constants.js';

export interface GoogleSyncDevice {
  id: string;
  type: string;
  traits: string[];
  name: {
    defaultNames: string[];
    name: string;
    nicknames: string[];
  };
  willReportState: boolean;
  roomHint?: string;
  attributes?: Record<string, unknown>;
  deviceInfo: {
    manufacturer: string;
    model: string;
    hwVersion: string;
    swVersion: string;
  };
}

export interface GoogleCommandExecution {
  command: string;
  params: Record<string, unknown>;
}

export interface GoogleCommandItem {
  devices: Array<{ id: string }>;
  execution: GoogleCommandExecution[];
}

@Injectable()
export class GoogleHomeService {
  private readonly logger = new Logger(GoogleHomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesService: DevicesService,
    private readonly commandsService: CommandsService,
  ) {}

  private async getActiveHouseholdForUser(userId: string) {
    const member = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { joinedAt: 'asc' },
    });
    if (!member) {
      throw new NotFoundException('Không tìm thấy ngôi nhà nào cho tài khoản này.');
    }
    return member.householdId;
  }

  async handleSync(userId: string) {
    const householdId = await this.getActiveHouseholdForUser(userId);
    const result = await this.devicesService.list(userId, householdId, {
      limit: 50,
    });

    const devices: GoogleSyncDevice[] = [];

    for (const item of result.items) {
      const typeLower = String(item.deviceType).toLowerCase();

      if (typeLower === 'light') {
        devices.push({
          id: item.id,
          type: GOOGLE_DEVICE_TYPES.LIGHT,
          traits: [GOOGLE_TRAITS.ON_OFF],
          name: {
            defaultNames: [item.name, 'Đèn'],
            name: item.name,
            nicknames: [item.name, 'đèn', 'đèn phòng'],
          },
          willReportState: false,
          roomHint: item.room || 'Phòng khách',
          deviceInfo: {
            manufacturer: 'SmartHome',
            model: 'ESP32-Relay-Light',
            hwVersion: '1.0',
            swVersion: '1.0',
          },
        });
      } else if (typeLower === 'fan') {
        devices.push({
          id: item.id,
          type: GOOGLE_DEVICE_TYPES.FAN,
          traits: [GOOGLE_TRAITS.ON_OFF],
          name: {
            defaultNames: [item.name, 'Quạt'],
            name: item.name,
            nicknames: [item.name, 'quạt', 'quạt phòng'],
          },
          willReportState: false,
          roomHint: item.room || 'Phòng khách',
          deviceInfo: {
            manufacturer: 'SmartHome',
            model: 'ESP32-PWM-Fan',
            hwVersion: '1.0',
            swVersion: '1.0',
          },
        });
      } else if (typeLower === 'door_servo') {
        devices.push({
          id: item.id,
          type: GOOGLE_DEVICE_TYPES.DOOR,
          traits: [GOOGLE_TRAITS.OPEN_CLOSE],
          name: {
            defaultNames: [item.name, 'Cửa'],
            name: item.name,
            nicknames: [item.name, 'cửa chính', 'cổng', 'cửa'],
          },
          willReportState: false,
          roomHint: item.room || 'Cửa chính',
          attributes: {
            openDirection: ['IN'],
          },
          deviceInfo: {
            manufacturer: 'SmartHome',
            model: 'ESP32-Door-Servo',
            hwVersion: '1.0',
            swVersion: '1.0',
          },
        });
      } else if (typeLower === 'dht_sensor') {
        devices.push({
          id: item.id,
          type: GOOGLE_DEVICE_TYPES.SENSOR,
          traits: [
            GOOGLE_TRAITS.TEMPERATURE_SETTING,
            GOOGLE_TRAITS.SENSOR_STATE,
          ],
          name: {
            defaultNames: [item.name, 'Cảm biến nhiệt độ'],
            name: item.name,
            nicknames: [item.name, 'nhiệt độ', 'độ ẩm', 'cảm biến'],
          },
          willReportState: false,
          roomHint: item.room || 'Phòng khách',
          attributes: {
            queryOnlyTemperatureSetting: true,
            thermostatTemperatureUnit: 'C',
            sensorStatesSupported: [
              {
                name: 'Humidity',
                numericCapabilities: {
                  rawValueUnit: 'PERCENTAGE',
                },
              },
            ],
          },
          deviceInfo: {
            manufacturer: 'SmartHome',
            model: 'ESP32-DHT11',
            hwVersion: '1.0',
            swVersion: '1.0',
          },
        });
      }
    }

    return {
      agentUserId: userId,
      devices,
    };
  }

  async handleQuery(userId: string, targetDevices: Array<{ id: string }>) {
    const householdId = await this.getActiveHouseholdForUser(userId);
    const deviceStates: Record<string, Record<string, unknown>> = {};

    for (const target of targetDevices) {
      try {
        const device = await this.devicesService.getById(
          userId,
          householdId,
          target.id,
        );
        const typeLower = String(device.deviceType).toLowerCase();
        const rawState = (device.state as Record<string, unknown>) ?? {};

        if (typeLower === 'light' || typeLower === 'fan') {
          const isOn = Boolean(
            rawState.on !== undefined
              ? rawState.on
              : rawState.state === 'ON' || rawState.status === 'on',
          );
          deviceStates[target.id] = {
            status: 'SUCCESS',
            online: true,
            on: isOn,
          };
        } else if (typeLower === 'door_servo') {
          const isOpen = Boolean(
            rawState.open ?? (Number(rawState.angle ?? 0) > 0),
          );
          deviceStates[target.id] = {
            status: 'SUCCESS',
            online: true,
            openPercent: isOpen ? 100 : 0,
          };
        } else if (typeLower === 'dht_sensor') {
          let temp = 28;
          let hum = 65;
          for (const r of device.readings) {
            if (r.metric === 'temperature') temp = Number(r.value);
            if (r.metric === 'humidity') hum = Number(r.value);
          }
          deviceStates[target.id] = {
            status: 'SUCCESS',
            online: true,
            thermostatTemperatureAmbient: temp,
            currentSensorStateData: [
              {
                name: 'Humidity',
                rawValue: hum,
              },
            ],
          };
        } else {
          deviceStates[target.id] = {
            status: 'SUCCESS',
            online: true,
          };
        }
      } catch {
        deviceStates[target.id] = {
          status: 'ERROR',
          errorCode: 'deviceNotFound',
        };
      }
    }

    return {
      devices: deviceStates,
    };
  }

  async handleExecute(userId: string, commands: GoogleCommandItem[]) {
    const householdId = await this.getActiveHouseholdForUser(userId);
    const results: Array<{
      ids: string[];
      status: string;
      states?: Record<string, unknown>;
      errorCode?: string;
    }> = [];

    for (const cmdItem of commands) {
      for (const exec of cmdItem.execution) {
        for (const dev of cmdItem.devices) {
          try {
            let stateUpdates: Record<string, unknown> = {};

            if (exec.command === GOOGLE_COMMANDS.ON_OFF) {
              const turnOn = Boolean(exec.params.on);
              await this.commandsService.executeCommand(
                userId,
                householdId,
                dev.id,
                { action: turnOn ? 'turn_on' : 'turn_off' },
                CommandSource.VOICE,
              );
              stateUpdates = { on: turnOn, online: true };
            } else if (exec.command === GOOGLE_COMMANDS.OPEN_CLOSE) {
              const openPercent = Number(exec.params.openPercent ?? 0);
              const shouldOpen = openPercent > 0;
              await this.commandsService.executeCommand(
                userId,
                householdId,
                dev.id,
                { action: shouldOpen ? 'open' : 'close' },
                CommandSource.VOICE,
              );
              stateUpdates = { openPercent, online: true };
            } else {
              this.logger.warn(`Unsupported command: ${exec.command}`);
              stateUpdates = { online: true };
            }

            results.push({
              ids: [dev.id],
              status: 'SUCCESS',
              states: stateUpdates,
            });
          } catch (err: unknown) {
            this.logger.error(
              `Execute command failed for device ${dev.id}: ${String(err)}`,
            );
            results.push({
              ids: [dev.id],
              status: 'ERROR',
              errorCode: 'actionNotAvailable',
            });
          }
        }
      }
    }

    return {
      commands: results,
    };
  }

  async handleDisconnect(userId: string) {
    this.logger.log(`Google Home account disconnected for user: ${userId}`);
    return {};
  }
}
