import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type MqttClient } from 'mqtt';
import { TelemetryService } from './telemetry.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseAvailability } from './availability-payload.js';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;
  private timer?: ReturnType<typeof setInterval>;
  private readonly pending = new Set<Promise<void>>();
  private expiring = false;
  constructor(
    private readonly config: ConfigService,
    private readonly telemetry: TelemetryService,
    private readonly prisma: PrismaService,
  ) {}
  get connected() {
    return this.client?.connected ?? false;
  }
  onModuleInit() {
    if (this.config.get('NODE_ENV') === 'test') return;
    const initial = Number(this.config.getOrThrow('MQTT_RECONNECT_MIN_MS'));
    this.client = connect(this.config.getOrThrow<string>('MQTT_URL'), {
      username: this.config.get<string>('MQTT_USERNAME') || undefined,
      password: this.config.get<string>('MQTT_PASSWORD') || undefined,
      reconnectPeriod: initial,
      connectTimeout: Number(this.config.getOrThrow('MQTT_CONNECT_TIMEOUT_MS')),
      resubscribe: false,
    });
    this.client.on('connect', () => {
      this.client!.options.reconnectPeriod = initial;
      const root = this.config.getOrThrow<string>('MQTT_TOPIC_ROOT');
      this.client!.subscribe(
        [
          `${root}/+/device/+/telemetry`,
          `${root}/+/device/+/state`,
          `${root}/+/device/+/ack`,
          `${root}/+/device/+/availability`,
        ],
        { qos: 1 },
        (error) => {
          this.log(error ? 'MQTT_SUBSCRIBE_FAILED' : 'MQTT_CONNECTED');
          if (error) this.client?.reconnect();
        },
      );
    });
    this.client.on('reconnect', () => {
      this.client!.options.reconnectPeriod = Math.min(
        (this.client!.options.reconnectPeriod ?? initial) * 2,
        Number(this.config.getOrThrow('MQTT_RECONNECT_MAX_MS')),
      );
      this.log('MQTT_RECONNECT');
    });
    this.client.on('error', () => this.log('MQTT_CONNECTION_ERROR'));
    this.client.on('message', (topic, payload, packet) => {
      if (
        this.pending.size >= Number(this.config.getOrThrow('MQTT_MAX_INFLIGHT'))
      ) {
        this.log('TELEMETRY_OVERLOAD');
        return;
      }
      if (topic.endsWith('/availability')) {
        // Retained online messages must not resurrect a disconnected device.
        if (packet.retain) return;
        const task = this.ingestAvailability(topic, payload)
          .catch(() => this.log('AVAILABILITY_REJECTED'))
          .finally(() => this.pending.delete(task));
        this.pending.add(task);
      } else if (topic.endsWith('/telemetry')) {
        const task = this.telemetry
          .ingest(topic, payload)
          .then((result) => this.log(`TELEMETRY_${result.toUpperCase()}`))
          .catch(() => this.log('TELEMETRY_REJECTED'))
          .finally(() => this.pending.delete(task));
        this.pending.add(task);
      } else if (topic.endsWith('/state') || topic.endsWith('/ack')) {
        this.handleDeviceAck(topic, payload);
      }
    });
    this.timer = setInterval(
      () => {
        if (this.expiring) return;
        this.expiring = true;
        void this.prisma.device
          .updateMany({
            where: {
              isOnline: true,
              lastSeenAt: {
                lt: new Date(
                  Date.now() -
                    Number(this.config.getOrThrow('DEVICE_OFFLINE_AFTER_MS')),
                ),
              },
            },
            data: { isOnline: false },
          })
          .catch(() => this.log('DEVICE_EXPIRY_FAILED'))
          .finally(() => {
            this.expiring = false;
          });
      },
      Number(this.config.getOrThrow('DEVICE_STATUS_INTERVAL_MS')),
    );
  }

  private readonly ackHandlers = new Map<
    string,
    {
      householdId: string;
      deviceId: string;
      handler: (ack: { commandId: string; status: string; state?: Record<string, unknown> }) => void;
    }
  >();

  private async ingestAvailability(topic: string, payload: Buffer) {
    const message = parseAvailability(topic, payload,
      this.config.getOrThrow<string>('MQTT_TOPIC_ROOT'),
      Number(this.config.getOrThrow('MQTT_MAX_PAYLOAD_BYTES')));
    await this.prisma.device.updateMany({
      where: { id: message.deviceId, householdId: message.householdId,
        deviceType: { in: ['LIGHT', 'FAN', 'DOOR_SERVO'] } },
      data: { isOnline: message.online,
        ...(message.online ? { lastSeenAt: new Date() } : {}) },
    });
  }

  registerAckHandler(
    commandId: string,
    householdId: string,
    deviceId: string,
    handler: (ack: { commandId: string; status: string; state?: Record<string, unknown> }) => void,
  ) {
    this.ackHandlers.set(commandId, { householdId, deviceId, handler });
  }

  unregisterAckHandler(commandId: string) {
    this.ackHandlers.delete(commandId);
  }

  /**
   * Route an inbound /state or /ack message to the correct pending ACK handler.
   *
   * Topic format: {root}/{householdId}/device/{deviceId}/state|ack
   *
   * We validate that the topic's householdId and deviceId match what was
   * registered for the commandId — this prevents a rogue device or a
   * replayed message on a different topic from resolving the wrong command.
   */
  private handleDeviceAck(topic: string, payload: Buffer) {
    try {
      const parsed = JSON.parse(payload.toString()) as Record<string, unknown>;
      if (!parsed || typeof parsed['commandId'] !== 'string') return;

      const commandId = parsed['commandId'] as string;
      const entry = this.ackHandlers.get(commandId);
      if (!entry) return;

      // Validate topic segments: root/HID/device/DID/state|ack
      const segments = topic.split('/');
      const topicHouseholdId = segments[segments.length - 4];
      const topicDeviceId = segments[segments.length - 2];

      if (
        topicHouseholdId !== entry.householdId ||
        topicDeviceId !== entry.deviceId
      ) {
        this.log('MQTT_ACK_TOPIC_MISMATCH');
        return;
      }

      // deviceId is mandatory in the payload and must match the registered device.
      // An absent or wrong deviceId is rejected — we don't silently skip unknown senders.
      const payloadDeviceId = parsed['deviceId'];
      if (typeof payloadDeviceId !== 'string' || payloadDeviceId !== entry.deviceId) {
        this.log('MQTT_ACK_DEVICE_MISMATCH');
        return;
      }

      // Accept only the schema version we know how to parse.
      // schemaVersion: 999 or any other unknown version is rejected.
      if (parsed['schemaVersion'] !== 1) {
        this.log('MQTT_ACK_INVALID_SCHEMA');
        return;
      }

      entry.handler(
        parsed as { commandId: string; status: string; state?: Record<string, unknown> },
      );
    } catch {
      this.log('MQTT_ACK_PARSE_FAILED');
    }
  }

  async publish(topic: string, payload: string | Buffer): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT broker not connected');
    }
    await new Promise<void>((resolve, reject) => {
      this.client!.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.client?.endAsync(true);
    await Promise.allSettled(this.pending);
  }
  private log(code: string) {
    this.logger.log(JSON.stringify({ code }));
  }
}
