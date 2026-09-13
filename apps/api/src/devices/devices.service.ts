import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeviceQueryDto } from './device-query.dto.js';
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
        readings: {
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          take: 2,
          select: { metric: true, value: true, unit: true, recordedAt: true },
        },
      },
    });
    const items = devices.slice(0, query.limit).map((device) => ({
      ...device,
      deviceType: device.deviceType.toLowerCase(),
      isOnline: Boolean(
        device.lastSeenAt &&
        now.getTime() - device.lastSeenAt.getTime() <
          Number(this.config.getOrThrow('DEVICE_OFFLINE_AFTER_MS')),
      ),
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
}
