/**
 * prisma/seed.ts — Seed 1 user, 1 household, 3 devices cho setup thật.
 *
 * Run:  npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

async function main() {
  console.log('🌱  Seeding database...\n');

  // ── 1. User ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123456', 12);
  const userId = randomUUID();
  const user = await prisma.user.upsert({
    where: { email: 'admin@home.local' },
    update: {},
    create: {
      id: userId,
      email: 'admin@home.local',
      name: 'Admin',
      passwordHash,
      isActive: true,
    },
  });
  console.log(`✅  User: ${user.email}  (id: ${user.id})`);

  // ── 2. Household ─────────────────────────────────────────────────────────────
  const householdId = randomUUID();
  const household = await prisma.household.create({
    data: {
      id: householdId,
      name: 'Nhà của tôi',
      createdBy: user.id,
      members: {
        create: {
          id: randomUUID(),
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  });
  console.log(`✅  Household: "${household.name}"  (id: ${household.id})`);

  // ── 3. Devices ───────────────────────────────────────────────────────────────
  // Each device gets a random auth token — the firmware doesn't use it yet,
  // but the DB requires it (NOT NULL). Store only the hash.
  const sensorId = randomUUID();
  const lightId  = randomUUID();
  const fanId    = randomUUID();
  const root     = 'home';

  const devices = [
    {
      id:            sensorId,
      householdId:   householdId,
      deviceUid:     `esp32-sensor-${sensorId.slice(0, 8)}`,
      name:          'Cảm biến phòng khách',
      deviceType:    'DHT_SENSOR' as const,
      room:          'Phòng khách',
      mqttTopic:     `${root}/${householdId}/device/${sensorId}`,
      authTokenHash: sha256(randomUUID()),
    },
    {
      id:            lightId,
      householdId:   householdId,
      deviceUid:     `esp32-light-${lightId.slice(0, 8)}`,
      name:          'Đèn phòng khách',
      deviceType:    'LIGHT' as const,
      room:          'Phòng khách',
      mqttTopic:     `${root}/${householdId}/device/${lightId}`,
      authTokenHash: sha256(randomUUID()),
    },
    {
      id:            fanId,
      householdId:   householdId,
      deviceUid:     `esp32-fan-${fanId.slice(0, 8)}`,
      name:          'Quạt phòng khách',
      deviceType:    'FAN' as const,
      room:          'Phòng khách',
      mqttTopic:     `${root}/${householdId}/device/${fanId}`,
      authTokenHash: sha256(randomUUID()),
    },
  ];

  await prisma.device.createMany({ data: devices });

  console.log(`✅  Devices:`);
  console.log(`    SENSOR  "${devices[0].name}"  id: ${sensorId}`);
  console.log(`    LIGHT   "${devices[1].name}"  id: ${lightId}`);
  console.log(`    FAN     "${devices[2].name}"  id: ${fanId}`);

  // ── 4. Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('📋  Paste vào firmware/esp32-smart-home/config.h:\n');
  console.log(`#define HOUSEHOLD_ID "${householdId}"`);
  console.log(`#define SENSOR_ID    "${sensorId}"`);
  console.log(`#define LIGHT_ID     "${lightId}"`);
  console.log(`#define FAN_ID       "${fanId}"`);
  console.log('\n🔑  Đăng nhập app:');
  console.log('    Email:    admin@home.local');
  console.log('    Mật khẩu: Admin@123456');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
