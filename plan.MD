# SMART HOME IOT — MVP DEVELOPMENT PLAN

## 1. Current direction

The project is temporarily reduced to a small, demonstrable MVP. The goal is
to complete one reliable end-to-end smart-home flow before adding advanced
features.

Core flow:

    User signs in to the Expo app
      -> ESP32 publishes temperature and humidity through MQTT
      -> NestJS validates and stores the data in PostgreSQL
      -> Expo displays the latest readings and device status
      -> User can turn a light or fan on/off
      -> Critical fire or gas events trigger an FCM push notification

## 2. Locked technology stack

- Mobile: React Native, Expo, Expo Router, TypeScript.
- Backend: NestJS, TypeScript, Prisma.
- Database: PostgreSQL.
- IoT transport: Mosquitto MQTT.
- Push notifications: Firebase Cloud Messaging through Expo-compatible native
  configuration.
- Architecture: modular monolith. Do not introduce microservices during MVP.

## 3. MVP scope

The MVP contains only:

1. Email/password registration and login.
2. One household owned by the registered user.
3. A simple device list and device details.
4. Temperature and humidity telemetry through MQTT.
5. Manual light and fan on/off control.
6. Device online/offline and last-seen state.
7. FCM push notifications for fire and gas alerts.
8. A minimal alert and action history.

## 4. Deferred backlog

Do not implement these features until the MVP Definition of Done is met:

- Household invitations, multiple members, and advanced RBAC screens.
- Google login, OTP login, password recovery, and account linking.
- Mosquitto Dynamic Security and automated per-device credential management.
- Schedules, automation rules, scenes, and rule builders.
- Advanced charts, reports, energy analytics, and statistics.
- Habit suggestions and machine-learning features.
- Chatbot, Telegram, Zalo, and voice assistants.
- Microservices, Kubernetes, and production-scale infrastructure.

The database may retain models for deferred features. Their presence does not
make them part of the active implementation scope.

## 5. Delivery plan

### Sprint 1 — Working foundation

Implementation status (2026-09-14): backend authentication, Expo session flow,
local device setup, MQTT ingestion and REST device dashboard are implemented.
Automated verification passes. Native development-build acceptance is pending;
see `docs/sprint-1-implementation-plan.md` before starting Sprint 2.

Estimated effort: 5–7 days.

- Start PostgreSQL, Mosquitto, NestJS, and Expo locally.
- Apply the initial Prisma migration.
- Complete registration, login, refresh, logout, and current-user APIs.
- Build Expo login, registration, logout, and session restoration.
- Configure one development MQTT account and one preconfigured test device.
- Receive, validate, and store temperature/humidity telemetry.
- Display the latest reading and online/offline state in Expo.

Exit condition: a user can sign in and see a real or simulated device reading
in the mobile app.

### Sprint 2 — Device control

Estimated effort: 4–6 days.

- Add light and fan device types.
- Add on/off controls in Expo.
- Publish MQTT commands from NestJS.
- Process device acknowledgement and current state.
- Add command timeout/error handling.
- Store a minimal action log.

Exit condition: a signed-in user can control a light or fan and see the
confirmed state.

### Sprint 3 — Critical alerts and FCM

Estimated effort: 3–5 days.

- Register and revoke mobile FCM tokens.
- Detect fire and gas alert messages from MQTT.
- Store alerts and notification delivery records.
- Send high-priority push notifications.
- Open the relevant alert screen when a notification is tapped.
- Add foreground, background, denied-permission, and retry handling.

Exit condition: a simulated fire or gas event creates an alert and delivers a
push notification to a physical test device.

### Sprint 4 — Demo hardening

Estimated effort: 3–4 days.

- Improve loading, empty, offline, validation, and error states.
- Add safe logging, request IDs, rate limits, and input limits.
- Verify MQTT reconnect and retained device state.
- Run build, lint, typecheck, unit, integration, and E2E tests.
- Document setup and the final demo script.

Exit condition: the complete MVP demo can be repeated from a clean local setup.

## 6. MVP Definition of Done

The MVP is complete only when:

- Registration, login, refresh, logout, and session restoration work.
- A device publishes valid telemetry through MQTT.
- NestJS validates and stores the telemetry in PostgreSQL.
- Expo shows the latest temperature, humidity, online state, and last-seen time.
- Light or fan commands receive a success, failure, or timeout result.
- Fire and gas events create records and deliver FCM notifications.
- The app handles offline and server-error states without crashing.
- No password, JWT secret, MQTT password, or Firebase service credential is
  committed or logged.
- README setup and demo instructions are reproducible.
- Build, lint, typecheck, and required tests pass.

## 7. Scope-change rule

New ideas go into the deferred backlog. Promote a feature into the active plan
only after the current sprint exit condition passes. This rule keeps the
project small enough to finish while preserving the larger product direction.
