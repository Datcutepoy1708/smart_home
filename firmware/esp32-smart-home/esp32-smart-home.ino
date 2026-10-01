/*
 * esp32-smart-home.ino — ESP32-S3 Firmware for Smart Home System
 *
 * Hardware Map (ESP32-S3):
 *   GPIO4  → DHT11 data (temperature / humidity sensor)
 *   GPIO5  → TB6612 AIN1 (Motor N20 direction 1)
 *   GPIO6  → TB6612 AIN2 (Motor N20 direction 2)
 *   GPIO7  → TB6612 PWMA (Motor N20 speed PWM)
 *   GPIO8  → Relay 1 (10 LED cluster)
 *   GPIO9  → Relay 2 (5V Fan)
 *   GPIO12 → Rain sensor DO
 *   GPIO13 → Flame sensor DO
 *   GPIO14 → MQ-2 Gas sensor DO (via voltage divider)
 *   GPIO18 → Servo MG90S (Main door)
 *
 * Protocol:
 *   SUBSCRIBE: .../command        ← receives commands from backend/app
 *   PUBLISH:   .../ack            ← command acknowledgement
 *   PUBLISH:   .../telemetry      ← periodic sensor readings
 *   PUBLISH:   .../availability   ← periodic heartbeat (online/offline)
 */

#include <WiFi.h>
#include <MQTT.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <esp_system.h>
#include <time.h>
#include "config.h"

// ── Objects ──────────────────────────────────────────────────────────────────
DHT        dht(DHT_PIN, DHT11);
Servo      doorServo;
WiFiClient network;
MQTTClient mqtt(2048);      // 2 kB receive buffer

// ── States ───────────────────────────────────────────────────────────────────
bool lightOn    = false;
bool fanOn      = false;
bool manualFan  = false;             // true: user explicitly turned fan on/off manually
int  doorAngle  = DOOR_CLOSED_ANGLE; // 0 = closed, 90 = open
bool autoMode   = true;              // AUTO / MANUAL
bool lastRainState = false;
bool lastGasState  = false;
bool lastFireState = false;
bool manualGasSim  = false;
bool manualFireSim = false;

void sendSensorTelemetry();

enum CoverState {
  COVER_UNKNOWN,
  COVER_OPEN,
  COVER_CLOSED,
  COVER_OPENING,
  COVER_CLOSING
};
CoverState coverState = COVER_UNKNOWN;

bool motorRunning = false;
unsigned long motorStartTime = 0;

bool configured = false;

unsigned long lastConnect   = 0;
unsigned long lastSensor    = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastAutoLoop  = 0;

// ── Circular message queue ────────────────────────────────────────────────────
constexpr uint8_t QUEUE_SIZE = 8;
String queuedTopic[QUEUE_SIZE];
String queuedPayload[QUEUE_SIZE];
uint8_t queueRead  = 0;
uint8_t queueWrite = 0;
uint8_t queueCount = 0;

// ── ACK de-duplication cache ──────────────────────────────────────────────────
constexpr uint8_t DEDUP_SIZE = 16;
String cachedCommandId[DEDUP_SIZE];
String cachedDeviceId[DEDUP_SIZE];
String cachedAck[DEDUP_SIZE];
uint8_t cacheNext = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

String nowIso() {
  time_t t = time(nullptr);
  if (t < 1700000000L) return "";   // NTP not ready
  struct tm utc;
  gmtime_r(&t, &utc);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S.000Z", &utc);
  return String(buf);
}

String topicFor(const char *deviceId, const char *suffix) {
  return String(MQTT_ROOT) + "/" + HOUSEHOLD_ID + "/device/" + deviceId + "/" + suffix;
}

bool sendJson(const String &topic, JsonDocument &doc, bool retained = false) {
  String payload;
  serializeJson(doc, payload);
  bool ok = mqtt.publish(topic, payload, retained, /*qos=*/1);
  if (!ok) Serial.println("[MQTT] publish failed: " + topic);
  return ok;
}

// ── Relay Control ────────────────────────────────────────────────────────────

void setRelay(int pin, bool state) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(pin, state ? LOW : HIGH);
  } else {
    digitalWrite(pin, state ? HIGH : LOW);
  }
}

void turnLedOn() {
  setRelay(RELAY_LED, true);
  lightOn = true;
  Serial.println("[LED] ON");
}

void turnLedOff() {
  setRelay(RELAY_LED, false);
  lightOn = false;
  Serial.println("[LED] OFF");
}

void turnFanOn() {
  setRelay(RELAY_FAN, true);
  fanOn = true;
  Serial.println("[FAN] ON");
}

void turnFanOff() {
  setRelay(RELAY_FAN, false);
  fanOn = false;
  Serial.println("[FAN] OFF");
}

// ── Door (Servo) Control ─────────────────────────────────────────────────────

void writeServoAngle(int angle) {
  doorAngle = constrain(angle, 0, 180);
  int physicalAngle = INVERT_DOOR_SERVO ? (90 - doorAngle) : doorAngle;
  physicalAngle = constrain(physicalAngle, 0, 180);

  // Cơ chế mượn nguồn phụ thông minh:
  // Nếu Quạt đang tắt, tạm thời đóng Relay quạt để cấp nguồn 5V cho Servo quay
  bool wasFanOn = fanOn;
  if (!wasFanOn) {
    setRelay(RELAY_FAN, true);
    delay(40); // Chờ 40ms cho điện áp 5V cấp tới Servo ổn định
  }

  doorServo.write(physicalAngle);
  Serial.printf("[DOOR] Logical = %d | Physical Servo = %d\n", doorAngle, physicalAngle);

  // Chờ servo hoàn tất hành trình quay (400ms là đủ cho MG90S quay 90°)
  delay(400);

  // Nếu trước đó quạt đang tắt thì ngắt Relay quạt lại, bảo toàn trạng thái quạt
  if (!wasFanOn) {
    setRelay(RELAY_FAN, false);
  }
}

void openDoor() {
  writeServoAngle(DOOR_OPEN_ANGLE);
  Serial.println("[DOOR] OPEN");
}

void closeDoor() {
  writeServoAngle(DOOR_CLOSED_ANGLE);
  Serial.println("[DOOR] CLOSE");
}

// ── Motor / Cover (Mái che) Control ──────────────────────────────────────────

void stopMotor() {
  digitalWrite(MOTOR_AIN1, LOW);
  digitalWrite(MOTOR_AIN2, LOW);
  analogWrite(MOTOR_PWMA, 0);
  motorRunning = false;
  Serial.println("[MOTOR] STOP");
}

void startClosingCover() {
  if (motorRunning) return;
  Serial.println("[COVER] CLOSING...");
  digitalWrite(MOTOR_AIN1, HIGH);
  digitalWrite(MOTOR_AIN2, LOW);
  analogWrite(MOTOR_PWMA, MOTOR_SPEED);
  motorRunning = true;
  motorStartTime = millis();
  coverState = COVER_CLOSING;
}

void startOpeningCover() {
  if (motorRunning) return;
  Serial.println("[COVER] OPENING...");
  digitalWrite(MOTOR_AIN1, LOW);
  digitalWrite(MOTOR_AIN2, HIGH);
  analogWrite(MOTOR_PWMA, MOTOR_SPEED);
  motorRunning = true;
  motorStartTime = millis();
  coverState = COVER_OPENING;
}

void updateMotor() {
  if (!motorRunning) return;
  if (millis() - motorStartTime >= COVER_MOVE_TIME) {
    stopMotor();
    if (coverState == COVER_CLOSING) {
      coverState = COVER_CLOSED;
      Serial.println("[COVER] CLOSED");
    } else if (coverState == COVER_OPENING) {
      coverState = COVER_OPEN;
      Serial.println("[COVER] OPEN");
    }
  }
}

// ── Sensor Reading Helpers ───────────────────────────────────────────────────

bool isRaining() {
  int value = digitalRead(RAIN_PIN);
  return RAIN_ACTIVE_LOW ? (value == LOW) : (value == HIGH);
}

bool isFireDetected() {
  if (manualFireSim) return true;
  int value = digitalRead(FLAME_PIN);
  return FLAME_ACTIVE_LOW ? (value == LOW) : (value == HIGH);
}

bool isGasDetected() {
  if (manualGasSim) return true;
  int dVal = digitalRead(MQ2_PIN);
  return MQ2_ACTIVE_LOW ? (dVal == LOW) : (dVal == HIGH);
}

// ── Automatic System Control ─────────────────────────────────────────────────

void automaticFanControl(float temperature) {
  if (isnan(temperature) || manualFan) return;

  if (temperature >= FAN_ON_TEMP) {
    if (!fanOn) {
      Serial.printf("[AUTO] High temperature (%.1f°C) -> Fan ON\n", temperature);
      turnFanOn();
    }
  } else if (temperature <= FAN_OFF_TEMP) {
    if (fanOn && !isGasDetected()) {
      Serial.printf("[AUTO] Normal temperature (%.1f°C) -> Fan OFF\n", temperature);
      turnFanOff();
    }
  }
}

void automaticGasControl() {
  bool gas = isGasDetected();
  if (gas != lastGasState) {
    lastGasState = gas;
    if (gas) {
      Serial.println("[ALERT] GAS/SMOKE DETECTED! Emergency Fan ON & sending instant alert to Cloud...");
      turnFanOn();
      sendSensorTelemetry(); // Bắn telemetry gas=1 ngay lập tức lên Cloud để nổ thông báo về điện thoại
    } else {
      Serial.println("[AUTO] Gas/Smoke cleared -> Fan OFF & Normal state");
      if (!manualFan) turnFanOff(); // Tự động ngắt quạt khi hết sạch gas
      sendSensorTelemetry();
    }
  } else if (gas && !fanOn) {
    turnFanOn();
  }
}

void automaticFireControl() {
  bool fire = isFireDetected();
  if (fire != lastFireState) {
    lastFireState = fire;
    if (fire) {
      Serial.println("[ALERT] FIRE DETECTED! Sending instant emergency alert to Cloud...");
      sendSensorTelemetry(); // Bắn telemetry fire=1 ngay lập tức lên Cloud để nổ chuông báo cháy
    } else {
      Serial.println("[AUTO] Fire cleared -> Normal state");
      sendSensorTelemetry();
    }
  }
}

void automaticCoverControl() {
  if (motorRunning) return;

  bool rain = isRaining();

  // Instant trigger upon rain state transition
  if (rain != lastRainState) {
    lastRainState = rain;
    if (rain) {
      Serial.println("[ALERT] RAIN DETECTED! Closing cover & sending instant alert to Cloud...");
      if (coverState == COVER_OPENING) stopMotor();
      startClosingCover();
      sendSensorTelemetry(); // Gửi ngay telemetry rain=1 lên Cloud để bắn thông báo về điện thoại
    } else {
      Serial.println("[AUTO] Rain stopped -> Opening cover");
      if (coverState == COVER_CLOSING) stopMotor();
      startOpeningCover();
      sendSensorTelemetry();
    }
    return;
  }

  if (rain) {
    if (coverState == COVER_OPEN || coverState == COVER_UNKNOWN || coverState == COVER_OPENING) {
      Serial.println("[AUTO] Rain detected -> Closing cover");
      if (coverState == COVER_OPENING) stopMotor();
      startClosingCover();
    }
  } else {
    if (coverState == COVER_CLOSED || coverState == COVER_CLOSING) {
      Serial.println("[AUTO] Rain stopped -> Opening cover");
      if (coverState == COVER_CLOSING) stopMotor();
      startOpeningCover();
    }
  }
}

void automaticSystem() {
  if (!autoMode) return;

  float temperature = dht.readTemperature();
  automaticFanControl(temperature);
  automaticGasControl();
  automaticCoverControl();
  automaticFireControl();
}

// ── MQTT Message Queue & Receive ─────────────────────────────────────────────

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

// ── Command Processing ───────────────────────────────────────────────────────

void processCommand(const String &topic, const String &payload) {
  const char *deviceId = nullptr;
  enum DevKind { DEV_LIGHT, DEV_FAN, DEV_DOOR, DEV_COVER } kind;

  if (topic == topicFor(LIGHT_ID, "command")) {
    deviceId = LIGHT_ID;
    kind = DEV_LIGHT;
  } else if (topic == topicFor(FAN_ID, "command")) {
    deviceId = FAN_ID;
    kind = DEV_FAN;
  } else if (topic == topicFor(DOOR_ID, "command")) {
    deviceId = DOOR_ID;
    kind = DEV_DOOR;
  } else if (topic == topicFor(COVER_ID, "command")) {
    deviceId = COVER_ID;
    kind = DEV_COVER;
  } else {
    return;
  }

  JsonDocument cmd;
  if (deserializeJson(cmd, payload, DeserializationOption::NestingLimit(5))) {
    Serial.println("[CMD] JSON parse error");
    return;
  }

  if (cmd["schemaVersion"] != 1) {
    Serial.println("[CMD] unsupported schemaVersion");
    return;
  }

  const char *commandId = cmd["commandId"] | "";
  if (!validUuid(commandId)) {
    Serial.println("[CMD] invalid commandId");
    return;
  }

  if (strcmp(cmd["deviceId"] | "", deviceId) != 0) {
    Serial.println("[CMD] deviceId mismatch");
    return;
  }

  // De-duplication check
  for (uint8_t i = 0; i < DEDUP_SIZE; i++) {
    if (cachedCommandId[i] == commandId && cachedDeviceId[i] == deviceId) {
      Serial.println("[CMD] duplicate commandId — replaying cached ACK");
      mqtt.publish(topicFor(deviceId, "ack"), cachedAck[i], /*retained=*/false, /*qos=*/1);
      return;
    }
  }

  const char *action = cmd["action"] | "";
  const char *failureReason = nullptr;

  if (kind == DEV_LIGHT) {
    if (strcmp(action, "turn_on") == 0) turnLedOn();
    else if (strcmp(action, "turn_off") == 0) turnLedOff();
    else failureReason = "invalid_command";
  } else if (kind == DEV_FAN) {
    if (strcmp(action, "turn_on") == 0) {
      manualFan = true;
      turnFanOn();
    } else if (strcmp(action, "turn_off") == 0) {
      manualFan = true;
      turnFanOff();
    } else failureReason = "invalid_command";
  } else if (kind == DEV_DOOR) {
    if (strcmp(action, "open") == 0) openDoor();
    else if (strcmp(action, "close") == 0) closeDoor();
    else if (strcmp(action, "set_angle") == 0) {
      int angle = cmd["params"]["angle"] | 0;
      writeServoAngle(angle);
    } else failureReason = "invalid_command";
  } else if (kind == DEV_COVER) {
    if (strcmp(action, "open") == 0 || strcmp(action, "open_cover") == 0) {
      autoMode = false; // user manually commanded
      startOpeningCover();
    } else if (strcmp(action, "close") == 0 || strcmp(action, "close_cover") == 0) {
      autoMode = false;
      startClosingCover();
    } else if (strcmp(action, "stop") == 0 || strcmp(action, "stop_cover") == 0) {
      autoMode = false;
      stopMotor();
      coverState = COVER_UNKNOWN;
    } else if (strcmp(action, "set_mode") == 0) {
      const char *m = cmd["params"]["mode"] | "auto";
      autoMode = (strcmp(m, "auto") == 0);
      if (autoMode) manualFan = false;
      Serial.printf("[MODE] %s\n", autoMode ? "AUTO" : "MANUAL");
    } else {
      failureReason = "invalid_command";
    }
  }

  // Build ACK
  JsonDocument ack;
  ack["schemaVersion"] = 1;
  ack["messageId"]     = makeUuid();
  ack["commandId"]     = commandId;
  ack["deviceId"]      = deviceId;
  ack["status"]        = failureReason ? "failed" : "success";

  if (failureReason) {
    ack["error"] = failureReason;
  } else if (kind == DEV_LIGHT) {
    ack["state"]["power"] = lightOn ? "on" : "off";
  } else if (kind == DEV_FAN) {
    ack["state"]["power"] = fanOn ? "on" : "off";
  } else if (kind == DEV_DOOR) {
    ack["state"]["position"] = (doorAngle == DOOR_OPEN_ANGLE) ? "open" : "closed";
    ack["state"]["angle"]    = doorAngle;
  } else if (kind == DEV_COVER) {
    if (strcmp(action, "set_mode") == 0) {
      ack["state"]["mode"] = autoMode ? "auto" : "manual";
    } else {
      const char *st = "stopped";
      if (strcmp(action, "open") == 0 || strcmp(action, "open_cover") == 0) st = "open";
      else if (strcmp(action, "close") == 0 || strcmp(action, "close_cover") == 0) st = "closed";
      else if (strcmp(action, "stop") == 0 || strcmp(action, "stop_cover") == 0) st = "stopped";
      else if (coverState == COVER_OPEN) st = "open";
      else if (coverState == COVER_CLOSED) st = "closed";
      else if (coverState == COVER_OPENING) st = "opening";
      else if (coverState == COVER_CLOSING) st = "closing";
      ack["state"]["state"] = st;
    }
  }

  String ts = nowIso();
  if (ts.length()) ack["timestamp"] = ts;

  String serialized;
  serializeJson(ack, serialized);

  cachedCommandId[cacheNext] = commandId;
  cachedDeviceId[cacheNext]  = deviceId;
  cachedAck[cacheNext]       = serialized;
  cacheNext = (cacheNext + 1) % DEDUP_SIZE;

  bool ok = mqtt.publish(topicFor(deviceId, "ack"), serialized, /*retained=*/false, /*qos=*/1);
  Serial.printf("[CMD] %s -> %s | status=%s | ack=%s\n",
    commandId, deviceId, failureReason ? failureReason : "success", ok ? "ok" : "FAIL");
}

// ── Periodic Publishing ───────────────────────────────────────────────────────

void sendHeartbeat(const char *deviceId, bool online) {
  JsonDocument doc;
  doc["schemaVersion"] = 1;
  doc["deviceId"]      = deviceId;
  doc["online"]        = online;
  String ts = nowIso();
  if (ts.length()) doc["timestamp"] = ts;
  sendJson(topicFor(deviceId, "availability"), doc);
}

void sendSensorTelemetry() {
  String ts = nowIso();
  if (!ts.length()) return;

  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity)) humidity = 0;
  if (isnan(temperature)) temperature = 0;

  bool rain = isRaining();
  bool gas  = isGasDetected();
  bool fire = isFireDetected();

  // 1. Telemetry tổng hợp cho SENSOR_ID (DHT11 + toàn bộ cảm biến)
  JsonDocument doc;
  doc["schemaVersion"]       = 1;
  doc["messageId"]           = makeUuid();
  doc["deviceId"]            = SENSOR_ID;
  doc["timestamp"]           = ts;
  doc["data"]["temperature"] = temperature;
  doc["data"]["humidity"]    = humidity;
  doc["data"]["rain"]        = rain ? 1 : 0;
  doc["data"]["gas"]         = gas  ? 1 : 0;
  doc["data"]["fire"]        = fire ? 1 : 0;
  sendJson(topicFor(SENSOR_ID, "telemetry"), doc);

  // 2. Telemetry riêng cho GAS_ID (để thiết bị Cảm biến Gas MQ-2 trên App nhận được)
  if (validUuid(GAS_ID)) {
    JsonDocument gasDoc;
    gasDoc["schemaVersion"] = 1;
    gasDoc["messageId"]     = makeUuid();
    gasDoc["deviceId"]      = GAS_ID;
    gasDoc["timestamp"]     = ts;
    gasDoc["data"]["gas"]   = gas ? 1 : 0;
    sendJson(topicFor(GAS_ID, "telemetry"), gasDoc);
  }

  // 3. Telemetry riêng cho FIRE_ID (để thiết bị Cảm biến Lửa trên App nhận được)
  if (validUuid(FIRE_ID)) {
    JsonDocument fireDoc;
    fireDoc["schemaVersion"] = 1;
    fireDoc["messageId"]     = makeUuid();
    fireDoc["deviceId"]      = FIRE_ID;
    fireDoc["timestamp"]     = ts;
    fireDoc["data"]["fire"]  = fire ? 1 : 0;
    sendJson(topicFor(FIRE_ID, "telemetry"), fireDoc);
  }

  // 4. Telemetry riêng cho RAIN_ID (để thiết bị Cảm biến Mưa trên App nhận được)
  if (validUuid(RAIN_ID)) {
    JsonDocument rainDoc;
    rainDoc["schemaVersion"] = 1;
    rainDoc["messageId"]     = makeUuid();
    rainDoc["deviceId"]      = RAIN_ID;
    rainDoc["timestamp"]     = ts;
    rainDoc["data"]["rain"]  = rain ? 1 : 0;
    sendJson(topicFor(RAIN_ID, "telemetry"), rainDoc);
  }

  Serial.printf("[TELEMETRY] Temp: %.1fC | Hum: %.0f%% | Rain: %d (raw=%d) | Gas: %d (raw=%d) | Fire: %d (raw=%d)\n",
    temperature, humidity,
    rain ? 1 : 0, digitalRead(RAIN_PIN),
    gas  ? 1 : 0, digitalRead(MQ2_PIN),
    fire ? 1 : 0, digitalRead(FLAME_PIN));
}

// ── Interactive Serial Command Handler ────────────────────────────────────────

void handleSerialCommand() {
  if (!Serial.available()) return;
  char command = Serial.read();

  switch (command) {
    case '1': turnLedOn(); break;
    case '2': turnLedOff(); break;
    case '3': turnFanOn(); break;
    case '4': turnFanOff(); break;
    case '5': openDoor(); break;
    case '6': closeDoor(); break;
    case '7': autoMode = false; startClosingCover(); break;
    case '8': autoMode = false; startOpeningCover(); break;
    case '9': autoMode = false; stopMotor(); break;
    case 'A':
    case 'a':
      autoMode = true;
      Serial.println("\n[MODE] === AUTO MODE ON ===");
      break;
    case 'M':
    case 'm':
      autoMode = false;
      Serial.println("\n[MODE] === MANUAL MODE ON ===");
      break;
    case 'S':
    case 's': {
      float temp = dht.readTemperature();
      float hum  = dht.readHumidity();
      Serial.println("\n========== SENSOR STATUS ==========");
      Serial.printf("Temp: %.1f C | Hum: %.1f %%\n", temp, hum);
      Serial.printf("Rain (pin %d): %s (raw=%d)\n", RAIN_PIN, isRaining() ? "RAIN DETECTED!" : "NO RAIN", digitalRead(RAIN_PIN));
      Serial.printf("Fire (pin %d): %s (raw=%d)\n", FLAME_PIN, isFireDetected() ? "FIRE DETECTED!" : "NORMAL", digitalRead(FLAME_PIN));
      Serial.printf("MQ-2 (pin %d): %s (raw=%d)\n", MQ2_PIN, isGasDetected() ? "GAS/SMOKE DETECTED!" : "NORMAL", digitalRead(MQ2_PIN));
      Serial.printf("LED: %s | Fan: %s | Door: %s | Mode: %s\n",
        lightOn ? "ON" : "OFF", fanOn ? "ON" : "OFF",
        (doorAngle == DOOR_OPEN_ANGLE) ? "OPEN" : "CLOSED",
        autoMode ? "AUTO" : "MANUAL");
      Serial.println("===================================");
      break;
    }
    case 'G':
    case 'g': {
      manualGasSim = !manualGasSim;
      Serial.printf("\n[SIMULATION] Gas alert: %s\n", manualGasSim ? "TRIGGERED (GAS LEAK)" : "CLEARED (NORMAL)");
      if (manualGasSim) {
        turnFanOn();
        sendSensorTelemetry();
      }
      break;
    }
    case 'F':
    case 'f': {
      manualFireSim = !manualFireSim;
      Serial.printf("\n[SIMULATION] Fire alert: %s\n", manualFireSim ? "TRIGGERED (FIRE!)" : "CLEARED (NORMAL)");
      if (manualFireSim) {
        sendSensorTelemetry();
      }
      break;
    }
    default: break;
  }
}

// ── Setup & Loop ─────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("     SMART HOME ESP32-S3 FULL SYSTEM   ");
  Serial.println("========================================");

  // Motor pins
  pinMode(MOTOR_AIN1, OUTPUT);
  pinMode(MOTOR_AIN2, OUTPUT);
  pinMode(MOTOR_PWMA, OUTPUT);
  stopMotor();

  // Relay pins
  pinMode(RELAY_LED, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  turnLedOff();
  turnFanOff();

  // Sensor pins (PULLUP prevents floating pins from causing false alarms)
  pinMode(RAIN_PIN, INPUT_PULLUP);
  pinMode(FLAME_PIN, INPUT_PULLUP);
  pinMode(MQ2_PIN, INPUT_PULLUP);

  // Peripherals
  dht.begin();
  doorServo.attach(SERVO_PIN);
  closeDoor();

  // Validate configured UUIDs
  configured = validUuid(HOUSEHOLD_ID)
            && validUuid(SENSOR_ID)
            && validUuid(LIGHT_ID)
            && validUuid(FAN_ID)
            && validUuid(DOOR_ID)
            && validUuid(COVER_ID);

  if (!configured) {
    Serial.println("[BOOT] WARNING: Some UUIDs in config.h may be placeholder.");
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  configTime(0, 0, NTP_SERVER);

  mqtt.begin(MQTT_HOST, MQTT_PORT, network);
  mqtt.setOptions(15, true, 1000);
  mqtt.onMessage(receiveMessage);

  lastConnect = millis() - RECONNECT_INTERVAL_MS;
  Serial.println("[BOOT] Setup completed.");
}

void loop() {
  // 1. Serial commands
  handleSerialCommand();

  // 2. Non-blocking Motor update
  updateMotor();

  unsigned long now = millis();

  // 3. Automatic rule evaluation
  if (now - lastAutoLoop >= 3000) {
    lastAutoLoop = now;
    automaticSystem();
  }

  // 4. WiFi / MQTT connection
  if (WiFi.status() != WL_CONNECTED || !mqtt.connected()) {
    queueCount = queueRead = queueWrite = 0;
    if (now - lastConnect >= RECONNECT_INTERVAL_MS) {
      lastConnect = now;
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Reconnecting...");
        WiFi.reconnect();
      } else {
        Serial.println("[MQTT] Connecting...");
        String clientId = "esp32s3-" + WiFi.macAddress();
        clientId.replace(":", "");
        if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
          Serial.println("[MQTT] Connected.");
          mqtt.subscribe(topicFor(LIGHT_ID, "command"), 1);
          mqtt.subscribe(topicFor(FAN_ID,   "command"), 1);
          mqtt.subscribe(topicFor(DOOR_ID,  "command"), 1);
          mqtt.subscribe(topicFor(COVER_ID, "command"), 1);
          lastHeartbeat = now - HEARTBEAT_INTERVAL_MS;
        } else {
          Serial.println("[MQTT] Connection failed.");
        }
      }
    }
    delay(5);
    return;
  }

  // 5. MQTT loop
  mqtt.loop();

  // 6. Process message from queue
  if (queueCount > 0) {
    String topic   = queuedTopic[queueRead];
    String payload = queuedPayload[queueRead];
    queueRead  = (queueRead + 1) % QUEUE_SIZE;
    queueCount--;
    processCommand(topic, payload);
  }

  // 7. Periodic heartbeats
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat(LIGHT_ID, true);
    sendHeartbeat(FAN_ID,   true);
    sendHeartbeat(DOOR_ID,  true);
    sendHeartbeat(COVER_ID, true);
    sendHeartbeat(SENSOR_ID, true);
    sendHeartbeat(RAIN_ID,  true);
    sendHeartbeat(GAS_ID,   true);
    sendHeartbeat(FIRE_ID,  true);
  }

  // 8. Periodic telemetry
  if (now - lastSensor >= SENSOR_INTERVAL_MS) {
    lastSensor = now;
    sendSensorTelemetry();
  }

  delay(2);
}
