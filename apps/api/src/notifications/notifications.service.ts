import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FcmService, PushNotificationPayload } from './fcm.service.js';
import { RegisterFcmTokenDto } from './notifications.dto.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  async registerToken(userId: string, dto: RegisterFcmTokenDto) {
    const existing = await this.prisma.fcmToken.findFirst({
      where: {
        userId,
        token: dto.token,
      },
    });

    if (existing) {
      return this.prisma.fcmToken.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          platform: dto.platform ?? existing.platform,
        },
      });
    }

    return this.prisma.fcmToken.create({
      data: {
        userId,
        token: dto.token,
        platform: dto.platform ?? 'android',
        isActive: true,
      },
    });
  }

  async unregisterToken(userId: string, token: string) {
    return this.prisma.fcmToken.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });
  }

  isFcmReady(): boolean {
    return this.fcm.isReady();
  }

  async notifyHousehold(householdId: string, payload: PushNotificationPayload) {
    if (!this.fcm.isReady()) {
      this.logger.warn(
        `Cannot send push notification to household ${householdId}: Firebase Admin SDK is not ready`,
      );
      return { successCount: 0, failureCount: 0 };
    }

    // Get household creator and all members
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!household) return { successCount: 0, failureCount: 0 };

    const userIds = new Set<string>([household.createdBy]);
    for (const m of household.members) {
      userIds.add(m.userId);
    }

    const activeTokens = await this.prisma.fcmToken.findMany({
      where: {
        userId: { in: Array.from(userIds) },
        isActive: true,
      },
      select: { token: true },
    });

    const tokenList = activeTokens.map((t) => t.token);
    if (tokenList.length === 0) {
      this.logger.debug(`No active FCM tokens for household ${householdId}`);
      return { successCount: 0, failureCount: 0 };
    }

    const result = await this.fcm.sendToTokens(tokenList, payload);

    if (result.invalidTokens.length > 0) {
      await this.prisma.fcmToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
    }

    return result;
  }

  async notifyUser(userId: string, payload: PushNotificationPayload) {
    if (!this.fcm.isReady()) {
      this.logger.warn(
        `Cannot send push notification to user ${userId}: Firebase Admin SDK is not ready`,
      );
      return { successCount: 0, failureCount: 0 };
    }

    const activeTokens = await this.prisma.fcmToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: { token: true },
    });

    const tokenList = activeTokens.map((t) => t.token);
    if (tokenList.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const result = await this.fcm.sendToTokens(tokenList, payload);

    if (result.invalidTokens.length > 0) {
      await this.prisma.fcmToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
    }

    return result;
  }
}
