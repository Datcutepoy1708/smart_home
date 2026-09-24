import {
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandSource, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MqttService } from '../telemetry/mqtt.service.js';
import type { ExecuteCommandDto } from './execute-command.dto.js';
import { commandParams, confirmedCommandState } from './command-contract.js';

@Injectable()
export class CommandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mqtt: MqttService,
  ) {}

  async executeCommand(
    userId: string,
    householdId: string,
    deviceId: string,
    dto: ExecuteCommandDto,
    source: CommandSource = CommandSource.APP,
  ) {
    const now = new Date();

    // 1. Check membership and role — only OWNER or MEMBER may send commands
    const membership = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        // Role guard: must be OWNER or MEMBER, not GUEST
        role: { in: ['OWNER', 'MEMBER'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        'Chỉ thành viên hoặc chủ nhà mới được điều khiển thiết bị.',
      );
    }

    // 2. Fetch device
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, householdId },
      include: { state: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const params = commandParams(device.deviceType, dto.action, dto.angle);

    // Check device online status
    const isOnline = Boolean(
      device.isOnline && device.lastSeenAt &&
        now.getTime() - device.lastSeenAt.getTime() <
          Number(this.config.getOrThrow('DEVICE_OFFLINE_AFTER_MS')),
    );
    if (!isOnline) {
      throw new ConflictException(
        'Thiết bị đang ngoại tuyến. Không thể gửi lệnh điều khiển.',
      );
    }

    // 3. Prepare command details
    const commandId = randomUUID();
    const topicRoot = this.config.getOrThrow<string>('MQTT_TOPIC_ROOT');
    const commandTopic = `${topicRoot}/${householdId}/device/${deviceId}/command`;

    const commandPayload = {
      schemaVersion: 1,
      commandId,
      deviceId,
      action: dto.action,
      params,
      timestamp: new Date().toISOString(),
    };

    // 4. Create DeviceCommand record in DB (PENDING)
    const commandRecord = await this.prisma.deviceCommand.create({
      data: {
        id: commandId,
        householdId,
        deviceId,
        requestedBy: userId,
        command: commandPayload,
        source,
        status: 'PENDING',
      },
    });

    // 5. Register ACK handler BEFORE publishing to avoid race condition
    //    where the device ACKs before we even start listening.
    const timeoutMs = 5000;
    const ackResult = await new Promise<{
      commandId: string;
      status: string;
      state?: Record<string, unknown>;
    }>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.mqtt.unregisterAckHandler(commandId);
        reject(
          new GatewayTimeoutException(
            'Thiết bị không phản hồi trong thời gian quy định.',
          ),
        );
      }, timeoutMs);

      // Register first, publish second
      this.mqtt.registerAckHandler(
        commandId,
        householdId,
        deviceId,
        (ack) => {
          clearTimeout(timer);
          this.mqtt.unregisterAckHandler(commandId);
          resolve(ack);
        },
      );

      // Publish the command; clean up handler if publish fails.
      // Use updateMany with a status guard so this PENDING→SENT transition
      // is a no-op if the command was already ACKNOWLEDGED by a fast device.
      this.mqtt
        .publish(commandTopic, JSON.stringify(commandPayload))
        .then(() =>
          this.prisma.deviceCommand.updateMany({
            where: { id: commandRecord.id, status: 'PENDING' },
            data: { sentAt: new Date(), status: 'SENT' },
          }),
        )
        .catch(async (err: unknown) => {
          clearTimeout(timer);
          this.mqtt.unregisterAckHandler(commandId);
          // Guard with status check: if the device already ACKed before the
          // publish callback fired, do not overwrite ACKNOWLEDGED → FAILED.
          await this.prisma.deviceCommand.updateMany({
            where: { id: commandRecord.id, status: { in: ['PENDING', 'SENT'] } },
            data: {
              status: 'FAILED',
              errorMessage: 'Failed to publish to MQTT',
            },
          });
          reject(
            err instanceof Error && err.message
              ? new ConflictException(
                  `Không thể gửi lệnh tới MQTT broker: ${err.message}`,
                )
              : new ConflictException('Không thể gửi lệnh tới MQTT broker'),
          );
        });
    }).catch(async (err: unknown) => {
      // Persist TIMEOUT or FAILED status when the promise rejects
      const isTimeout = err instanceof GatewayTimeoutException;
      const isConflict = err instanceof ConflictException;
      if (isTimeout || isConflict) {
        await this.prisma.deviceCommand
          .update({
            where: { id: commandRecord.id },
            data: {
              status: isTimeout ? 'TIMEOUT' : 'FAILED',
              errorMessage: isTimeout
                ? `Device ACK timeout after ${timeoutMs}ms`
                : 'MQTT publish failed',
            },
          })
          .catch(() => {
            /* best-effort */
          });
      }
      throw err;
    });

    // 6. Validate ACK result — device must explicitly report success
    if (ackResult.status !== 'success') {
      const reason =
        typeof ackResult.status === 'string' ? ackResult.status : 'unknown';
      await this.prisma.deviceCommand
        .update({
          where: { id: commandRecord.id },
          data: {
            status: 'FAILED',
            errorMessage: `Device reported failure: ${reason}`,
          },
        })
        .catch(() => {
          /* best-effort */
        });
      throw new ConflictException(
        `Thiết bị báo lỗi khi thực hiện lệnh: ${reason}`,
      );
    }

    let newState: Prisma.InputJsonObject;
    try {
      newState = confirmedCommandState(device.deviceType, ackResult.state);
      // An ACK for a different target must not turn a failed operation into success.
      if (Object.entries(params).some(([key, value]) => newState[key] !== value))
        throw new ConflictException('Device did not reach the requested output');
    } catch (error) {
      await this.prisma.deviceCommand.update({
        where: { id: commandRecord.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Invalid or mismatched ACK state' },
      });
      throw error;
    }
    const completedAt = new Date();

    // 7. Update DeviceCommand, DeviceState, and ActionLog atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.deviceCommand.update({
        where: { id: commandRecord.id },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: completedAt,
          completedAt,
        },
      });

      await tx.deviceState.upsert({
        where: { deviceId },
        create: {
          deviceId,
          state: newState,
        },
        update: {
          state: newState,
        },
      });

      await tx.actionLog.create({
        data: {
          householdId,
          deviceId,
          userId,
          action: dto.action,
          source,
          oldValue: (device.state?.state as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          newValue: newState,
        },
      });
    });

    return {
      commandId,
      status: 'ACKNOWLEDGED',
      state: newState,
    };
  }
}
