import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const config = app.get(ConfigService);
  const url = new URL(config.getOrThrow<string>('DATABASE_URL'));
  if (
    config.get('NODE_ENV') !== 'development' ||
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error('Local development only');
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Supply the registered owner email');
  const db = app.get(PrismaService);
  const membership = await db.householdMember.findFirst({
    where: {
      user: { email, isActive: true },
      role: 'OWNER',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { joinedAt: 'asc' },
  });
  if (!membership) throw new Error('Registered owner required');
  const deviceUid = `local-dht-${membership.householdId}`;
  const id = randomUUID();
  const device = await db.device.upsert({
    where: { deviceUid },
    update: {},
    create: {
      id,
      householdId: membership.householdId,
      deviceUid,
      name: 'Living room sensor',
      room: 'Living room',
      deviceType: 'DHT_SENSOR',
      mqttTopic: `${config.getOrThrow<string>('MQTT_TOPIC_ROOT')}/${membership.householdId}/device/${id}`,
      authTokenHash: 'unused-local-anonymous-broker',
    },
  });
  console.log(
    JSON.stringify({
      deviceId: device.id,
      householdId: device.householdId,
      topic: `${device.mqttTopic}/telemetry`,
    }),
  );
} catch (error: unknown) {
  console.error(
    error instanceof Error && !('code' in error)
      ? error.message
      : 'Device setup failed',
  );
  process.exitCode = 1;
} finally {
  await app.close();
}
