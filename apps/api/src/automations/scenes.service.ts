import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CommandsService } from '../devices/commands.service.js';
import type { CreateSceneDto } from './scenes.dto.js';

@Injectable()
export class ScenesService {
  private readonly logger = new Logger(ScenesService.name);

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

  async listScenes(userId: string, householdId: string): Promise<any[]> {
    await this.assertMembership(userId, householdId);

    const scenes = await this.prisma.scene.findMany({
      where: { householdId },
      include: {
        actions: {
          include: {
            device: {
              select: { id: true, name: true, deviceType: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (scenes.length === 0) {
      // Seed default smart home scenes
      const door = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'DOOR_SERVO' },
      });
      const fan = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'FAN' },
      });
      const light = await this.prisma.device.findFirst({
        where: { householdId, deviceType: 'LIGHT' },
      });

      if (door || fan || light) {
        // Scene 1: Về nhà
        const sceneHome = await this.prisma.scene.create({
          data: {
            householdId,
            name: 'Về nhà',
            icon: 'home',
            createdBy: userId,
          },
        });
        const homeActions: Prisma.SceneActionCreateManyInput[] = [];
        if (door) homeActions.push({ sceneId: sceneHome.id, deviceId: door.id, action: { action: 'open', params: { angle: 90, position: 'open' } }, orderIndex: 0 });
        if (light) homeActions.push({ sceneId: sceneHome.id, deviceId: light.id, action: { action: 'turn_on', params: { power: 'on' } }, orderIndex: 1 });
        if (fan) homeActions.push({ sceneId: sceneHome.id, deviceId: fan.id, action: { action: 'turn_on', params: { power: 'on' } }, orderIndex: 2 });
        if (homeActions.length) await this.prisma.sceneAction.createMany({ data: homeActions });

        // Scene 2: Rời nhà
        const sceneLeave = await this.prisma.scene.create({
          data: {
            householdId,
            name: 'Rời nhà',
            icon: 'exit-outline',
            createdBy: userId,
          },
        });
        const leaveActions: Prisma.SceneActionCreateManyInput[] = [];
        if (light) leaveActions.push({ sceneId: sceneLeave.id, deviceId: light.id, action: { action: 'turn_off', params: { power: 'off' } }, orderIndex: 0 });
        if (fan) leaveActions.push({ sceneId: sceneLeave.id, deviceId: fan.id, action: { action: 'turn_off', params: { power: 'off' } }, orderIndex: 1 });
        if (door) leaveActions.push({ sceneId: sceneLeave.id, deviceId: door.id, action: { action: 'close', params: { angle: 0, position: 'closed' } }, orderIndex: 2 });
        if (leaveActions.length) await this.prisma.sceneAction.createMany({ data: leaveActions });

        // Scene 3: Đi ngủ
        const sceneSleep = await this.prisma.scene.create({
          data: {
            householdId,
            name: 'Đi ngủ',
            icon: 'moon',
            createdBy: userId,
          },
        });
        const sleepActions: Prisma.SceneActionCreateManyInput[] = [];
        if (light) sleepActions.push({ sceneId: sceneSleep.id, deviceId: light.id, action: { action: 'turn_off', params: { power: 'off' } }, orderIndex: 0 });
        if (door) sleepActions.push({ sceneId: sceneSleep.id, deviceId: door.id, action: { action: 'close', params: { angle: 0, position: 'closed' } }, orderIndex: 1 });
        if (fan) sleepActions.push({ sceneId: sceneSleep.id, deviceId: fan.id, action: { action: 'turn_on', params: { power: 'on' } }, orderIndex: 2 });
        if (sleepActions.length) await this.prisma.sceneAction.createMany({ data: sleepActions });

        return this.listScenes(userId, householdId);
      }
    }

    return scenes.map((s) => ({
      id: s.id,
      householdId: s.householdId,
      name: s.name,
      icon: s.icon ?? 'flash',
      actions: s.actions.map((a) => {
        const actionPayload = (a.action as Record<string, unknown>) ?? {};
        return {
          id: a.id,
          deviceId: a.deviceId,
          deviceName: a.device?.name,
          deviceType: a.device?.deviceType,
          action: (actionPayload.action as string) ?? 'turn_on',
          params: (actionPayload.params as Record<string, unknown>) ?? {},
          orderIndex: a.orderIndex,
        };
      }),
      createdAt: s.createdAt,
    }));
  }

  async triggerScene(userId: string, householdId: string, sceneId: string) {
    await this.assertMembership(userId, householdId);

    const scene = await this.prisma.scene.findFirst({
      where: { id: sceneId, householdId },
      include: {
        actions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!scene) throw new NotFoundException('Scene not found');

    const results = [];
    for (const item of scene.actions) {
      const actionPayload = (item.action as Record<string, unknown>) ?? {};
      const actionName = (actionPayload.action as string) ?? 'turn_on';
      const params = (actionPayload.params as Record<string, unknown>) ?? {};

      try {
        const res = await this.commands.executeCommand(
          userId,
          householdId,
          item.deviceId,
          {
            action: actionName as any,
            ...(params.angle !== undefined ? { angle: Number(params.angle) } : {}),
          },
          CommandSource.SCENE,
        );
        results.push({ deviceId: item.deviceId, success: true, res });
      } catch (err) {
        this.logger.warn(`Failed executing scene action on device ${item.deviceId}:`, err);
        results.push({ deviceId: item.deviceId, success: false, error: err instanceof Error ? err.message : 'Failed' });
      }
    }

    return {
      sceneId,
      name: scene.name,
      results,
    };
  }

  async createScene(userId: string, householdId: string, dto: CreateSceneDto) {
    await this.assertMembership(userId, householdId);

    const scene = await this.prisma.scene.create({
      data: {
        householdId,
        name: dto.name,
        icon: dto.icon || 'flash',
        createdBy: userId,
        actions: {
          create: dto.actions.map((a, idx) => ({
            device: { connect: { id: a.deviceId } },
            action: { action: a.action, params: a.params || {} } as unknown as Prisma.InputJsonValue,
            orderIndex: idx,
          })),
        },
      },
      include: {
        actions: {
          include: { device: { select: { id: true, name: true, deviceType: true } } },
        },
      },
    });

    return scene;
  }

  async deleteScene(userId: string, householdId: string, sceneId: string) {
    await this.assertMembership(userId, householdId);

    const existing = await this.prisma.scene.findFirst({
      where: { id: sceneId, householdId },
    });
    if (!existing) throw new NotFoundException('Scene not found');

    await this.prisma.scene.delete({ where: { id: sceneId } });
    return { success: true };
  }
}
