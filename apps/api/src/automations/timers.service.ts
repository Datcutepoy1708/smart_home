import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CommandsService } from '../devices/commands.service.js';

interface ActiveTimer {
  timeoutId: ReturnType<typeof setTimeout>;
  deviceId: string;
  householdId: string;
  userId: string;
  action: string;
  angle?: number;
  finishesAt: Date;
  durationMinutes: number;
}

@Injectable()
export class TimersService {
  private readonly logger = new Logger(TimersService.name);
  private readonly timers = new Map<string, ActiveTimer>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: CommandsService,
  ) {}

  private async assertMembership(userId: string, householdId: string) {
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
    return membership;
  }

  async setTimer(
    userId: string,
    householdId: string,
    deviceId: string,
    dto: { durationMinutes: number; action: string; angle?: number },
  ) {
    await this.assertMembership(userId, householdId);

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, householdId },
    });
    if (!device) throw new NotFoundException('Device not found');

    // Cancel existing timer for this device if any
    this.cancelTimer(userId, householdId, deviceId);

    const ms = dto.durationMinutes * 60 * 1000;
    const finishesAt = new Date(Date.now() + ms);

    const timeoutId = setTimeout(async () => {
      this.timers.delete(deviceId);
      this.logger.log(
        `[COUNTDOWN TIMER] Expired for device ${deviceId}, executing action: ${dto.action}`,
      );
      try {
        await this.commands.executeCommand(
          userId,
          householdId,
          deviceId,
          {
            action: dto.action as any,
            ...(dto.angle !== undefined ? { angle: Number(dto.angle) } : {}),
          },
          CommandSource.SCHEDULE,
        );
      } catch (err) {
        this.logger.error(`[COUNTDOWN TIMER] Failed executing command for device ${deviceId}`, err);
      }
    }, ms);

    this.timers.set(deviceId, {
      timeoutId,
      deviceId,
      householdId,
      userId,
      action: dto.action,
      angle: dto.angle,
      finishesAt,
      durationMinutes: dto.durationMinutes,
    });

    return {
      active: true,
      deviceId,
      action: dto.action,
      finishesAt: finishesAt.toISOString(),
      remainingSeconds: Math.max(0, Math.floor(ms / 1000)),
    };
  }

  getTimer(userId: string, householdId: string, deviceId: string) {
    const active = this.timers.get(deviceId);
    if (!active || active.householdId !== householdId) {
      return { active: false, remainingSeconds: 0 };
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((active.finishesAt.getTime() - Date.now()) / 1000),
    );

    return {
      active: true,
      deviceId,
      action: active.action,
      angle: active.angle,
      finishesAt: active.finishesAt.toISOString(),
      remainingSeconds,
    };
  }

  cancelTimer(userId: string, householdId: string, deviceId: string) {
    const active = this.timers.get(deviceId);
    if (active) {
      clearTimeout(active.timeoutId);
      this.timers.delete(deviceId);
    }
    return { active: false, remainingSeconds: 0 };
  }
}
