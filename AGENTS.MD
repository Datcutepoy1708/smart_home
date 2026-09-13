# AGENTS.MD — Smart Home IoT

## 1. Purpose

This file contains mandatory instructions for coding agents working in the Smart
Home IoT repository. Read it completely before analyzing the project, editing
code, creating migrations, or running commands. Prefer a secure, stable, and
maintainable demo over unnecessary complexity.

The current project documents are:

- `plan.MD`: product scope, sprint order, and implementation checklist.
- `db.md`: reference PostgreSQL schema and data-model decisions.
- `AGENTS.MD`: engineering rules and the required agent workflow.

If these documents conflict, do not silently make a scope-changing decision. If
the conflict is local and unambiguous, follow the locked stack in this file and
update the stale document. If it affects architecture or product behavior,
explain the conflict and ask the user before proceeding.

## 2. Product Scope

The active scope is the MVP defined in `plan.MD`:

- Email/password authentication and one owner household.
- A small device list with temperature/humidity telemetry.
- Manual light and fan on/off control.
- Online/offline and last-seen state.
- Fire/gas alerts delivered through FCM.
- Minimal alert and action history.

Household invitations, advanced RBAC UI, automated device provisioning,
per-device broker credential management, schedules, rules, scenes, analytics,
habit suggestions, chatbot integrations, and microservices are deferred.

Do not implement a deferred capability merely because its database model or
future-facing rule remains in this file. Preserve compatibility with those
future features, but optimize current work for the MVP exit conditions in
`plan.MD`.

## 3. Locked Technology Stack

- Mobile: React Native with TypeScript, built with Expo.
- Expo workflow: Expo development builds with `expo-dev-client`, EAS Build, and
  Expo Router. Do not rely on Expo Go for native integrations.
- Backend: Node.js, TypeScript, and NestJS.
- ORM: Prisma.
- Database: PostgreSQL 14+ without TimescaleDB or InfluxDB.
- IoT broker: Mosquitto.
- Backend MQTT client: MQTT.js.
- App real-time transport: WebSocket through a NestJS Gateway.
- Push notifications: Firebase Cloud Messaging.
- React Native FCM packages: `@react-native-firebase/app` and
  `@react-native-firebase/messaging`.
- Expo support packages: `expo-dev-client`, `expo-router`, and
  `expo-secure-store`. Configure native libraries through Expo config plugins.
- Backend FCM package: Firebase Admin SDK (`firebase-admin`).
- Authentication: short-lived JWT access tokens, rotating refresh tokens, and
  bcrypt password hashes.
- Mobile charts: `react-native-gifted-charts`.
- Scheduling: `@nestjs/schedule`. Add BullMQ only when a clear retry or queueing
  requirement exists and Redis has been approved.
- API validation: DTOs with `class-validator` and `class-transformer`.
- API documentation: NestJS OpenAPI/Swagger.

Do not replace the locked stack with Firebase Database, Firebase Auth, MySQL,
Supabase, or direct database access unless explicitly requested.

## 4. Architecture and Trust Boundaries

The primary data flow is:

```text
ESP32/device <-> MQTT/Mosquitto <-> NestJS <-> Prisma <-> PostgreSQL
                                      |
                              REST/WebSocket/FCM
                                      |
                               React Native
```

Mandatory rules:

1. React Native must never connect directly to PostgreSQL.
2. React Native must not connect directly to the MQTT broker. It sends commands
   through REST and receives live state through authenticated WebSockets.
3. Only the backend may write business data to PostgreSQL.
4. Every household-scoped API must authenticate the user and verify household
   membership and role.
5. Validate every MQTT message before storing it or broadcasting it.
6. Use FCM for push notifications, not continuous telemetry or live state.
7. Never trust client-supplied `householdId`, `userId`, or `deviceId` until
   the server has verified ownership and authorization.

## 5. Target Repository Structure

When scaffolding the project, prefer this modular monorepo layout:

```text
smart_home/
|-- apps/
|   |-- api/                 # NestJS backend
|   `-- mobile/              # Expo React Native application
|-- packages/
|   `-- contracts/           # Shared pure TypeScript types and constants
|-- infrastructure/
|   |-- docker/              # Local PostgreSQL and Mosquitto
|   `-- mqtt/                # Mosquitto configuration and ACL templates
|-- docs/                    # ADRs and detailed API/MQTT contracts
|-- db.md
|-- plan.MD
`-- AGENTS.MD
```

Do not create `packages/contracts` before at least two consumers need it. Keep
the backend as a modular NestJS monolith; do not split it into microservices for
the current scope.

Recommended backend modules for the active MVP:

```text
auth, users, households, devices, mqtt, telemetry, commands,
alerts, notifications, action-logs
```

Each module should separate controllers, services, DTOs, and tests. Centralize
Prisma access through `PrismaService`; do not instantiate `PrismaClient` inside
feature modules.

Recommended mobile feature folders for the active MVP:

```text
auth, home, devices, telemetry, alerts, settings
```

Place reusable UI under `shared/components`. Place networking, secure storage,
WebSocket, and notification navigation under `core` or `shared/services`. Keep
Expo app configuration in `app.config.ts` and build profiles in `eas.json`.

## 6. TypeScript and Code Standards

- Enable TypeScript `strict` mode.
- Avoid `any`. Use `unknown` at untrusted boundaries, then validate and narrow.
- Use English for identifiers, API fields, database names, and tests.
- Comments should explain intent, tradeoffs, or invariants—not restate code.
- Use `camelCase` for variables/functions, `PascalCase` for classes and types,
  `UPPER_SNAKE_CASE` for constants, and `kebab-case` for filenames following
  NestJS and React Native conventions.
- Keep functions focused. Do not put business logic in controllers, React
  components, or raw MQTT callbacks.
- Do not hard-code URLs, topic roots, timeouts, thresholds, or credentials. Use
  validated configuration.
- Return API errors consistently with `code`, `message`, optional safe
  `details`, and `requestId`.
- Exchange timestamps as ISO-8601 UTC. Convert to the household timezone only
  in presentation and scheduling logic.
- Keep sensor units explicit and consistent, such as `°C`, `%`, and `ppm`.
- Never log passwords, JWTs, refresh tokens, OTPs, full FCM tokens, MQTT
  credentials, or Firebase private keys.

## 7. PostgreSQL and Prisma

`db.md` is the reference business schema. After Prisma is introduced, every
database change must update all affected artifacts:

1. `schema.prisma`.
2. A clearly named migration.
3. `db.md` when relationships or business invariants change.
4. Relevant tests.

Rules:

- Use migrations. Do not use `db push` for production changes.
- Never rewrite or delete migrations already applied to a shared environment.
- Do not add cascading deletion to audit data without evaluating data loss.
- Scope every resource query directly by household or through its device
  relation.
- Verify that a `deviceId` belongs to the supplied household. Separate foreign
  keys do not enforce this cross-table invariant.
- Verify that `createdBy`, `requestedBy`, and `acknowledgedBy` are authorized
  household members unless the action is explicitly system-generated.
- Update `updatedAt` consistently through Prisma/backend behavior.
- Use transactions for multi-table operations that must be atomic.
- Add indexes based on actual query paths; avoid redundant indexes.
- Read telemetry by cursor and time range. Never return the full history.
- Every list endpoint must use pagination and enforce a maximum `limit`.
- Store only OTP hashes, with expiration, one-time use, and rate limits.
- Store refresh-token/session hashes so sessions can be revoked.

PostgreSQL alone is the default. Propose partitioning or TimescaleDB only when
measured volume or latency demonstrates that the current design is insufficient.

## 8. MQTT Contract

Standard topics:

```text
home/{householdId}/device/{deviceId}/telemetry
home/{householdId}/device/{deviceId}/command
home/{householdId}/device/{deviceId}/state
home/{householdId}/device/{deviceId}/availability
home/{householdId}/device/{deviceId}/ack
```

Common payload envelope:

```json
{
  "schemaVersion": 1,
  "messageId": "uuid",
  "deviceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "data": {}
}
```

Rules:

- Give every device unique credentials and ACL access only to its own topics.
- Require TLS in staging and production.
- Use retained messages and Last Will for `availability`; never retain commands.
- Use QoS 1 for important commands, acknowledgements, and alerts. Telemetry may
  use QoS 0 or 1 based on the acceptable data-loss policy.
- Use `messageId` and `commandId` for deduplication and correlation.
- Reject messages when the topic device and payload `deviceId` do not match.
- Enforce payload-size limits and validate `schemaVersion`.
- Device clocks may be wrong. Record server receive time and, when useful,
  device event time. Never use a device timestamp for authorization or expiry.
- Store readings in `sensor_readings`; do not copy every reading into
  `action_logs`.

Command lifecycle:

```text
pending -> sent -> acknowledged -> succeeded
                         |              |
                         `-> failed     `-> failed
pending/sent/acknowledged -> timeout
```

Create `device_commands` before publishing. Write `action_logs` for the final
business/audit result. Retries must be bounded and preserve the idempotency key;
never silently create duplicate physical operations.

## 9. Mobile Real-Time Behavior

- Use REST for initial loading, mutations, and recovery after reconnecting.
- Use WebSocket for device state, telemetry, and command status while active.
- Authenticate the socket. Join users only to household rooms they may access.
- Reconnect with exponential backoff and resynchronize state through REST.
- Do not show a device command as successful merely because REST returned
  `202 Accepted`. Show pending until an acknowledgement/state update or timeout.
- Throttle or sample telemetry before chart rendering to prevent excessive UI
  updates.

## 10. FCM Push Notifications

Standard flow:

```text
MQTT event -> NestJS alert service -> alerts/notifications in PostgreSQL
           -> Firebase Admin SDK -> FCM -> React Native
```

Rules:

- Remote push notifications and React Native Firebase native modules require an
  Expo development build or release build; they do not work in Expo Go. Use
  `expo-dev-client`, `npx expo prebuild` when required, and EAS Build profiles.
- Configure `@react-native-firebase/app` and messaging through supported Expo
  config plugins. Do not manually edit generated native files when the same
  configuration belongs in `app.config.ts`.
- React Native uses `@react-native-firebase/messaging` to request permission,
  obtain a token, and listen for token refresh events.
- Send the token to the backend after login and whenever it changes. Associate
  it with the current user and platform.
- On logout, deactivate the appropriate user/device token association.
- The backend uses `firebase-admin`. Load credentials only from secrets or
  environment variables; never commit a service-account private-key file.
- Store delivery attempts in `notifications`. Mark tokens inactive when FCM
  reports them as invalid or unregistered.
- Include safe routing data such as `alertId`, `type`, and `severity` so the app
  can deep-link to the alert detail screen.
- Do not expose sensitive information in notification title/body because it may
  appear on the lock screen.
- Handle and test foreground, background, and terminated app states on physical
  devices.
- Configure meaningful Android notification channels. Critical priority or
  sound must be intentional and rate-limited.
- FCM does not replace WebSocket and does not guarantee real-time delivery.
- Deduplicate repeated alerts and apply cooldown/rate limits.

## 11. Authentication and Authorization

- Hash passwords with bcrypt using an appropriate cost. Never encrypt passwords
  reversibly.
- Keep access tokens short-lived. Rotate and revoke refresh tokens.
- Store refresh tokens with `expo-secure-store` (backed by iOS Keychain and
  Android Keystore), never AsyncStorage.
- Apply OTP expiration and send/verify rate limits. Do not reveal whether an
  account exists.
- Every household endpoint requires a membership guard. Sensitive endpoints
  also require a role guard.
- Use this default permission matrix:

| Action | Owner | Member | Guest |
|---|---:|---:|---:|
| View devices, state, and alerts | Yes | Yes | Yes, until expiration |
| Control devices | Yes | Yes | No |
| Create/edit schedules, rules, scenes | Yes | Yes | No |
| Add or remove devices | Yes | No | No |
| Invite/remove members or change roles | Yes | No | No |
| Delete household | Yes | No | No |

- The last Owner cannot leave or lose ownership until ownership is transferred.
- Reject expired Guests even when their JWT has not expired.

If product requirements change this matrix, update implementation, tests, and
documentation together.

## 12. Schedules, Rules, and Scenes

### Schedules

- Store an IANA timezone, defaulting to `Asia/Ho_Chi_Minh`, and store
  `nextRunAt` as `TIMESTAMPTZ`.
- Claim jobs in a way that prevents multiple backend instances running the same
  occurrence.
- Every occurrence creates a `device_commands` record; never publish around the
  command service.
- Recalculate `nextRunAt` after timezone or repeat-day changes.

### Rules

- Evaluate rules from MQTT telemetry/events, not by continuously polling the DB.
- Validate condition/action schemas and use an operator allowlist.
- Apply cooldown, priority, idempotency, and activation limits.
- Prevent self-triggering loops and record which rule created each command.

### Scenes

- A scene contains deterministically ordered actions.
- Define sequential versus parallel behavior; default to `orderIndex` order.
- Return the result of each action and represent partial failure honestly.

## 13. API Conventions

- Use the `/api/v1` prefix.
- Use meaningful status codes: `201` for creation, `202` for accepted but
  unfinished commands, `204` for deletion, and appropriate `400`, `401`, `403`,
  `404`, and `409` responses.
- Configure validation with `whitelist`, `forbidNonWhitelisted`, and controlled
  transformation.
- Parse and validate every client-supplied UUID.
- Prefer cursor pagination for large telemetry/log collections. Return `items`
  and `nextCursor`.
- Support idempotency keys for mutations that clients may retry.
- Keep Swagger synchronized with controllers and DTOs.
- Never return stack traces, raw Prisma errors, or secrets to clients.

## 14. React Native Conventions

- Screen components must not directly implement HTTP, socket, or FCM clients.
  Put integrations in testable services and hooks.
- Use Expo Router for file-based navigation and typed route parameters.
- Prefer Expo SDK modules when they satisfy the requirement. Adding another
  native module requires checking Expo compatibility and rebuilding the
  development client.
- Keep `app.config.ts`, `eas.json`, Android package name, iOS bundle identifier,
  and Firebase app registrations synchronized.
- Every screen must handle loading, empty, error, and offline states.
- Use `expo-secure-store` for authentication tokens and never log sensitive
  state.
- Explain notification permission requests and handle denial gracefully.
- Validate notification payloads and current membership before navigating.
- Remove subscriptions and listeners on unmount or logout.
- Do not register duplicate timers, WebSocket listeners, or FCM listeners.
- Use optimistic UI only with a clear rollback. Device commands remain pending
  until an acknowledgement/state update arrives.

## 15. Configuration and Secrets

- Provide `.env.example` with variable names and safe placeholder values only.
- Never commit `.env`, database passwords, MQTT credentials, JWT secrets,
  Firebase service-account JSON, signing keys, or private production URLs.
- Validate environment variables on backend startup. Fail fast with the missing
  variable name, but never print secret values.
- Separate development, test, and production configuration.
- Configure CORS, Swagger exposure, and debug logging per environment.
- If a secret is discovered in the repository, stop and inform the user. Do not
  repeat the secret in output or new commits.

Expected environment variables include:

```text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
MQTT_URL
MQTT_USERNAME
MQTT_PASSWORD
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_WS_URL
```

Only variables prefixed with `EXPO_PUBLIC_` may be embedded in the mobile bundle,
and they must never contain secrets.

## 16. Logging, Monitoring, and Error Handling

- Use structured JSON backend logs with safe context such as `requestId`,
  `userId`, `householdId`, `deviceId`, `commandId`, and error code.
- Mask tokens, credentials, secrets, and personal information.
- Distinguish user errors, dependency failures, and programming defects.
- MQTT, FCM, and database calls need explicit timeout/error handling. Never
  swallow exceptions silently.
- Provide health checks for at least the API, database, and MQTT connection.
- Useful metrics include MQTT reconnects, accepted/rejected telemetry, command
  latency/timeouts, FCM success/failure, and active WebSocket connections.

## 17. Testing Requirements

Every change requires testing proportional to its risk.

### Backend

- Unit-test services, guards, validators, rule evaluation, and next-run logic.
- Use a separate PostgreSQL test database for important Prisma queries and
  transactions.
- E2E-test authentication, household isolation, the role matrix, and command
  lifecycle.
- Contract-test valid/invalid MQTT payloads, topic mismatch, duplicate messages,
  and acknowledgement timeout.
- Mock Firebase Admin in unit tests. CI must not send real FCM notifications.

### Mobile

- Unit-test parsers, state hooks, and notification routing.
- Component-test loading, error, pending, and offline states.
- Add E2E smoke tests for login, device viewing, command sending, and alert
  navigation when infrastructure permits.
- Maintain a physical-device checklist for FCM foreground, background, and
  terminated states.
- Verify Expo development and release builds when adding or changing native
  modules; Expo Go is not sufficient verification.

### Mandatory Cases

- A user in household A cannot view or control a device in household B.
- An expired Guest is denied.
- A duplicated command does not perform the physical operation twice.
- A device that does not acknowledge a command reaches `timeout`.
- A rule cannot trigger itself indefinitely.
- An invalid FCM token is marked inactive.
- Invalid telemetry schema or units are rejected with safe logging.

## 18. Agent Commands and Workflow

The repository may not yet be scaffolded. Inspect the actual files, package
manager, lockfile, and scripts before running a command. Once scaffolded, prefer
root `package.json` scripts such as:

```text
install
lint
typecheck
test
test:e2e
build
format:check
```

Do not assume a command exists. Never run migrations against a non-local/non-test
database without explicit authorization. Never seed, truncate, or delete shared
data without an explicit request.

Required workflow:

1. Read `AGENTS.MD`, `plan.MD`, `db.md`, and files near the requested change.
2. Inspect the working tree and preserve unrelated user changes.
3. Identify affected invariants, contracts, migrations, and tests.
4. Make the smallest coherent change that satisfies the request.
5. Run relevant formatting, linting, type checking, and tests.
6. If verification cannot run, state why; never claim it passed.
7. Update documentation when API, MQTT, schema, or operations change.
8. Report changed files, verification performed, and remaining risks.

## 19. Prohibited Agent Actions

- Do not commit, push, deploy, or send real notifications unless requested.
- Do not silently replace the framework, ORM, database, or broker.
- Do not let the mobile application access PostgreSQL or MQTT directly.
- Do not bypass authorization because an endpoint is “only for a demo.”
- Do not hard-code secrets or use production credentials in tests.
- Do not alter production data or migrations.
- Do not delete tests to make the pipeline pass.
- Do not add dependencies when existing dependencies or the standard library
  already solve the problem cleanly.
- Do not create a generic abstraction used only once unless it materially
  improves clarity or safety.
- Do not mark `plan.MD` tasks complete without corresponding implementation and
  verification.

## 20. Definition of Done

A task is complete only when:

- Behavior matches the requirement and architectural boundaries.
- Validation, authentication, and household authorization are complete.
- Relevant error, loading, offline, retry, and timeout states are handled.
- Schema, migration, API, and MQTT contracts agree.
- Relevant tests were added and pass.
- Relevant lint, type-check, and build commands pass.
- No secrets, sensitive logs, or unrelated changes were introduced.
- `plan.MD`, `db.md`, Swagger, and other documentation are updated when a
  contract changes.
- The final report distinguishes completed work from unverified work.

## 21. Decision Priorities

When multiple approaches are valid, prefer them in this order:

1. Security and household data isolation.
2. Command and alert correctness/idempotency.
3. Observability and safe network-failure behavior.
4. Simplicity for demonstration and solo maintenance.
5. Performance supported by real query patterns and measurements.
6. Future extensibility.

Never sacrifice the first three priorities to optimize the later ones early.
## 22. No icon
- **No decorative icon/emoji badges or trust badges.** Do not add small colorful icon+text chip elements like "🚀 50K+ Products" or "🚚 Free Shipping" — these decorative trust-badge patterns (common in AI-generated hero sections) are visual clutter and must be removed or replaced with plain text if the content is worth keeping (e.g. plain text "50,000+ products in stock" with no icon/emoji in front of it).
  - If a Stitch mockup includes these badges, treat it as reference for layout only — strip the icon/emoji and either drop the badge entirely or keep it as plain text, when implementing the real Angular component.
  - This also applies to commit messages, PR descriptions, code comments, and log messages — no decorative emoji there either (e.g. `feat(product): ✨ add search 🔍` → `feat(product): add search`).
  - **Functional UI icons are still allowed where they materially aid usability** — e.g. a cart icon with item-count badge in the header (no room for text label there), a password show/hide toggle icon, a search magnifying-glass inside a search input, a notification bell in the admin topbar, a dark-mode toggle, an "opens in new tab" external-link glyph. Keep these minimal, single-color/monochrome (matching `--on-surface-variant` from the design tokens), and consistent with the design system — not colorful, not multi-color, not emoji-style. If in doubt whether an icon is "functional" or "decorative," ask before adding it.
