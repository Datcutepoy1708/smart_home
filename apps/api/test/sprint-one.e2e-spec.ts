import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TelemetryService } from '../src/telemetry/telemetry.service.js';
import { MqttService } from '../src/telemetry/mqtt.service.js';
import { ConfigService } from '@nestjs/config';
import { connectAsync } from 'mqtt';

describe.skipIf(process.env.RUN_DB_TESTS !== '1')(
  'Sprint 1 PostgreSQL integration',
  () => {
    let app: INestApplication;
    let db: PrismaService;
    beforeAll(async () => {
      if (new URL(process.env.DATABASE_URL!).pathname !== '/smart_home_test')
        throw new Error('Dedicated test database required');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
      db = app.get(PrismaService);
    });
    afterAll(async () => {
      await app?.close();
    });
    it('stores a real broker message and safely rejects malformed messages', async () => {
      const config = app.get(ConfigService);
      const brokerUrl = config.getOrThrow<string>('MQTT_URL');
      if (!['localhost', '127.0.0.1'].includes(new URL(brokerUrl).hostname))
        throw new Error('Local broker required');
      const user = await db.user.create({
        data: { email: `mqtt-${randomUUID()}@example.com`, name: 'MQTT Test' },
      });
      const household = await db.household.create({
        data: { name: 'MQTT Home', createdBy: user.id },
      });
      const deviceId = randomUUID();
      const topic = `home/${household.id}/device/${deviceId}/telemetry`;
      await db.device.create({
        data: {
          id: deviceId,
          householdId: household.id,
          name: 'MQTT Sensor',
          deviceUid: deviceId,
          mqttTopic: topic,
          authTokenHash: 'test-unused',
          deviceType: 'DHT_SENSOR',
        },
      });
      config.set('NODE_ENV', 'development');
      const mqtt = app.get(MqttService);
      mqtt.onModuleInit();
      const client = await connectAsync(brokerUrl, {
        reconnectPeriod: 0,
        connectTimeout: 5000,
      });
      try {
        await vi.waitFor(() => expect(mqtt.connected).toBe(true), {
          timeout: 5000,
        });
        const payload = JSON.stringify({
          schemaVersion: 1,
          messageId: randomUUID(),
          deviceId,
          timestamp: new Date().toISOString(),
          data: { temperature: 26, humidity: 55 },
        });
        await client.publishAsync(topic, '{', { qos: 1 });
        await client.publishAsync(topic, payload, { qos: 1 });
        await client.publishAsync(topic, payload, { qos: 1 });
        await vi.waitFor(
          async () =>
            expect(await db.sensorReading.count({ where: { deviceId } })).toBe(
              2,
            ),
          { timeout: 5000 },
        );
      } finally {
        await client.endAsync();
        config.set('NODE_ENV', 'test');
      }
    }, 15000);
    it('registers, rotates once under concurrency, rejects replay, logs out and isolates households', async () => {
      const email = `test-${randomUUID()}@example.com`;
      const password = 'test-password-only';
      const server = app.getHttpServer();
      const registered = await request(server)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test Owner',
          householdName: 'Test Home',
          email,
          password,
        })
        .expect(201);
      const auth = registered.body;
      expect(auth.households[0].role).toBe('owner');
      expect(JSON.stringify(auth)).not.toMatch(/passwordHash|tokenHash/);
      const stored = await db.user.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).not.toBe(password);
      await request(server)
        .get('/api/v1/auth/me')
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(200);
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: 'incorrect' })
        .expect(401);
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: email.toUpperCase(), password })
        .expect(200);
      const rotations = await Promise.all(
        [1, 2].map(() =>
          request(server)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: auth.tokens.refreshToken }),
        ),
      );
      expect(rotations.map((r) => r.status).sort()).toEqual([200, 401]);
      const rotated = rotations.find((r) => r.status === 200)!.body;
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: auth.tokens.refreshToken })
        .expect(401);
      await request(server)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: rotated.tokens.refreshToken })
        .expect(204);
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.tokens.refreshToken })
        .expect(401);
      const other = await db.household.create({
        data: { name: 'Other Home', createdBy: stored.id },
      });
      await request(server)
        .get(`/api/v1/households/${other.id}/devices`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(403);
      await db.householdMember.create({
        data: {
          userId: stored.id,
          householdId: other.id,
          role: 'GUEST',
          expiresAt: new Date(0),
        },
      });
      await request(server)
        .get(`/api/v1/households/${other.id}/devices`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(403);
      const homeId = auth.households[0].id;
      const deviceId = randomUUID();
      await db.device.create({
        data: {
          id: deviceId,
          householdId: homeId,
          name: 'Test Sensor',
          deviceUid: deviceId,
          mqttTopic: `home/${homeId}/device/${deviceId}`,
          authTokenHash: 'local-test-unused',
          deviceType: 'DHT_SENSOR',
        },
      });
      const telemetry = app.get(TelemetryService);
      const topic = `home/${homeId}/device/${deviceId}/telemetry`;
      const payload = Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          messageId: randomUUID(),
          deviceId,
          timestamp: new Date().toISOString(),
          data: { temperature: 28.4, humidity: 67 },
        }),
      );
      expect(
        (
          await Promise.all([
            telemetry.ingest(topic, payload),
            telemetry.ingest(topic, payload),
          ])
        ).sort(),
      ).toEqual(['accepted', 'duplicate']);
      expect(await db.sensorReading.count({ where: { deviceId } })).toBe(2);
      await expect(
        telemetry.ingest(
          `home/${other.id}/device/${deviceId}/telemetry`,
          payload,
        ),
      ).rejects.toThrow('UNKNOWN_DEVICE');
      const devices = await request(server)
        .get(`/api/v1/households/${homeId}/devices?limit=1`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(200);
      expect(devices.body.items[0]).toMatchObject({
        id: deviceId,
        isOnline: true,
      });
      expect(devices.body.items[0].readings).toHaveLength(2);
      await db.device.update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date(0) },
      });
      const offline = await request(server)
        .get(`/api/v1/households/${homeId}/devices`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(200);
      expect(offline.body.items[0].isOnline).toBe(false);
      const deviceDetail = await request(server)
        .get(`/api/v1/households/${homeId}/devices/${deviceId}`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(200);
      expect(deviceDetail.body).toMatchObject({
        id: deviceId,
        name: 'Test Sensor',
        deviceType: 'dht_sensor',
        isOnline: false,
      });
      expect(deviceDetail.body.readings).toHaveLength(2);

      await request(server)
        .get(`/api/v1/households/${homeId}/devices/${randomUUID()}`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(404);

      await request(server)
        .get(`/api/v1/households/${other.id}/devices/${deviceId}`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .expect(403);

      // Sprint 2: Device control command tests
      // 1. Non-controllable device rejected with 400
      await request(server)
        .post(`/api/v1/households/${homeId}/devices/${deviceId}/commands`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .send({ action: 'turn_on' })
        .expect(400);

      // 2. Offline LIGHT device rejected with 409
      const offlineLightId = randomUUID();
      await db.device.create({
        data: {
          id: offlineLightId,
          householdId: homeId,
          name: 'Offline Light',
          deviceUid: offlineLightId,
          mqttTopic: `home/${homeId}/device/${offlineLightId}`,
          authTokenHash: 'local-test-unused',
          deviceType: 'LIGHT',
          isOnline: false,
          lastSeenAt: new Date(0),
        },
      });
      await request(server)
        .post(`/api/v1/households/${homeId}/devices/${offlineLightId}/commands`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .send({ action: 'turn_on' })
        .expect(409);

      // 2. Create online LIGHT device
      const lightId = randomUUID();
      await db.device.create({
        data: {
          id: lightId,
          householdId: homeId,
          name: 'Living Room Light',
          deviceUid: lightId,
          mqttTopic: `home/${homeId}/device/${lightId}`,
          authTokenHash: 'local-test-unused',
          deviceType: 'LIGHT',
          isOnline: true,
          lastSeenAt: new Date(),
        },
      });

      // 3. Listen on MQTT for command and reply with ACK
      const config = app.get(ConfigService);
      const brokerUrl = config.getOrThrow<string>('MQTT_URL');
      const testMqtt = await connectAsync(brokerUrl);
      const cmdTopic = `home/${homeId}/device/${lightId}/command`;
      const ackTopic = `home/${homeId}/device/${lightId}/state`;
      await testMqtt.subscribeAsync(cmdTopic);

      testMqtt.on('message', async (topic, msg) => {
        if (topic === cmdTopic) {
          const parsed = JSON.parse(msg.toString());
          await testMqtt.publishAsync(
            ackTopic,
            JSON.stringify({
              schemaVersion: 1,
              commandId: parsed.commandId,
              deviceId: lightId,
              status: 'success',
              state: { power: 'on' },
              timestamp: new Date().toISOString(),
            }),
            { qos: 1 },
          );
        }
      });

      // 4. Send command turn_on
      const cmdRes = await request(server)
        .post(`/api/v1/households/${homeId}/devices/${lightId}/commands`)
        .auth(auth.tokens.accessToken, { type: 'bearer' })
        .send({ action: 'turn_on' })
        .expect(201);

      expect(cmdRes.body).toMatchObject({
        status: 'ACKNOWLEDGED',
        state: { power: 'on' },
      });

      // 5. Verify ActionLog and DeviceCommand in DB
      const actionLog = await db.actionLog.findFirst({
        where: { deviceId: lightId },
      });
      expect(actionLog).not.toBeNull();
      expect(actionLog?.action).toBe('turn_on');

      const cmdInDb = await db.deviceCommand.findUnique({
        where: { id: cmdRes.body.commandId },
      });
      expect(cmdInDb?.status).toBe('ACKNOWLEDGED');

      await testMqtt.endAsync();
    }, 30000);
  },
);
