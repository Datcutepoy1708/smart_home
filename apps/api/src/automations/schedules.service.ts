import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CommandSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CommandsService } from '../devices/commands.service.js';
import type { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto.js';

interface ScheduleActionData {
  action: 'turn_on' | 'turn_off' | 'open' | 'close' | 'set_angle';
  name?: string;
  params?: Record<string, unknown>;
}

@Injectable()
export class SchedulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulesService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly executedKeys = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: CommandsService,
  ) {}

  onModuleInit() {
    // Run scheduler check every 10 seconds
    this.timer = setInterval(() => {
      void this.checkAndRunSchedules().catch((err) =>
        this.logger.error('Error during schedule runner tick', err),
      );
    }, 10_000);
    this.logger.log('Schedules runner service initialized (interval: 10s)');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private parseTimeOfDay(timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    // Use fixed epoch date so only time is stored
    return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
  }

  private formatTimeOfDay(date: Date): string {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Helper: Get current time and calendar parts in Vietnam (Asia/Ho_Chi_Minh = UTC+7)
   */
  public getVietnamTimeParts(date: Date = new Date()): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dayOfWeek: number;
    hhMm: string;
    dateKey: string;
  } {
    const vnEpoch = date.getTime() + 7 * 3600 * 1000;
    const vn = new Date(vnEpoch);
    const year = vn.getUTCFullYear();
    const month = vn.getUTCMonth() + 1;
    const day = vn.getUTCDate();
    const hour = vn.getUTCHours();
    const minute = vn.getUTCMinutes();
    const second = vn.getUTCSeconds();
    const jsDay = vn.getUTCDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const hhMm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, hour, minute, second, dayOfWeek, hhMm, dateKey };
  }

  /**
   * Compute the next execution timestamp in UTC for a schedule in Vietnam (UTC+7)
   */
  public computeNextRunAt(
    timeOfDay: Date,
    repeatDays: number[] = [1, 2, 3, 4, 5, 6, 7],
    fromDate: Date = new Date(),
  ): Date | null {
    const targetH = timeOfDay.getUTCHours();
    const targetM = timeOfDay.getUTCMinutes();

    for (let offset = 0; offset <= 8; offset++) {
      const vnDate = new Date(
        fromDate.getTime() + 7 * 3600 * 1000 + offset * 24 * 3600 * 1000,
      );
      const y = vnDate.getUTCFullYear();
      const m = vnDate.getUTCMonth();
      const d = vnDate.getUTCDate();
      const candidateUtc = new Date(
        Date.UTC(y, m, d, targetH - 7, targetM, 0, 0),
      );
      if (candidateUtc.getTime() <= fromDate.getTime()) continue;

      const jsDay = vnDate.getUTCDay();
      const vnDay = jsDay === 0 ? 7 : jsDay;
      if (repeatDays.length > 0 && !repeatDays.includes(vnDay)) continue;

      return candidateUtc;
    }
    return null;
  }

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

  async listSchedules(userId: string, householdId: string): Promise<any[]> {
    await this.assertMembership(userId, householdId);

    const schedules = await this.prisma.schedule.findMany({
      where: { householdId },
      include: {
        device: {
          select: { id: true, name: true, deviceType: true, room: true },
        },
      },
      orderBy: { timeOfDay: 'asc' },
    });

    if (schedules.length === 0) {
      // Seed helpful default schedules
      const door = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'DOOR_SERVO' },
      });
      const fan = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'FAN' },
      });
      const light = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'LIGHT' },
      });

      const defaults: Array<{
        householdId: string;
        deviceId: string;
        action: Prisma.InputJsonValue;
        timeOfDay: Date;
        repeatDays: number[];
        isActive: boolean;
        createdBy: string;
      }> = [];

      if (door) {
        defaults.push({
          householdId,
          deviceId: door.id,
          action: {
            action: 'open',
            name: 'Mở cửa buổi sáng (90°)',
            params: { angle: 90, position: 'open' },
          },
          timeOfDay: this.parseTimeOfDay('07:00'),
          repeatDays: [1, 2, 3, 4, 5, 6, 7],
          isActive: true,
          createdBy: userId,
        });
        defaults.push({
          householdId,
          deviceId: door.id,
          action: {
            action: 'close',
            name: 'Đóng cửa an toàn ban đêm',
            params: { angle: 0, position: 'closed' },
          },
          timeOfDay: this.parseTimeOfDay('22:00'),
          repeatDays: [1, 2, 3, 4, 5, 6, 7],
          isActive: true,
          createdBy: userId,
        });
      }

      if (fan) {
        defaults.push({
          householdId,
          deviceId: fan.id,
          action: {
            action: 'turn_on',
            name: 'Bật quạt buổi trưa mát mẻ',
            params: { power: 'on' },
          },
          timeOfDay: this.parseTimeOfDay('11:30'),
          repeatDays: [1, 2, 3, 4, 5, 6, 7],
          isActive: true,
          createdBy: userId,
        });
      }

      if (light) {
        defaults.push({
          householdId,
          deviceId: light.id,
          action: {
            action: 'turn_off',
            name: 'Tắt đèn phòng ngủ ban đêm',
            params: { power: 'off' },
          },
          timeOfDay: this.parseTimeOfDay('23:00'),
          repeatDays: [1, 2, 3, 4, 5, 6, 7],
          isActive: true,
          createdBy: userId,
        });
      }

      if (defaults.length > 0) {
        await this.prisma.schedule.createMany({ data: defaults });
        return this.listSchedules(userId, householdId);
      }
    }

    return schedules.map((s) => {
      const actionData = (s.action as unknown as ScheduleActionData) ?? {
        action: 'turn_on',
      };
      return {
        id: s.id,
        householdId: s.householdId,
        deviceId: s.deviceId,
        deviceName: s.device?.name ?? 'Thiết bị',
        deviceType: s.device?.deviceType,
        room: s.device?.room,
        name: actionData.name || this.getDefaultName(s.device?.name, actionData.action, actionData.params),
        time: this.formatTimeOfDay(s.timeOfDay),
        action: actionData.action,
        params: actionData.params ?? {},
        repeatDays: s.repeatDays,
        timezone: s.timezone,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
        isActive: s.isActive,
        createdAt: s.createdAt,
      };
    });
  }

  private getDefaultName(deviceName?: string, action?: string, params?: Record<string, unknown>): string {
    const dev = deviceName || 'thiết bị';
    if (action === 'open') {
      const angle = params?.angle ?? 90;
      return `Mở ${dev} (${angle}°)`;
    }
    if (action === 'close') return `Đóng ${dev}`;
    if (action === 'turn_on') return `Bật ${dev}`;
    if (action === 'turn_off') return `Tắt ${dev}`;
    return `Điều khiển ${dev}`;
  }

  async createSchedule(
    userId: string,
    householdId: string,
    dto: CreateScheduleDto,
  ) {
    await this.assertMembership(userId, householdId);

    const device = await this.prisma.device.findFirst({
      where: { id: dto.deviceId, householdId },
    });
    if (!device) throw new NotFoundException('Device not found in household');

    const actionData: ScheduleActionData = {
      action: dto.action,
      name: dto.name || this.getDefaultName(device.name, dto.action, dto.params),
      params: dto.params,
    };

    const timeOfDay = this.parseTimeOfDay(dto.time);
    const repeatDays = dto.repeatDays ?? [1, 2, 3, 4, 5, 6, 7];
    const isActive = dto.isActive ?? true;
    const nextRunAt = isActive ? this.computeNextRunAt(timeOfDay, repeatDays) : null;

    const schedule = await this.prisma.schedule.create({
      data: {
        householdId,
        deviceId: dto.deviceId,
        action: actionData as unknown as Prisma.InputJsonValue,
        timeOfDay,
        repeatDays,
        timezone: 'Asia/Ho_Chi_Minh',
        nextRunAt,
        isActive,
        createdBy: userId,
      },
      include: {
        device: {
          select: { id: true, name: true, deviceType: true, room: true },
        },
      },
    });

    return {
      id: schedule.id,
      householdId: schedule.householdId,
      deviceId: schedule.deviceId,
      deviceName: schedule.device?.name,
      deviceType: schedule.device?.deviceType,
      room: schedule.device?.room,
      name: actionData.name,
      time: this.formatTimeOfDay(schedule.timeOfDay),
      action: actionData.action,
      params: actionData.params ?? {},
      repeatDays: schedule.repeatDays,
      timezone: schedule.timezone,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
    };
  }

  async updateSchedule(
    userId: string,
    householdId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ) {
    await this.assertMembership(userId, householdId);

    const existing = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, householdId },
      include: { device: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');

    const existingAction = (existing.action as unknown as ScheduleActionData) ?? {
      action: 'turn_on',
    };

    const updatedAction: ScheduleActionData = {
      action: dto.action ?? existingAction.action,
      name: dto.name ?? existingAction.name,
      params: dto.params !== undefined ? dto.params : existingAction.params,
    };

    const updatedTime =
      dto.time !== undefined ? this.parseTimeOfDay(dto.time) : existing.timeOfDay;
    const updatedRepeats =
      dto.repeatDays !== undefined ? dto.repeatDays : existing.repeatDays;
    const nextIsActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;
    const nextRunAt = nextIsActive
      ? this.computeNextRunAt(updatedTime, updatedRepeats)
      : null;

    const schedule = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
        ...(dto.time !== undefined ? { timeOfDay: updatedTime } : {}),
        ...(dto.action !== undefined ||
        dto.params !== undefined ||
        dto.name !== undefined
          ? { action: updatedAction as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.repeatDays !== undefined ? { repeatDays: dto.repeatDays } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        nextRunAt,
      },
      include: {
        device: {
          select: { id: true, name: true, deviceType: true, room: true },
        },
      },
    });

    return {
      id: schedule.id,
      householdId: schedule.householdId,
      deviceId: schedule.deviceId,
      deviceName: schedule.device?.name,
      deviceType: schedule.device?.deviceType,
      room: schedule.device?.room,
      name: updatedAction.name,
      time: this.formatTimeOfDay(schedule.timeOfDay),
      action: updatedAction.action,
      params: updatedAction.params ?? {},
      repeatDays: schedule.repeatDays,
      timezone: schedule.timezone,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
    };
  }

  async deleteSchedule(userId: string, householdId: string, scheduleId: string) {
    await this.assertMembership(userId, householdId);

    const existing = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, householdId },
    });
    if (!existing) throw new NotFoundException('Schedule not found');

    await this.prisma.schedule.delete({ where: { id: scheduleId } });
    return { success: true };
  }

  async triggerSchedule(userId: string, householdId: string, scheduleId: string) {
    await this.assertMembership(userId, householdId);

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, householdId },
      include: { device: true },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    const actionData = (schedule.action as unknown as ScheduleActionData) ?? {
      action: 'turn_on',
    };

    const result = await this.commands.executeCommand(
      userId,
      householdId,
      schedule.deviceId,
      {
        action: actionData.action as any,
        ...(actionData.params?.angle !== undefined
          ? { angle: Number(actionData.params.angle) }
          : {}),
      },
      CommandSource.SCHEDULE,
    );

    return { success: true, commandResult: result };
  }

  /**
   * Internal runner tick: checks current time in Vietnam (Asia/Ho_Chi_Minh)
   * and fires any matching active schedules.
   */
  async checkAndRunSchedules() {
    const now = new Date();
    const { hhMm: currentHHmm, dayOfWeek: currentDay, dateKey } = this.getVietnamTimeParts(now);

    // Clean up executed keys older than current minute
    const currentMinutePrefix = `${dateKey}:${currentHHmm}`;
    for (const key of this.executedKeys) {
      if (!key.includes(currentMinutePrefix)) {
        this.executedKeys.delete(key);
      }
    }

    const activeSchedules = await this.prisma.schedule.findMany({
      where: { isActive: true },
      include: { device: true },
    });

    for (const schedule of activeSchedules) {
      const scheduleTime = this.formatTimeOfDay(schedule.timeOfDay);
      if (scheduleTime !== currentHHmm) continue;

      // Check repeatDays: if empty, it runs once. If populated, must include currentDay
      const repeats = schedule.repeatDays;
      if (repeats.length > 0 && !repeats.includes(currentDay)) continue;

      const execKey = `${schedule.id}:${dateKey}:${currentHHmm}`;
      if (this.executedKeys.has(execKey)) continue;
      this.executedKeys.add(execKey);

      const actionData = (schedule.action as unknown as ScheduleActionData) ?? {
        action: 'turn_on',
      };

      this.logger.log(
        `[SCHEDULE] Firing schedule ${schedule.id} (${actionData.name || actionData.action}) for device ${schedule.deviceId}`,
      );

      try {
        await this.commands.executeCommand(
          schedule.createdBy,
          schedule.householdId,
          schedule.deviceId,
          {
            action: actionData.action as any,
            ...(actionData.params?.angle !== undefined
              ? { angle: Number(actionData.params.angle) }
              : {}),
          },
          CommandSource.SCHEDULE,
        );

        // If one-time schedule, disable it; otherwise calculate next occurrence
        if (repeats.length === 0) {
          await this.prisma.schedule.update({
            where: { id: schedule.id },
            data: { isActive: false, nextRunAt: null },
          });
        } else {
          const nextRun = this.computeNextRunAt(
            schedule.timeOfDay,
            schedule.repeatDays,
            new Date(),
          );
          await this.prisma.schedule.update({
            where: { id: schedule.id },
            data: { nextRunAt: nextRun },
          });
        }
      } catch (cmdError) {
        this.logger.warn(
          `[SCHEDULE] Failed to execute schedule ${schedule.id}:`,
          cmdError,
        );
      }
    }
  }
}
