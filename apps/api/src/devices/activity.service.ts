import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ActivityItem {
  id: string;
  type: 'COMMAND' | 'AUTOMATION' | 'ALERT';
  title: string;
  detail?: string;
  deviceId?: string;
  deviceName: string;
  deviceType: string;
  source: string;
  status: string;
  actor: string;
  timestamp: string;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async listActivity(
    userId: string,
    householdId: string,
    limit = 40,
  ): Promise<{ items: ActivityItem[] }> {
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

    // 1. Fetch recent device commands
    const commands = await this.prisma.deviceCommand.findMany({
      where: { householdId },
      orderBy: { requestedAt: 'desc' },
      take: limit,
      include: {
        device: { select: { id: true, name: true, deviceType: true } },
        requester: { select: { id: true, name: true } },
      },
    });

    // 2. Fetch recent action logs (automation triggers)
    const logs = await this.prisma.actionLog.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        device: { select: { id: true, name: true, deviceType: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // 3. Fetch alerts if any
    const alerts = await this.prisma.alert.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        device: { select: { id: true, name: true, deviceType: true } },
      },
    });

    const items: ActivityItem[] = [];

    // Map commands
    for (const cmd of commands) {
      const devName = cmd.device?.name ?? 'Thiết bị';
      const devType = cmd.device?.deviceType?.toLowerCase() ?? 'device';
      const cmdPayload = (cmd.command as Record<string, unknown> | null) ?? {};
      const action = (cmdPayload.action as string) ?? 'Lệnh';
      const angle = (cmdPayload.params as any)?.angle;

      let actionDesc = action;
      if (action === 'turn_on') actionDesc = 'Bật';
      else if (action === 'turn_off') actionDesc = 'Tắt';
      else if (action === 'open') actionDesc = `Mở cửa (${angle ?? 90}°)`;
      else if (action === 'close') actionDesc = 'Đóng cửa';
      else if (action === 'set_angle') actionDesc = `Chỉnh góc cửa (${angle}°)`;

      items.push({
        id: `cmd-${cmd.id}`,
        type: 'COMMAND',
        title: `${actionDesc} ${devName}`,
        detail: cmd.errorMessage ?? undefined,
        deviceId: cmd.deviceId,
        deviceName: devName,
        deviceType: devType,
        source: cmd.source,
        status: cmd.status,
        actor: cmd.requester?.name ?? 'App',
        timestamp: cmd.requestedAt.toISOString(),
      });
    }

    // Map logs
    for (const log of logs) {
      items.push({
        id: `log-${log.id.toString()}`,
        type: 'AUTOMATION',
        title: log.action,
        deviceId: log.deviceId ?? undefined,
        deviceName: log.device?.name ?? 'Tự động hoá',
        deviceType: log.device?.deviceType?.toLowerCase() ?? 'automation',
        source: log.source,
        status: 'SUCCESS',
        actor: 'Tự động hoá',
        timestamp: log.createdAt.toISOString(),
      });
    }

    // Map alerts
    for (const alert of alerts) {
      items.push({
        id: `alt-${alert.id}`,
        type: 'ALERT',
        title: alert.message,
        detail: `Mức độ: ${alert.severity}`,
        deviceId: alert.deviceId ?? undefined,
        deviceName: alert.device?.name ?? 'Cảnh báo',
        deviceType: alert.device?.deviceType?.toLowerCase() ?? 'sensor',
        source: 'ALERT',
        status: alert.isAcknowledged ? 'ACKNOWLEDGED' : 'ACTIVE',
        actor: 'Hệ thống giám sát',
        timestamp: alert.createdAt.toISOString(),
      });
    }

    // Sort combined feed by timestamp descending
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return { items: items.slice(0, limit) };
  }
}
