import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseTelemetry } from './telemetry-payload.js';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
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
              deviceType: 'DHT_SENSOR',
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
          await tx.sensorReading.createMany({
            data: [
              {
                deviceId: device.id,
                metric: 'temperature',
                value: message.data.temperature,
                unit: '\u00b0C',
                recordedAt: receivedAt,
              },
              {
                deviceId: device.id,
                metric: 'humidity',
                value: message.data.humidity,
                unit: '%',
                recordedAt: receivedAt,
              },
            ],
          });
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
