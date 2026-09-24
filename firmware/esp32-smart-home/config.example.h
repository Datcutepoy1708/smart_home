#pragma once
/*
 * config.h — Device configuration for esp32-smart-home firmware.
 *
 * SETUP:
 *   1. Copy this file:  cp config.example.h config.h
 *   2. Fill in your values below.
 *   3. config.h is in .gitignore — never commit credentials.
 *
 * WHERE TO FIND THE UUIDs:
 *   Run the backend API and check the database, or call:
 *     GET /api/v1/households/:id/devices
 *   Each device returned has an "id" field — that is the UUID to paste here.
 *   SENSOR_ID, LIGHT_ID and FAN_ID must all be different UUIDs.
 */

// ── WiFi ──────────────────────────────────────────────────────────────────────
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ── MQTT broker ───────────────────────────────────────────────────────────────
// Use the LAN IP of the machine running the backend (not localhost).
// Example: "192.168.1.10"
#define MQTT_HOST     "YOUR_SERVER_LAN_IP"
#define MQTT_PORT     1883
// Credentials for the IoT device user on the MQTT broker.
// Create a dedicated broker account with publish/subscribe rights only on:
//   home/<HOUSEHOLD_ID>/device/+/ack
//   home/<HOUSEHOLD_ID>/device/+/telemetry
//   home/<HOUSEHOLD_ID>/device/+/availability
// and subscribe rights on:
//   home/<HOUSEHOLD_ID>/device/+/command
#define MQTT_USERNAME "YOUR_DEVICE_MQTT_USER"
#define MQTT_PASSWORD "YOUR_DEVICE_MQTT_PASSWORD"

// Topic root — must match MQTT_TOPIC_ROOT in the backend .env
#define MQTT_ROOT "home"

// ── Database device IDs ───────────────────────────────────────────────────────
// Paste the UUID exactly as stored in the Device table.
// All three must be distinct.
#define HOUSEHOLD_ID "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#define SENSOR_ID    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   // DHT11 sensor
#define LIGHT_ID     "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   // Light (GPIO2)
#define FAN_ID       "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   // Fan   (GPIO5)
#define DOOR_ID      "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   // Door  (GPIO12)

// ── Pins ──────────────────────────────────────────────────────────────────────
#define SERVO_PIN    12

// ── NTP ───────────────────────────────────────────────────────────────────────
#define NTP_SERVER "pool.ntp.org"

// ── Hardware polarity ────────────────────────────────────────────────────────
// true  = relay/MOSFET is active HIGH (HIGH = device ON)
// false = relay module with built-in inverter (LOW = device ON)
#define LIGHT_ACTIVE_HIGH true
#define FAN_ACTIVE_HIGH   true

// ── Fan safety gate ──────────────────────────────────────────────────────────
// IMPORTANT: Set to true ONLY after you have verified that GPIO5 drives a
// proper transistor or relay module, NOT the fan power wire directly.
// Driving a motor directly from a GPIO pin will damage the ESP32.
// While false, the fan GPIO is held as INPUT and fan commands return
// status:"failed" with error:"fan_wiring_not_verified".
#define FAN_DRIVER_VERIFIED false

// ── Timing ───────────────────────────────────────────────────────────────────
#define SENSOR_INTERVAL_MS    30000UL   // DHT11 telemetry every 30 s
#define HEARTBEAT_INTERVAL_MS 10000UL   // availability ping every 10 s
#define RECONNECT_INTERVAL_MS  5000UL   // retry connect every 5 s
