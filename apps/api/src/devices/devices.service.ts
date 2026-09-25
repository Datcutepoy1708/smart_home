import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeviceQueryDto } from './device-query.dto.js';
import type { ReadingsQueryDto } from './readings-query.dto.js';
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  async list(
    userId: string,
    householdId: string,
    query: DeviceQueryDto,
  ): Promise<{ items: any[]; nextCursor: string | null }> {
    const now = new Date();
    const membership = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!membership) throw new ForbiddenException('Household access denied');
    let devices = await this.prisma.device.findMany({
      where: {
        householdId,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: {
        id: true,
        name: true,
        room: true,
        deviceType: true,
        lastSeenAt: true,
        isOnline: true,
        state: {
          select: { state: true },
        },
        readings: {
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          take: 2,
          select: { metric: true, value: true, unit: true, recordedAt: true },
        },
      },
    });

    if (devices.length === 0 && !query.cursor) {
      const root = this.config.get<string>('MQTT_TOPIC_ROOT') ?? 'home';
      const defaultDevices = [
        {
          id: '7534c273-aad6-4649-8f3a-f6eb95d6df4f',
          householdId,
          deviceUid: `esp32-sensor-${householdId.slice(0, 8)}`,
          name: 'Cảm biến phòng khách',
          deviceType: 'DHT_SENSOR' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/7534c273-aad6-4649-8f3a-f6eb95d6df4f`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: '7871f8e7-5ff1-462f-9dd2-893989bd88ed',
          householdId,
          deviceUid: `esp32-light-${householdId.slice(0, 8)}`,
          name: 'Đèn phòng khách',
          deviceType: 'LIGHT' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/7871f8e7-5ff1-462f-9dd2-893989bd88ed`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: 'aa40a477-80f8-4f79-a27c-471904d398d4',
          householdId,
          deviceUid: `esp32-fan-${householdId.slice(0, 8)}`,
          name: 'Quạt phòng khách',
          deviceType: 'FAN' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/aa40a477-80f8-4f79-a27c-471904d398d4`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: '83b8db2d-0e79-4a6e-84af-ed594ce29025',
          householdId,
          deviceUid: `esp32-door-${householdId.slice(0, 8)}`,
          name: 'Cửa chính',
          deviceType: 'DOOR_SERVO' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/83b8db2d-0e79-4a6e-84af-ed594ce29025`,
          authTokenHash: 'default-cloud-token',
        },
      ];

      for (const d of defaultDevices) {
        await this.prisma.device.upsert({
          where: { deviceUid: d.deviceUid },
          update: {},
          create: {
            ...d,
            state: {
              create: {
                state:
                  d.deviceType === 'DOOR_SERVO'
                    ? { angle: 0, position: 'closed' }
                    : { power: 'off' },
              },
            },
          },
        });
      }

      return this.list(userId, householdId, query);
    }
    const items = devices.slice(0, query.limit).map((device) => ({
      id: device.id,
      name: device.name,
      room: device.room,
      deviceType: device.deviceType.toLowerCase(),
      lastSeenAt: device.lastSeenAt,
      isOnline: Boolean(
        device.isOnline && device.lastSeenAt &&
        now.getTime() - device.lastSeenAt.getTime() <
          Number(this.config.getOrThrow('DEVICE_OFFLINE_AFTER_MS')),
      ),
      state: (device.state?.state as Record<string, unknown> | null) ?? {},
      readings: device.readings.map((reading) => ({
        ...reading,
        value: Number(reading.value),
      })),
    }));
    return {
      items,
      nextCursor: devices.length > query.limit ? items.at(-1)!.id : null,
    };
  }

  async getById(userId: string, householdId: string, deviceId: string) {
    const now = new Date();
    const membership = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!membership) throw new ForbiddenException('Household access denied');

    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        householdId,
      },
      select: {
        id: true,
        name: true,
        room: true,
        deviceType: true,
        lastSeenAt: true,
        isOnline: true,
        state: {
          select: { state: true },
        },
        readings: {
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          take: 2,
          select: { metric: true, value: true, unit: true, recordedAt: true },
        },
      },
    });

    if (!device) throw new NotFoundException('Device not found');

    let effectiveReadings = device.readings;
    if (effectiveReadings.length === 0) {
      const sensor = await this.prisma.device.findFirst({
        where: {
          householdId,
          deviceType: 'DHT_SENSOR',
        },
        select: {
          readings: {
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
            take: 2,
            select: { metric: true, value: true, unit: true, recordedAt: true },
          },
        },
      });
      if (sensor?.readings?.length) {
        effectiveReadings = sensor.readings;
      }
    }

    return {
      id: device.id,
      name: device.name,
      room: device.room,
      deviceType: device.deviceType.toLowerCase(),
      lastSeenAt: device.lastSeenAt,
      isOnline: Boolean(
        device.isOnline && device.lastSeenAt &&
        now.getTime() - device.lastSeenAt.getTime() <
          Number(this.config.getOrThrow('DEVICE_OFFLINE_AFTER_MS')),
      ),
      state: (device.state?.state as Record<string, unknown> | null) ?? {},
      readings: effectiveReadings.map((reading) => ({
        ...reading,
        value: Number(reading.value),
      })),
    };
  }

  async getReadings(
    userId: string,
    householdId: string,
    deviceId: string,
    query: ReadingsQueryDto,
  ) {
    const now = new Date();
    const membership = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!membership) throw new ForbiddenException('Household access denied');

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, householdId },
      select: { id: true, deviceType: true },
    });
    if (!device) throw new NotFoundException('Device not found');

    let targetDeviceId = device.id;
    if (device.deviceType !== 'DHT_SENSOR') {
      const sensor = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'DHT_SENSOR' },
        select: { id: true },
      });
      if (sensor) {
        targetDeviceId = sensor.id;
      }
    }

    let since: Date | undefined;
    if (query.range === '24h') {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (query.range === '7d') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const readings = await this.prisma.sensorReading.findMany({
      where: {
        deviceId: targetDeviceId,
        ...(query.metric ? { metric: query.metric } : {}),
        ...(since ? { recordedAt: { gte: since } } : {}),
      },
      orderBy: { recordedAt: 'asc' },
      take: query.limit ?? 100,
      select: {
        id: true,
        metric: true,
        value: true,
        unit: true,
        recordedAt: true,
      },
    });

    return {
      deviceId: targetDeviceId,
      readings: readings.map((r) => ({
        id: r.id.toString(),
        metric: r.metric,
        value: Number(r.value),
        unit: r.unit ?? (r.metric === 'temperature' ? '°C' : '%'),
        recordedAt: r.recordedAt.toISOString(),
      })),
    };
  }
}
