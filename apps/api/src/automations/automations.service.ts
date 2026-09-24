import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CommandsService } from '../devices/commands.service.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import type { CreateRuleDto, UpdateRuleDto } from './automations.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class AutomationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: CommandsService,
    private readonly telemetry: TelemetryService,
  ) {}

  onModuleInit() {
    this.telemetry.onTelemetry((householdId, readings) => {
      void this.evaluateTelemetry(householdId, readings);
    });
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

  async listRules(userId: string, householdId: string) {
    await this.assertMembership(userId, householdId);

    const rules = await this.prisma.rule.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });

    if (rules.length === 0) {
      // Seed default smart rules if none exist yet
      const fan = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'FAN' },
      });
      const door = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'DOOR_SERVO' },
      });

      const defaults: Prisma.RuleCreateManyInput[] = [];
      if (fan) {
        defaults.push({
          householdId,
          name: 'Tự động bật quạt khi trời nóng (> 30°C)',
          condition: { metric: 'temperature', operator: '>', value: 30 },
          action: { targetDeviceId: fan.id, action: 'turn_on', params: { power: 'on' } },
          createdBy: userId,
          isActive: true,
        });
        defaults.push({
          householdId,
          name: 'Tự động tắt quạt khi nhiệt độ mát (< 26°C)',
          condition: { metric: 'temperature', operator: '<', value: 26 },
          action: { targetDeviceId: fan.id, action: 'turn_off', params: { power: 'off' } },
          createdBy: userId,
          isActive: true,
        });
      }
      if (door) {
        defaults.push({
          householdId,
          name: 'Đóng cửa an toàn ban đêm',
          condition: { metric: 'schedule_time', operator: '==', value: '22:00' },
          action: { targetDeviceId: door.id, action: 'close', params: { angle: 0, position: 'closed' } },
          createdBy: userId,
          isActive: false,
        });
      }

      if (defaults.length > 0) {
        await this.prisma.rule.createMany({ data: defaults });
        return this.prisma.rule.findMany({
          where: { householdId },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    return rules;
  }

  async createRule(userId: string, householdId: string, dto: CreateRuleDto) {
    await this.assertMembership(userId, householdId);

    return this.prisma.rule.create({
      data: {
        householdId,
        name: dto.name,
        condition: dto.condition as unknown as Prisma.InputJsonValue,
        action: dto.action as unknown as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        createdBy: userId,
      },
    });
  }

  async updateRule(
    userId: string,
    householdId: string,
    ruleId: string,
    dto: UpdateRuleDto,
  ) {
    await this.assertMembership(userId, householdId);

    const existing = await this.prisma.rule.findFirst({
      where: { id: ruleId, householdId },
    });
    if (!existing) throw new NotFoundException('Rule not found');

    return this.prisma.rule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.condition !== undefined
          ? { condition: dto.condition as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.action !== undefined
          ? { action: dto.action as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteRule(userId: string, householdId: string, ruleId: string) {
    await this.assertMembership(userId, householdId);

    const existing = await this.prisma.rule.findFirst({
      where: { id: ruleId, householdId },
    });
    if (!existing) throw new NotFoundException('Rule not found');

    await this.prisma.rule.delete({ where: { id: ruleId } });
    return { success: true };
  }

  /**
   * Evaluates active rules against incoming sensor telemetry.
   * If a rule triggers, executes the command and logs into ActionLog.
   */
  async evaluateTelemetry(
    householdId: string,
    readings: Array<{ metric: string; value: number }>,
  ) {
    try {
      const activeRules = await this.prisma.rule.findMany({
        where: { householdId, isActive: true },
      });

      for (const rule of activeRules) {
        const condition = rule.condition as {
          metric?: string;
          operator?: string;
          value?: number;
        };
        const action = rule.action as {
          targetDeviceId?: string;
          action?: string;
          params?: Record<string, unknown>;
        };

        if (!condition?.metric || condition?.value === undefined || !action?.targetDeviceId || !action?.action) {
          continue;
        }

        const reading = readings.find((r) => r.metric === condition.metric);
        if (!reading) continue;

        let triggered = false;
        if (condition.operator === '>' && reading.value > condition.value) triggered = true;
        if (condition.operator === '>=' && reading.value >= condition.value) triggered = true;
        if (condition.operator === '<' && reading.value < condition.value) triggered = true;
        if (condition.operator === '<=' && reading.value <= condition.value) triggered = true;

        if (triggered) {
          // Check target device's current state to avoid spamming identical commands
          const stateRecord = await this.prisma.deviceState.findUnique({
            where: { deviceId: action.targetDeviceId },
          });
          const currentState = (stateRecord?.state as Record<string, unknown> | null) ?? {};

          let alreadyInState = false;
          if (action.action === 'turn_on' && currentState.power === 'on') alreadyInState = true;
          if (action.action === 'turn_off' && currentState.power === 'off') alreadyInState = true;
          if (action.action === 'close' && currentState.position === 'closed') alreadyInState = true;

          if (alreadyInState) continue;

          // Execute action via commands service
          try {
            await this.commands.executeCommand(
              rule.createdBy,
              householdId,
              action.targetDeviceId,
              {
                action: action.action as any,
                ...(action.params?.angle !== undefined ? { angle: Number(action.params.angle) } : {}),
              },
            );

            // Log action to ActionLog
            await this.prisma.actionLog.create({
              data: {
                householdId,
                deviceId: action.targetDeviceId,
                userId: rule.createdBy,
                action: `[Tự động] ${rule.name}`,
                source: 'RULE',
                newValue: (action.params ?? {}) as unknown as Prisma.InputJsonValue,
                createdAt: new Date(),
              },
            });
          } catch (cmdErr) {
            // Log warning but don't fail telemetry processing
            console.warn(`[AUTOMATION] Rule '${rule.name}' execution failed:`, cmdErr);
          }
        }
      }
    } catch (err) {
      console.warn('[AUTOMATION] evaluateTelemetry failed:', err);
    }
  }
}
