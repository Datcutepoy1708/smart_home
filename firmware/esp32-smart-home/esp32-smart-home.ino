/*
 * esp32-smart-home.ino — ESP32 Firmware for Smart Home System
 *
 * Hardware:
 *   GPIO4  → DHT11 data (temperature / humidity sensor)
 *   GPIO2  → Light relay/MOSFET driver
 *   GPIO5  → Fan relay/MOSFET driver
 *
 * Protocol (all topics prefixed with MQTT_ROOT/HOUSEHOLD_ID/device/<deviceId>/):
 *   SUBSCRIBE: .../command        ← receives commands from backend
 *   PUBLISH:   .../ack            ← command acknowledgement
 *   PUBLISH:   .../telemetry      ← periodic sensor readings (SENSOR_ID only)
 *   PUBLISH:   .../availability   ← periodic heartbeat (online/offline)
 *
 * Command payload (schemaVersion 1):
 *   { schemaVersion:1, commandId:"<uuid>", deviceId:"<uuid>",
 *     action:"turn_on"|"turn_off", params:{power:"on"|"off"}, timestamp:"..." }
 *
 * ACK payload (schemaVersion 1):
 *   { schemaVersion:1, messageId:"<uuid>", commandId:"<uuid>", deviceId:"<uuid>",
 *     status:"success"|"failed", state:{power:"on"|"off"}, timestamp:"..." }
 *   On failure: state is absent, error:"<reason>" is present instead.
 *
 * Libraries required (Arduino Library Manager):
 *   - MQTT by Joel Gaehwiler  ≥ 2.5.2
 *   - ArduinoJson              ≥ 7.x
 *   - DHT sensor library by Adafruit + Adafruit Unified Sensor
 *
 * Setup:
 *   Copy config.example.h → config.h and fill in credentials.
 *   Set FAN_DRIVER_VERIFIED to true only after verifying GPIO5 drives a
 *   proper transistor/relay, NEVER connect the motor wire directly.
 */

#include <WiFi.h>
#include <MQTT.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <esp_system.h>
#include <time.h>
#include "config.h"

// ── Pin assignments ─────────────────────────────────────────────────────────
constexpr uint8_t DHT_PIN   = 4;
constexpr uint8_t LIGHT_PIN = 2;
constexpr uint8_t FAN_PIN   = 5;
constexpr uint8_t DOOR_SERVO_PIN = SERVO_PIN;

// ── Objects ──────────────────────────────────────────────────────────────────
DHT        dht(DHT_PIN, DHT11);
Servo      doorServo;
WiFiClient network;
MQTTClient mqtt(2048);      // 2 kB receive buffer

// ── State ────────────────────────────────────────────────────────────────────
bool lightOn    = false;
bool fanOn      = false;
int  doorAngle  = 0;        // 0 = closed, >0 = open
bool configured = false;    // true once config UUIDs are validated in setup()

unsigned long lastConnect   = 0;
unsigned long lastSensor    = 0;
unsigned long lastHeartbeat = 0;

// ── Circular message queue ────────────────────────────────────────────────────
// MQTT callbacks run inside QoS1 book-keeping; we only queue here and process
// in loop() so the MQTT library never blocks waiting for us.
constexpr uint8_t QUEUE_SIZE = 8;
String queuedTopic[QUEUE_SIZE];
String queuedPayload[QUEUE_SIZE];
uint8_t queueRead  = 0;
uint8_t queueWrite = 0;
uint8_t queueCount = 0;

// ── ACK de-duplication cache ──────────────────────────────────────────────────
// QoS1 guarantees at-least-once delivery. When the broker re-delivers a command
// we must respond with the identical ACK we sent the first time, NOT re-execute
// the action. Cache the last DEDUP_SIZE ACKs keyed by commandId+deviceId.
constexpr uint8_t DEDUP_SIZE = 16;
String cachedCommandId[DEDUP_SIZE];
String cachedDeviceId[DEDUP_SIZE];
String cachedAck[DEDUP_SIZE];
uint8_t cacheNext = 0;

// ── Servo (Door) Control ─────────────────────────────────────────────────────
void setupServo() {
  doorServo.attach(DOOR_SERVO_PIN);
  writeServo(0);
}

void writeServo(int angle) {
  int clamped = constrain(angle, 0, 180);
  doorAngle = clamped;
  doorServo.write(clamped);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Lightweight UUID v4 format validator (no RFC variant-bit check). */
bool validUuid(const char *v) {
  if (!v || strlen(v) != 36) return false;
  for (int i = 0; i < 36; i++) {
    char c = v[i];
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (c != '-') return false;
    } else if (!isxdigit(static_cast<unsigned char>(c))) return false;
  }
  return true;
}

/** Generate a random UUID v4 string using ESP32 hardware RNG. */
String makeUuid() {
  uint8_t b[16];
  esp_fill_random(b, sizeof(b));
  b[6] = (b[6] & 0x0f) | 0x40;   // version 4
  b[8] = (b[8] & 0x3f) | 0x80;   // variant 1
  char out[37];
  snprintf(out, sizeof(out),
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
    b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]);
  return String(out);
}

/** Return ISO-8601 UTC timestamp, or "" if NTP has not synced yet. */
String nowIso() {
  time_t t = time(nullptr);
  if (t < 1700000000L) return "";   // NTP not ready
  struct tm utc;
  gmtime_r(&t, &utc);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S.000Z", &utc);
  return String(buf);
}

/** Build the MQTT topic: <MQTT_ROOT>/<HOUSEHOLD_ID>/device/<deviceId>/<suffix> */
String topicFor(const char *deviceId, const char *suffix) {
  return String(MQTT_ROOT) + "/" + HOUSEHOLD_ID + "/device/" + deviceId + "/" + suffix;
}

/** Serialize doc → topic at QoS 1. Returns false if publish failed. */
bool sendJson(const String &topic, JsonDocument &doc, bool retained = false) {
  String payload;
  serializeJson(doc, payload);
  bool ok = mqtt.publish(topic, payload, retained, /*qos=*/1);
  if (!ok) Serial.println("[MQTT] publish failed: " + topic);
  return ok;
}

// ── MQTT message callback ─────────────────────────────────────────────────────

void receiveMessage(String &topic, String &payload) {
  if (payload.length() > 1536 || queueCount >= QUEUE_SIZE) {
    Serial.println("[CMD] rejected: queue full or payload too large");
    return;
  }
  queuedTopic[queueWrite]   = topic;
  queuedPayload[queueWrite] = payload;
  queueWrite = (queueWrite + 1) % QUEUE_SIZE;
  queueCount++;
}

// ── Command processing ────────────────────────────────────────────────────────

/**
 * Process a single command from the queue.
 *
 * Validation mirrors the backend's handleDeviceAck() checks so that the
 * firmware rejects the same malformed messages the backend would reject:
 *   1. Topic must match one of our subscribed device topics.
 *   2. schemaVersion must be exactly 1.
 *   3. commandId must be a valid UUID.
 *   4. payload.deviceId must match the topic device (no cross-device spoofing).
 *   5. action must be "turn_on" or "turn_off".
 *   6. params.power must match the action ("on"/"off").
 *
 * ACK format matches the backend's ACK validator:
 *   - status "success": state.power is "on" or "off" (never absent/empty).
 *   - status "failed" : error field set, state is absent.
 *   - schemaVersion: 1, deviceId: <deviceId> — both required by backend.
 */
void processCommand(const String &topic, const String &payload) {
  // Step 1 — which device does this topic belong to?
  const char *deviceId = nullptr;
  bool isFan = false;
  bool isDoor = false;
  if (topic == topicFor(LIGHT_ID, "command")) {
    deviceId = LIGHT_ID;
    isFan    = false;
  } else if (topic == topicFor(FAN_ID, "command")) {
    deviceId = FAN_ID;
    isFan    = true;
  } else if (topic == topicFor(DOOR_ID, "command")) {
    deviceId = DOOR_ID;
    isDoor   = true;
  } else {
    return;   // not our topic
  }

  // Step 2 — parse JSON
  JsonDocument cmd;
  if (deserializeJson(cmd, payload, DeserializationOption::NestingLimit(5))) {
    Serial.println("[CMD] JSON parse error");
    return;
  }

  // Step 3 — validate schema version
  if (cmd["schemaVersion"] != 1) {
    Serial.println("[CMD] unsupported schemaVersion");
    return;
  }

  // Step 4 — validate commandId
  const char *commandId = cmd["commandId"] | "";
  if (!validUuid(commandId)) {
    Serial.println("[CMD] invalid commandId");
    return;
  }

  // Step 5 — validate payload.deviceId matches topic device
  if (strcmp(cmd["deviceId"] | "", deviceId) != 0) {
    Serial.println("[CMD] deviceId mismatch");
    return;
  }

  // Step 6 — de-duplication: re-send cached ACK for already-processed commands
  for (uint8_t i = 0; i < DEDUP_SIZE; i++) {
    if (cachedCommandId[i] == commandId && cachedDeviceId[i] == deviceId) {
      Serial.println("[CMD] duplicate commandId — replaying cached ACK");
      mqtt.publish(topicFor(deviceId, "ack"), cachedAck[i], /*retained=*/false, /*qos=*/1);
      return;
    }
  }

  // Step 7 & 8 — validate action and execute hardware action or determine failure reason
  const char *action = cmd["action"] | "";
  const char *failureReason = nullptr;

  if (isDoor) {
    int targetAngle = doorAngle;
    if (strcmp(action, "open") == 0) {
      targetAngle = cmd["params"]["angle"] | 90;
    } else if (strcmp(action, "close") == 0) {
      targetAngle = 0;
    } else if (strcmp(action, "set_angle") == 0) {
      targetAngle = cmd["params"]["angle"] | 0;
    } else {
      failureReason = "invalid_command";
    }

    if (!failureReason) {
      targetAngle = constrain(targetAngle, 0, 180);
      writeServo(targetAngle);
    }
  } else {
    bool wantOn = strcmp(action, "turn_on") == 0;
    bool wantOff = strcmp(action, "turn_off") == 0;
    const char *paramPower = cmd["params"]["power"] | "";
    bool validAction = (wantOn  && strcmp(paramPower, "on")  == 0)
                    || (wantOff && strcmp(paramPower, "off") == 0);

    if (!validAction) {
      failureReason = "invalid_command";
    } else if (isFan && !FAN_DRIVER_VERIFIED) {
      failureReason = "fan_wiring_not_verified";
    } else {
      // Apply to hardware
      bool activeHigh = isFan ? FAN_ACTIVE_HIGH : LIGHT_ACTIVE_HIGH;
      digitalWrite(isFan ? FAN_PIN : LIGHT_PIN,
                   wantOn == activeHigh ? HIGH : LOW);
      if (isFan) fanOn = wantOn; else lightOn = wantOn;
    }
  }

  // Step 9 — build ACK
  // state is only set on success; on failure, state is absent and
  // error is set.
  JsonDocument ack;
  ack["schemaVersion"] = 1;
  ack["messageId"]     = makeUuid();
  ack["commandId"]     = commandId;
  ack["deviceId"]      = deviceId;     // required by backend ACK validator
  ack["status"]        = failureReason ? "failed" : "success";
  if (failureReason) {
    ack["error"] = failureReason;
  } else if (isDoor) {
    ack["state"]["position"] = (doorAngle > 0) ? "open" : "closed";
    ack["state"]["angle"]    = doorAngle;
  } else {
    bool isOn = isFan ? fanOn : lightOn;
    ack["state"]["power"] = isOn ? "on" : "off";
  }
  String ts = nowIso();
  if (ts.length()) ack["timestamp"] = ts;

  // Step 10 — publish ACK and cache it for de-duplication
  String serialized;
  serializeJson(ack, serialized);

  cachedCommandId[cacheNext] = commandId;
  cachedDeviceId[cacheNext]  = deviceId;
  cachedAck[cacheNext]       = serialized;
  cacheNext = (cacheNext + 1) % DEDUP_SIZE;

  bool ok = mqtt.publish(topicFor(deviceId, "ack"), serialized, /*retained=*/false, /*qos=*/1);
  Serial.printf("[CMD] %s → %s | status=%s | published=%s\n",
    commandId, deviceId, failureReason ? failureReason : "success", ok ? "ok" : "FAIL");
}

// ── Periodic publishing ───────────────────────────────────────────────────────

/**
 * Publish an availability heartbeat for a device.
 * The backend uses lastSeenAt to determine online status; this keeps it fresh.
 */
void sendHeartbeat(const char *deviceId, bool online) {
  JsonDocument doc;
  doc["schemaVersion"] = 1;
  doc["deviceId"]      = deviceId;
  doc["online"]        = online;
  String ts = nowIso();
  if (ts.length()) doc["timestamp"] = ts;
  sendJson(topicFor(deviceId, "availability"), doc);
}

/**
 * Read DHT11 and publish temperature + humidity telemetry.
 * Skips if NTP has not synced (timestamp would be invalid) or sensor read fails.
 */
void sendSensor() {
  String ts = nowIso();
  if (!ts.length()) {
    Serial.println("[SENSOR] waiting for NTP sync");
    return;
  }
  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature();  // Celsius

  // Reject obviously invalid readings (open circuit, power issue, etc.)
  if (isnan(humidity) || isnan(temperature)
      || humidity < 0   || humidity > 100
      || temperature < -40 || temperature > 80) {
    Serial.println("[SENSOR] DHT11 read failed or out of range");
    return;
  }

  JsonDocument doc;
  doc["schemaVersion"]       = 1;
  doc["messageId"]           = makeUuid();
  doc["deviceId"]            = SENSOR_ID;
  doc["timestamp"]           = ts;
  doc["data"]["temperature"] = temperature;
  doc["data"]["humidity"]    = humidity;

  bool ok = sendJson(topicFor(SENSOR_ID, "telemetry"), doc);
  if (ok) {
    Serial.printf("[SENSOR] %.1f°C  %.0f%%RH\n", temperature, humidity);
  }
}

// ── Arduino lifecycle ─────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n[BOOT] Smart Home ESP32 firmware starting...");

  // Drive output pins to the "off" state BEFORE enabling them as outputs
  // to avoid a glitch that could briefly energise a relay on boot.
  digitalWrite(LIGHT_PIN, LIGHT_ACTIVE_HIGH ? LOW : HIGH);
  pinMode(LIGHT_PIN, OUTPUT);

  if (FAN_DRIVER_VERIFIED) {
    digitalWrite(FAN_PIN, FAN_ACTIVE_HIGH ? LOW : HIGH);
    pinMode(FAN_PIN, OUTPUT);
    Serial.println("[BOOT] Fan driver enabled");
  } else {
    // Tri-state so nothing drives the pin — safe if wiring is incomplete
    pinMode(FAN_PIN, INPUT);
    Serial.println("[BOOT] Fan GPIO held as INPUT (FAN_DRIVER_VERIFIED=false)");
  }

  dht.begin();
  setupServo();

  // Validate that all device IDs have been configured in config.h
  configured = validUuid(HOUSEHOLD_ID)
            && validUuid(SENSOR_ID)
            && validUuid(LIGHT_ID)
            && validUuid(FAN_ID)
            && validUuid(DOOR_ID)
            && strcmp(SENSOR_ID, LIGHT_ID) != 0
            && strcmp(LIGHT_ID,  FAN_ID)  != 0
            && strcmp(SENSOR_ID, FAN_ID)  != 0
            && strcmp(DOOR_ID,   LIGHT_ID) != 0;

  if (!configured) {
    Serial.println("[BOOT] ERROR: config.h has missing or duplicate device UUIDs.");
    Serial.println("       Copy config.example.h → config.h and fill in real database IDs.");
    return;
  }

  Serial.println("[BOOT] Config valid. Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Sync wall-clock from NTP so timestamps in telemetry/ACK are real ISO-8601
  configTime(/*gmtOffset_sec=*/0, /*daylightOffset_sec=*/0, NTP_SERVER);

  mqtt.begin(MQTT_HOST, MQTT_PORT, network);
  mqtt.setOptions(/*keepAlive=*/15, /*cleanSession=*/true, /*timeout=*/1000);
  mqtt.onMessage(receiveMessage);

  // Start the reconnect attempt immediately on first loop()
  lastConnect = millis() - RECONNECT_INTERVAL_MS;
  Serial.println("[BOOT] Setup done.");
}

void loop() {
  if (!configured) { delay(20); return; }

  unsigned long now = millis();

  // ── Reconnection logic ──────────────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED || !mqtt.connected()) {
    // Flush queued commands — they are stale after a disconnect
    queueCount = queueRead = queueWrite = 0;

    if (now - lastConnect >= RECONNECT_INTERVAL_MS) {
      lastConnect = now;
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Reconnecting...");
        WiFi.reconnect();
      } else {
        Serial.println("[MQTT] Connecting...");
        // clientId includes MAC so multiple units in the same household don't clash
        String clientId = "esp32-" + WiFi.macAddress();
        clientId.replace(":", "");  // some brokers reject colons in client IDs

        if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
          Serial.println("[MQTT] Connected.");
          // Subscribe to command topics for controllable devices
          bool ok = mqtt.subscribe(topicFor(LIGHT_ID, "command"), /*qos=*/1)
                 && mqtt.subscribe(topicFor(FAN_ID,   "command"), /*qos=*/1)
                 && mqtt.subscribe(topicFor(DOOR_ID,  "command"), /*qos=*/1);
          if (!ok) {
            Serial.println("[MQTT] Subscribe failed — disconnecting.");
            mqtt.disconnect();
          } else {
            Serial.println("[MQTT] Subscribed to command topics.");
            // Send heartbeats immediately so the backend marks devices online
            lastHeartbeat = now - HEARTBEAT_INTERVAL_MS;
          }
        } else {
          Serial.println("[MQTT] Connection failed.");
        }
      }
    }
    delay(5);
    return;
  }

  // ── Normal operation ────────────────────────────────────────────────────────
  mqtt.loop();   // processes incoming QoS1 handshakes and fires receiveMessage()

  // Drain one command per loop() tick to keep the watchdog happy
  if (queueCount > 0) {
    String topic   = queuedTopic[queueRead];
    String payload = queuedPayload[queueRead];
    queueRead  = (queueRead + 1) % QUEUE_SIZE;
    queueCount--;
    processCommand(topic, payload);
  }

  // Periodic heartbeat — keeps lastSeenAt fresh in the backend DB
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat(LIGHT_ID, true);
    sendHeartbeat(FAN_ID,   FAN_DRIVER_VERIFIED);
    sendHeartbeat(DOOR_ID,  true);
    sendHeartbeat(SENSOR_ID, true);
  }

  // Periodic sensor telemetry
  if (now - lastSensor >= SENSOR_INTERVAL_MS) {
    lastSensor = now;
    sendSensor();
  }

  delay(2);   // yield to RTOS / watchdog
}
