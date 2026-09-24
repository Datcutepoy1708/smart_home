# Sprint 1 API and MQTT

## Authentication

All paths are prefixed with `/api/v1`.

| Method | Path           | Request                              | Result                           |
| ------ | -------------- | ------------------------------------ | -------------------------------- |
| POST   | /auth/register | name, email, password, householdName | 201, identity and tokens         |
| POST   | /auth/login    | email, password                      | 200, identity and tokens         |
| POST   | /auth/refresh  | refreshToken                         | 200, identity and rotated tokens |
| POST   | /auth/logout   | refreshToken                         | 204, session revoked             |
| GET    | /auth/me       | Bearer access token                  | 200, identity                    |

Identity contains `user: { id, name, email }` and
`households: [{ id, name, role }]`. Tokens contain `accessToken`, `refreshToken`,
and `accessTokenExpiresIn` in seconds. Expired memberships are omitted.
Registration creates user, household and Owner membership in one transaction.
Emails are trimmed and lowercased. Passwords require at least 10 characters and
at most 72 UTF-8 bytes. Only bcrypt password hashes and SHA-256 session hashes
are stored. Concurrent refresh of the same token has one winner; replay fails.
Logout revokes refresh capability; already-issued access tokens expire normally.

Errors use `code`, `message`, and `requestId`. Validation messages may be arrays.
Login, register and refresh are rate-limited. Swagger is available at `/docs`
outside production. HTTP logs omit URLs, request bodies and tokens.

## Devices

`GET /households/{householdId}/devices?limit=20&cursor={deviceId}` requires a
Bearer access token and current membership of an active user. UUID parameters
are validated. Limit is 1-50; pagination orders device UUIDs ascending.

Response: `{ items, nextCursor }`. Each item includes `id`, `name`, `room`,
`deviceType`, `isOnline`, `lastSeenAt`, and up to two latest `readings` containing
`metric`, numeric `value`, `unit`, and `recordedAt`.
Sprint 1 ingests paired DHT temperature/humidity readings only.
Online status expires after `DEVICE_OFFLINE_AFTER_MS` without accepted telemetry.
Last-seen and reading timestamps use server receive time.

`GET /health` checks API liveness. `GET /health/ready` checks PostgreSQL and MQTT;
it returns 503 when a dependency is unavailable.

## Telemetry

Topic: `home/{householdId}/device/{deviceId}/telemetry`.

```json
{
  "schemaVersion": 1,
  "messageId": "11111111-1111-4111-8111-111111111111",
  "deviceId": "22222222-2222-4222-8222-222222222222",
  "timestamp": "2026-09-14T00:00:00.000Z",
  "data": { "temperature": 28.4, "humidity": 67 }
}
```

Only the configured topic root, valid UUIDs, UTC ISO timestamps ending in Z,
schema version 1 and these exact fields are accepted. Temperature is -40 to 80
degrees Celsius; humidity is 0-100 percent. Numeric strings, extra fields,
including alternate units, missing readings, mismatched device IDs, and payloads
over `MQTT_MAX_PAYLOAD_BYTES` (16384 by default) are rejected.
The topic household must own an existing DHT sensor.

The transaction writes a durable `(deviceId, messageId)` receipt, two readings,
and last-seen state. Duplicate receipts roll back without modifying readings or
last-seen state. Device event time is stored separately and does not determine
expiry. MQTT reconnect delay grows to its configured maximum and resets on
connection; the subscription is renewed after connection.

The local broker is anonymous and loopback-bound. This is the Sprint 1 simulator
configuration, not a device authentication/provisioning system. Do not expose
these broker ports to a LAN or the Internet. There is no mobile MQTT connection.
There is no durable retry queue: overload or failed database writes can lose
telemetry; this MVP does not promise lossless ingestion. Devices should send
fresh readings periodically. Commands and alerts are outside Sprint 1.

## Mobile

Native refresh tokens use Expo Secure Store; access tokens remain in memory.
Concurrent 401 responses share a refresh and each original request retries once.
Network failures during restoration retain the token and show retry. Offline
logout reports failure rather than claiming server revocation succeeded.
Web preview keeps tokens in memory only and requires login after a page reload.
The device view refreshes on focus and pull-to-refresh, with cursor load-more.
Cached readings are labelled when a refresh fails. WebSocket updates are deferred
until the basic REST flow is verified, as allowed by the Sprint 1 plan.

## ESP32 hardware extension (2026-09-16)

Firmware and hardware prerequisites are documented in
`firmware/esp32-smart-home/README.md`. The optional third argument of the local
device setup CLI is now `dht`, `light`, or `fan` (default `dht`).

LIGHT/FAN heartbeat topic: `home/{householdId}/device/{deviceId}/availability`.
Payload: `{ "schemaVersion": 1, "deviceId": "uuid", "online": true }`.
Only these three fields are accepted. Topic UUIDs and payload identity are
validated before a household-and-device-scoped database update. Retained
messages are ignored; online freshness uses server receive time. Offline
messages preserve lastSeenAt and set isOnline=false. List/detail and commands
check both this flag and freshness. DHT keeps its existing telemetry contract.
The device responses also include lastSeenAt, as required by the mobile parser.

No LAN listener, firewall rule, credentials, or real hardware was configured.
The current loopback-only broker remains unchanged. Hardware compilation and
acceptance remain pending; backend checks do not prove ESP32 behavior.
