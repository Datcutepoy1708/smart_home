import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseTelemetry } from './telemetry-payload.js';

export type TelemetryHook = (
  householdId: string,
  readings: Array<{ metric: string; value: number }>,
) => void;

@Injectable()
export class TelemetryService {
  private readonly hooks: TelemetryHook[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onTelemetry(hook: TelemetryHook) {
    this.hooks.push(hook);
  }
  async ingest(topic: string, payload: Buffer) {
    const message = parseTelemetry(
      topic,
      payload,
      this.config.getOrThrow('MQTT_TOPIC_ROOT'),
      Number(this.config.getOrThrow('MQTT_MAX_PAYLOAD_BYTES')),
    );
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const device = await tx.device.findFirst({
            where: {
              id: message.deviceId,
              householdId: message.householdId,
            },
          });
          if (!device) throw new Error('UNKNOWN_DEVICE');
          // Lock the device before assigning receive time so concurrent messages preserve order.
          await tx.device.update({
            where: { id: device.id },
            data: { isOnline: true },
          });
          const receivedAt = new Date();
          await tx.telemetryMessage.create({
            data: {
              deviceId: device.id,
              messageId: message.messageId,
              eventAt: new Date(message.timestamp),
              receivedAt,
            },
          });

          const readingRecords: Array<{
            deviceId: string;
            metric: string;
            value: number;
            unit: string;
            recordedAt: Date;
          }> = [];

          if (typeof message.data.temperature === 'number') {
            readingRecords.push({
              deviceId: device.id,
              metric: 'temperature',
              value: message.data.temperature,
              unit: '\u00b0C',
              recordedAt: receivedAt,
            });
          }
          if (typeof message.data.humidity === 'number') {
            readingRecords.push({
              deviceId: device.id,
              metric: 'humidity',
              value: message.data.humidity,
              unit: '%',
              recordedAt: receivedAt,
            });
          }
          if (typeof message.data.rain === 'number') {
            readingRecords.push({
              deviceId: device.id,
              metric: 'rain',
              value: message.data.rain,
              unit: '',
              recordedAt: receivedAt,
            });
          }
          if (typeof message.data.gas === 'number') {
            readingRecords.push({
              deviceId: device.id,
              metric: 'gas',
              value: message.data.gas,
              unit: 'ppm',
              recordedAt: receivedAt,
            });
          }
          if (typeof message.data.fire === 'number') {
            readingRecords.push({
              deviceId: device.id,
              metric: 'fire',
              value: message.data.fire,
              unit: '',
              recordedAt: receivedAt,
            });
          }

          if (readingRecords.length > 0) {
            await tx.sensorReading.createMany({
              data: readingRecords,
            });
          }

          // Safety Alert Generation
          if (message.data.fire === 1) {
            await tx.alert.create({
              data: {
                householdId: message.householdId,
                deviceId: device.id,
                alertType: 'FIRE_DETECTED',
                severity: 'CRITICAL',
                message: 'Phát hiện nguy cơ HỎA HOẠN tại nhà!',
              },
            });
          }
          if (message.data.gas === 1) {
            await tx.alert.create({
              data: {
                householdId: message.householdId,
                deviceId: device.id,
                alertType: 'GAS_LEAK_DETECTED',
                severity: 'CRITICAL',
                message: 'Cảnh báo RÒ RỈ KHÍ GAS / KHÓI nồng độ cao!',
              },
            });
          }

          await tx.device.update({
            where: { id: device.id },
            data: { lastSeenAt: receivedAt },
          });
        },
        {
          maxWait: Number(this.config.getOrThrow('DB_TRANSACTION_MAX_WAIT_MS')),
          timeout: Number(this.config.getOrThrow('DB_TRANSACTION_TIMEOUT_MS')),
        },
      );

      // Evaluate active hooks (e.g. automations) with incoming readings
      const hookReadings: Array<{ metric: string; value: number }> = [];
      if (typeof message.data.temperature === 'number') {
        hookReadings.push({ metric: 'temperature', value: message.data.temperature });
      }
      if (typeof message.data.humidity === 'number') {
        hookReadings.push({ metric: 'humidity', value: message.data.humidity });
      }
      if (typeof message.data.rain === 'number') {
        hookReadings.push({ metric: 'rain', value: message.data.rain });
      }
      if (typeof message.data.gas === 'number') {
        hookReadings.push({ metric: 'gas', value: message.data.gas });
      }
      if (typeof message.data.fire === 'number') {
        hookReadings.push({ metric: 'fire', value: message.data.fire });
      }

      for (const hook of this.hooks) {
        try {
          hook(message.householdId, hookReadings);
        } catch {
          /* best effort */
        }
      }

      return 'accepted';
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return 'duplicate';
      throw error;
    }
  }
}
