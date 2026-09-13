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
      this.client!.subscribe(
        `${this.config.getOrThrow<string>('MQTT_TOPIC_ROOT')}/+/device/+/telemetry`,
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
    this.client.on('message', (topic, payload) => {
      if (
        this.pending.size >= Number(this.config.getOrThrow('MQTT_MAX_INFLIGHT'))
      ) {
        this.log('TELEMETRY_OVERLOAD');
        return;
      }
      const task = this.telemetry
        .ingest(topic, payload)
        .then((result) => this.log(`TELEMETRY_${result.toUpperCase()}`))
        .catch(() => this.log('TELEMETRY_REJECTED'))
        .finally(() => this.pending.delete(task));
      this.pending.add(task);
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
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.client?.endAsync(true);
    await Promise.allSettled(this.pending);
  }
  private log(code: string) {
    this.logger.log(JSON.stringify({ code }));
  }
}
