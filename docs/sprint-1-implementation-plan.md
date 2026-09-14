# Sprint 1 Implementation Plan — Working Foundation

## 1. Objective

Deliver the smallest complete data flow:

    User registers or signs in with Expo
      -> one test device publishes temperature and humidity to Mosquitto
      -> NestJS validates and stores the message in PostgreSQL
      -> Expo displays the latest reading and connection state

Sprint 1 should prove that the chosen stack works together. It is not a
production IoT security sprint.

## 2. Included

- Local PostgreSQL and Mosquitto.
- Prisma migration.
- Email/password authentication with JWT access and refresh sessions.
- Automatic creation of one household and Owner membership at registration.
- Expo authentication and secure session restoration.
- One preconfigured development device.
- MQTT temperature/humidity ingestion.
- Latest telemetry, online/offline state, and last-seen display.
- Essential validation, Swagger, logging, and tests.

## 3. Excluded

- Automated device provisioning and Mosquitto Dynamic Security.
- Per-device credential rotation and revocation.
- Device control and command acknowledgement.
- FCM notification delivery.
- Invitations and advanced role-management UI.
- Schedules, rules, scenes, charts, habits, and chatbot.
- Microservices and production deployment.

## 4. Implementation order

### Phase 0 — Local baseline

Estimated effort: 0.5–1 day.

Tasks:

- Install workspace dependencies.
- Update WSL before using Docker Desktop.
- Start PostgreSQL and Mosquitto with Docker Compose.
- Verify environment examples contain no real credentials.
- Verify API health, Prisma generation, Expo startup, lint, and typecheck.
- Keep anonymous MQTT access limited to local development, or use one simple
  non-anonymous development account if already configured.

Acceptance:

- A new developer can follow README instructions.
- GET /api/v1/health returns HTTP 200.
- PostgreSQL and Mosquitto are reachable locally.

### Phase 1 — Database and backend authentication

Estimated effort: 1–2 days.

Endpoints:

| Method | Endpoint              | Purpose                                      |
| ------ | --------------------- | -------------------------------------------- |
| POST   | /api/v1/auth/register | Create user, household, and Owner membership |
| POST   | /api/v1/auth/login    | Issue access and refresh tokens              |
| POST   | /api/v1/auth/refresh  | Rotate the refresh session                   |
| POST   | /api/v1/auth/logout   | Revoke the current refresh session           |
| GET    | /api/v1/auth/me       | Return current user and household            |

Requirements:

- Registration uses one database transaction.
- Normalize email and hash passwords with bcrypt.
- Store only a hash of each refresh token.
- Use generic invalid-login responses.
- Never expose passwordHash or tokenHash.
- Test registration, login, refresh replay, logout, and current user.

Acceptance:

- All five endpoints work end to end.
- Refresh-token reuse after rotation or logout fails.
- Initial migration applies to an empty local database.

### Phase 2 — Expo authentication

Estimated effort: 1–1.5 days.

Tasks:

- Create login and registration screens.
- Store the refresh token with Expo Secure Store.
- Keep the access token in memory.
- Restore the session through the refresh endpoint at startup.
- Attach the access token and retry once after an authorized refresh.
- Add logout, loading, validation, offline, and server-error states.

Acceptance:

- A new user enters the authenticated app.
- Closing and reopening the app restores a valid session.
- Logout prevents restoration with the old refresh token.

### Phase 3 — Minimal MQTT ingestion

Estimated effort: 1–2 days.

Use one known test device in Sprint 1. Device provisioning is deferred.

Topic:

    home/{householdId}/device/{deviceId}/telemetry

Payload:

    {
      "schemaVersion": 1,
      "messageId": "uuid",
      "deviceId": "uuid",
      "timestamp": "2026-09-05T00:00:00.000Z",
      "data": {
        "temperature": 28.4,
        "humidity": 67
      }
    }

Tasks:

- Connect NestJS to Mosquitto with reconnect/backoff.
- Subscribe after connection succeeds.
- Parse and validate the topic and JSON payload.
- Enforce a 16 KB payload limit, UUIDs, schema version, and sensible numeric
  ranges.
- Reject a topic/payload device mismatch.
- Store temperature and humidity readings.
- Update lastSeenAt and current online state.
- Ignore a repeated messageId.
- Provide a small simulator command or documented MQTT publish example.

Acceptance:

- Valid telemetry is stored.
- Malformed, oversized, duplicated, and mismatched messages are rejected safely.
- NestJS reconnects after a local broker restart.

### Phase 4 — Minimal mobile dashboard

Estimated effort: 1 day.

Tasks:

- Add an authenticated home/device screen.
- Fetch the household device list and latest telemetry through REST.
- Show device name, temperature, humidity, online/offline, and last-seen time.
- Add loading, empty, offline, and retry states.
- Refresh on screen focus and with pull-to-refresh. Realtime UI transport can be
  added after the basic REST flow is reliable.

Acceptance:

- A signed-in user can see the latest test-device reading.
- A missing or offline device is represented clearly.
- The screen does not crash when the API or broker is unavailable.

## 5. Verification

Run:

    npm run build
    npm run lint
    npm run typecheck
    npm run test
    npm run test:e2e
    npm run db:generate
    docker compose config --quiet

Manual check:

1. Register a new user.
2. Close and reopen Expo and confirm session restoration.
3. Publish one valid telemetry message.
4. Confirm the database contains the reading.
5. Confirm Expo displays temperature and humidity.
6. Publish an invalid message and confirm safe rejection.
7. Stop and restart Mosquitto and confirm backend reconnection.
8. Logout and confirm the old refresh token is unusable.

## 6. Sprint 1 Definition of Done

- Authentication and session restoration work.
- The initial database migration works on a clean local database.
- A real or simulated device can publish one valid telemetry payload.
- NestJS validates and stores that payload.
- Expo displays the latest reading and device status.
- Invalid input does not crash the backend.
- No secret is committed or logged.
- Relevant automated checks pass.

Only after these conditions pass should Sprint 2 device control begin.

## 7. Current starting point

### Implementation update (2026-09-14)

- Phase 1: local and dedicated test database migrations applied; registration,
  login, me, concurrent refresh rotation, replay rejection and logout verified.
- Phase 2: Expo login/registration/account screens, secure native refresh-token
  storage, memory-only access token, session restoration, single-flight refresh
  and retry/error states implemented. Automated session tests pass. Physical
  device session restoration is still unverified.
- Phase 3: validated MQTT ingestion, durable per-device message deduplication,
  paired readings, last-seen/online expiry, bounded ingestion concurrency,
  reconnect backoff, local device setup command and simulator implemented.
  Real broker delivery and broker restart/reconnection were verified.
- Phase 4: authenticated household device list, latest readings, focus/pull
  refresh, cursor load-more and loading/empty/error/offline UI implemented.
  Component state tests pass.
- Acceptance Verification (Completed 2026-09-14 on Android Pixel 9 / API 35):
  Native debug build compiled via Gradle (`./gradlew.bat assembleDebug`) and installed
  on Android emulator (`emulator-5554`). All 6 points of the device acceptance checklist
  passed:
  1. Built and installed `app-debug.apk` onto emulator (`com.smarthome.mobile`).
  2. Registered user `native-tester@smarthome.io` (household "Native Home") via native UI (HTTP 201).
  3. Force-stopped app (`adb shell am force-stop`) and relaunched; session was restored seamlessly
     via `expo-secure-store` refresh token calling `/auth/refresh` (HTTP 200).
  4. Ran device provisioner (`npm run device:setup`) and telemetry simulator (`scripts/simulate-telemetry.mjs`).
  5. Confirmed live temperature (26.5 °C) and humidity (62 %) rendered correctly on device card in native UI.
  6. Signed out from Account tab: backend processed `/auth/logout` (HTTP 204), session revoked from DB,
     SecureStore cleared, and app returned to Sign In screen upon relaunch.
- Verification: build, lint, typecheck, 17 backend unit/contract tests, 9 mobile
  session/component tests, and 3 E2E/integration tests passed 100%. Device setup CLI
  creation and repeat checked against dedicated test database.
- Sprint 1 is officially accepted and complete. Ready for Sprint 2 (Device Control).

### Known issues fixed (2026-09-14)

- [FIXED] app.config.ts previously listed @react-native-firebase/app and
  @react-native-firebase/messaging as Expo config plugins. These plugins require
  google-services.json (Android) and GoogleService-Info.plist (iOS) which are
  not committed. Running `npx expo prebuild` would have failed. Both plugins
  were removed from the plugins array; the npm packages remain as dependencies
  so imports continue to compile. They will be re-added in Sprint 3 once
  Firebase platform credentials are available.
- [FIXED] Added `android:usesCleartextTraffic="true"` in AndroidManifest.xml and
  mapped `localhost` to `10.0.2.2` in mobile `api-client.ts` to allow HTTP calls to local dev API.
- [FIXED] Added explicit navigation routing in `auth-screen.tsx`, `settings-screen.tsx`, and
  `_layout.tsx` to handle authentication state transitions cleanly on native devices.

### Status before Sprint 2

- All Sprint 1 acceptance criteria met and verified on native Android build.
- Ready to proceed to Sprint 2: Device Control & Command Ack.

Already scaffolded:

- npm monorepo with NestJS API and Expo mobile app.
- PostgreSQL and Mosquitto Docker Compose definitions.
- Prisma schema and initial migration.
- API health and Swagger foundation.
- Expo Router, Expo Secure Store, EAS, and FCM dependencies.
- Initial authentication backend code and refresh-session model.

Phase 0 verification (2026-09-13):

- Completed: dependency installation with `npm ci`, Prisma Client generation,
  build, lint, typecheck, five unit tests, and one API health E2E test.
- Docker Desktop Linux engine is reachable. PostgreSQL is healthy on local port
  5433 (5432 was unavailable); a Prisma `SELECT 1` succeeded.
- Mosquitto is reachable on local port 1883; a non-retained QoS 1
  publish/subscribe round trip succeeded.
- Compose configuration validation passed. Database and broker ports are bound
  to 127.0.0.1 for local-only access.
- API startup succeeded and GET /api/v1/health returned HTTP 200.
- Expo Metro started in development-build mode; its status endpoint reported
  `packager-status:running`.
- `.env.example` contains placeholders only. `npm run setup:local` creates a
  private local `.env` with random database/JWT secrets without overwriting it.
- Native app launch on an emulator/physical device remains unverified. Metro
  startup does not verify native Firebase integration.
- Initial migration application and database authentication flows remain Phase 1
  work. The existing E2E test covers API health only.
- No Git metadata was available in this workspace, so Git diff/status could not
  be used to verify changes.
