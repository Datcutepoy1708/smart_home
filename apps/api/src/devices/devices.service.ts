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
  async list(userId: string, householdId: string, query: DeviceQueryDto) {
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
    const devices = await this.prisma.device.findMany({
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
