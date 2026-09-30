import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

    // Check if any required devices are missing (e.g. after firmware upgrade adds new device types)
    const requiredUids = [
      `esp32-sensor-${householdId.slice(0, 8)}`,
      `esp32-light-${householdId.slice(0, 8)}`,
      `esp32-fan-${householdId.slice(0, 8)}`,
      `esp32-door-${householdId.slice(0, 8)}`,
      `esp32-cover-${householdId.slice(0, 8)}`,
      `esp32-rain-${householdId.slice(0, 8)}`,
      `esp32-gas-${householdId.slice(0, 8)}`,
      `esp32-fire-${householdId.slice(0, 8)}`,
    ];
    const existingUids = new Set(
      await this.prisma.device
        .findMany({ where: { householdId, deviceUid: { in: requiredUids } }, select: { deviceUid: true } })
        .then((rows) => rows.map((r) => r.deviceUid)),
    );
    const hasMissingDevices = requiredUids.some((uid) => !existingUids.has(uid));

    if (hasMissingDevices && !query.cursor) {
      const root = this.config.get<string>('MQTT_TOPIC_ROOT') ?? 'home';
      const isDefaultHousehold = householdId === 'efb19e22-d40c-43c6-93bc-8dc61150fc55';
      const sensorId = isDefaultHousehold ? '7534c273-aad6-4649-8f3a-f6eb95d6df4f' : randomUUID();
      const lightId = isDefaultHousehold ? '7871f8e7-5ff1-462f-9dd2-893989bd88ed' : randomUUID();
      const fanId = isDefaultHousehold ? 'aa40a477-80f8-4f79-a27c-471904d398d4' : randomUUID();
      const doorId = isDefaultHousehold ? '83b8db2d-0e79-4a6e-84af-ed594ce29025' : randomUUID();
      const coverId = isDefaultHousehold ? 'c921a581-2c1b-4f9e-a6db-83711d9f8241' : randomUUID();
      const rainId = isDefaultHousehold ? 'e129b821-432d-4cba-9071-197e84bf9123' : randomUUID();
      const gasId = isDefaultHousehold ? 'f382a719-543e-4bca-8192-208f95ca1824' : randomUUID();
      const fireId = isDefaultHousehold ? 'b493c820-654f-4cda-9203-319a06db2935' : randomUUID();

      const defaultDevices = [
        {
          id: sensorId,
          householdId,
          deviceUid: `esp32-sensor-${householdId.slice(0, 8)}`,
          name: 'Cảm biến phòng khách',
          deviceType: 'DHT_SENSOR' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/${sensorId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: lightId,
          householdId,
          deviceUid: `esp32-light-${householdId.slice(0, 8)}`,
          name: 'Đèn phòng khách',
          deviceType: 'LIGHT' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/${lightId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: fanId,
          householdId,
          deviceUid: `esp32-fan-${householdId.slice(0, 8)}`,
          name: 'Quạt phòng khách',
          deviceType: 'FAN' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/${fanId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: doorId,
          householdId,
          deviceUid: `esp32-door-${householdId.slice(0, 8)}`,
          name: 'Cửa chính',
          deviceType: 'DOOR_SERVO' as const,
          room: 'Phòng khách',
          mqttTopic: `${root}/${householdId}/device/${doorId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: coverId,
          householdId,
          deviceUid: `esp32-cover-${householdId.slice(0, 8)}`,
          name: 'Mái che thông minh',
          deviceType: 'COVER' as const,
          room: 'Ban công',
          mqttTopic: `${root}/${householdId}/device/${coverId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: rainId,
          householdId,
          deviceUid: `esp32-rain-${householdId.slice(0, 8)}`,
          name: 'Cảm biến mưa',
          deviceType: 'RAIN_SENSOR' as const,
          room: 'Ban công',
          mqttTopic: `${root}/${householdId}/device/${rainId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: gasId,
          householdId,
          deviceUid: `esp32-gas-${householdId.slice(0, 8)}`,
          name: 'Cảm biến Gas MQ-2',
          deviceType: 'GAS_SENSOR' as const,
          room: 'Nhà bếp',
          mqttTopic: `${root}/${householdId}/device/${gasId}`,
          authTokenHash: 'default-cloud-token',
        },
        {
          id: fireId,
          householdId,
          deviceUid: `esp32-fire-${householdId.slice(0, 8)}`,
          name: 'Cảm biến lửa',
          deviceType: 'FIRE_SENSOR' as const,
          room: 'Nhà bếp',
          mqttTopic: `${root}/${householdId}/device/${fireId}`,
          authTokenHash: 'default-cloud-token',
        },
      ];

      for (const d of defaultDevices) {
        let initialDeviceState: Record<string, unknown> = { power: 'off' };
        if (d.deviceType === 'DOOR_SERVO') {
          initialDeviceState = { angle: 0, position: 'closed' };
        } else if (d.deviceType === 'COVER') {
          initialDeviceState = { state: 'closed', mode: 'auto' };
        } else if (d.deviceType === 'RAIN_SENSOR') {
          initialDeviceState = { rain: 'none' };
        } else if (d.deviceType === 'GAS_SENSOR') {
          initialDeviceState = { gas: 'normal' };
        } else if (d.deviceType === 'FIRE_SENSOR') {
          initialDeviceState = { fire: 'normal' };
        } else if (d.deviceType === 'DHT_SENSOR') {
          initialDeviceState = { temperature: 28, humidity: 65 };
        }

        const upsertedDevice = await this.prisma.device.upsert({
          where: { deviceUid: d.deviceUid },
          update: {},
          create: {
            id: d.id,
            householdId: d.householdId,
            deviceUid: d.deviceUid,
            name: d.name,
            deviceType: d.deviceType as DeviceType,
            room: d.room,
            mqttTopic: d.mqttTopic,
            authTokenHash: d.authTokenHash,
          },
          select: { id: true },
        });
        // Upsert DeviceState separately to avoid nested-create conflicts
        await this.prisma.deviceState.upsert({
          where: { deviceId: upsertedDevice.id },
          update: {},
          create: {
            deviceId: upsertedDevice.id,
            state: initialDeviceState as unknown as import('@prisma/client').Prisma.InputJsonValue,
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
