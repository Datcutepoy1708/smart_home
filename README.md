# Smart Home IoT

Monorepo for an Expo/React Native mobile app and a NestJS backend using
PostgreSQL, Prisma, Mosquitto, WebSocket, and Firebase Cloud Messaging.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop
- Android Studio or Xcode for native mobile builds

## Local setup

1. Run `npm run setup:local` to create `.env` with random local database and JWT
   secrets. An existing `.env` is preserved. Keep this file private.
2. Run `npm ci` using the committed lockfile.
3. Start PostgreSQL and Mosquitto with `npm run infra:up`.
4. Generate Prisma Client with `npm run db:generate`.
5. Start the API with `npm run dev:api`.
6. Start Expo with `npm run dev:mobile`.

The API uses `http://localhost:3000/api/v1`; development Swagger uses
`http://localhost:3000/docs`.

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution policy
blocks `npm.ps1`. Docker Desktop must be running Linux containers. Verify it with
`docker version` (both Client and Server should appear).

PostgreSQL is available at `localhost:5433`; Mosquitto uses `localhost:1883`
and WebSocket port `9001`. All three ports are bound to loopback only. Anonymous
MQTT is for local development only. To change the database port, update both
`POSTGRES_PORT` and `DATABASE_URL` in `.env`. Existing database volumes retain
their original credentials when `.env` changes.

Phase 0 checks: `docker compose config --quiet`, `docker compose ps`,
`npm run db:generate`, `npm run build`, `npm run lint`, `npm run typecheck`,
`npm run test`, and `npm run test:e2e`. With the API running,
`http://localhost:3000/api/v1/health` should return HTTP 200. This endpoint checks
API liveness only; it does not currently check database or MQTT health.

Expo startup runs Metro at `http://localhost:8081` in development-build mode.
Native app verification requires an installed development build and an emulator
or physical device. For a physical device, configure the public API URL with the
computer's reachable LAN address; phone localhost refers to the phone itself.
Expo environment files belong in `apps/mobile/.env` and must contain only the
required `EXPO_PUBLIC_*` values, never backend secrets.

## Sprint 1 demo

1. Start infrastructure with `npm run infra:up`.
2. Run `npm run db:generate`, `npm run db:deploy:local`, and `npm run build`.
3. Start the backend with `npm run dev:api`.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set the public API
   address (use `http://10.0.2.2:3000/api/v1` on the Android emulator, or the
   computer's LAN address on a phone).
5. Start `npm run dev:mobile` and open your Expo development build. Register an
   account with a home name. A web preview is available at the Metro URL, but
   web sessions are memory-only and do not verify native Secure Store behavior.
6. Run `npm run device:setup -- your-registered-email@example.com`. This local
   backend command creates one DHT sensor for the Owner and prints its IDs.
   Running it again preserves the device. It does not create broker credentials.
7. Run `npm run device:simulate -- HOUSEHOLD_UUID DEVICE_UUID 28.4 67` with the
   printed UUIDs. Pull to refresh Home to see the readings.
8. After 60 seconds without a new reading, refresh to see Offline. Publish again
   to see Online. Restart Mosquitto with `docker compose restart mosquitto` and
   verify `http://localhost:3000/api/v1/health/ready` recovers.
9. Sign out from Account. On a native development build, also close/reopen the
   app before logout to verify session restoration.

Create the separate integration database once with
`docker compose exec -T postgres createdb -U smart_home smart_home_test`, then run
`npm run test:integration`. This runner refuses non-local database hosts, applies
migrations to `smart_home_test`, and tests authentication, household isolation,
duplicate telemetry, and real local MQTT delivery. Test fixtures use unique IDs
and remain in the dedicated test database. It never sends FCM notifications.

API and MQTT details: [Sprint 1 contracts](docs/sprint-1-api-mqtt.md).
Generating Prisma Client does not apply migrations. The local migration command
applies existing migrations without resetting or seeding a database.

Remote FCM requires Firebase platform credentials and an Expo development or
release build. Never commit those credentials. Expo Go cannot verify native FCM.

Read `AGENTS.MD`, `plan.MD`, and `db.md` before changing scope or architecture.

Active reduced scope: `plan.MD`.

Detailed Sprint 1 execution plan: `docs/sprint-1-implementation-plan.md`.

Google Stitch MVP UI prompt: `docs/stitch-mvp-ui-prompt.md`.

The previous full-app prompt remains at
`docs/stitch-full-app-ui-prompt.md` as a future reference only.
