# esp32-smart-home — ESP32 Firmware

Firmware Arduino cho ESP32 kết nối hệ thống Smart Home qua MQTT.

---

## Phần cứng

| GPIO | Chức năng |
|------|-----------|
| 4    | DHT11 data (nhiệt độ / độ ẩm) |
| 2    | Đèn — relay hoặc MOSFET driver |
| 5    | Quạt — relay hoặc MOSFET driver (**xem cảnh báo bên dưới**) |
| 12   | Cửa — Servo motor (SG90/MG90S, tín hiệu góc 0°–180°) |

> ⚠️ **GPIO5 / quạt**: Không nối trực tiếp dây nguồn motor vào GPIO.
> Phải dùng relay module hoặc transistor driver. Chỉ bật `FAN_DRIVER_VERIFIED true`
> sau khi đã kiểm tra mạch an toàn.
>
> ⚠️ **GPIO12 / servo**: Nối chân tín hiệu (dây cam/vàng) vào GPIO12. Dây nguồn (đỏ) nối 3.3V hoặc 5V (VIN), dây mass (nâu/đen) nối GND.

---

## Cài đặt Arduino IDE

### 1. Thêm ESP32 board

*File → Preferences → Additional Boards Manager URLs*:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
*Tools → Board → Boards Manager* → tìm `esp32` (by Espressif) → Install.

### 2. Cài thư viện (Tools → Manage Libraries)

| Thư viện | Tác giả | Phiên bản |
|----------|---------|-----------|
| MQTT | Joel Gaehwiler | ≥ 2.5.2 |
| ArduinoJson | Benoit Blanchon | ≥ 7.x |
| DHT sensor library | Adafruit | ≥ 1.4.x |
| Adafruit Unified Sensor | Adafruit | ≥ 1.1.x |
| ESP32Servo | Kevin Harrington | ≥ 3.0.x |

### 3. Tạo config.h

```bash
cp config.example.h config.h
```

Điền vào `config.h`:

```cpp
// WiFi
#define WIFI_SSID     "Ten_wifi_nha_ban"
#define WIFI_PASSWORD "Mat_khau_wifi"

// MQTT broker — dùng LAN IP của máy chạy backend, KHÔNG dùng localhost
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
#define MQTT_USERNAME "device_user"
#define MQTT_PASSWORD "device_password"

// Lấy UUID từ database: GET /api/v1/households/:id/devices
#define HOUSEHOLD_ID "uuid-cua-household"
#define SENSOR_ID    "uuid-cua-sensor-device"
#define LIGHT_ID     "uuid-cua-light-device"
#define FAN_ID       "uuid-cua-fan-device"
```

### 4. Nạp firmware

- *Tools → Board* → chọn `ESP32 Dev Module` (hoặc board phù hợp)
- *Tools → Port* → chọn cổng COM của ESP32
- Nhấn **Upload** (Ctrl+U)

Mở *Serial Monitor* (115200 baud) để xem log.

---

## Giao thức MQTT

```
Topic root:  home/{householdId}/device/{deviceId}/

SUBSCRIBE: .../command       ← nhận lệnh từ backend
PUBLISH:   .../ack           ← xác nhận lệnh
PUBLISH:   .../telemetry     ← dữ liệu cảm biến (SENSOR_ID)
PUBLISH:   .../availability  ← heartbeat online/offline
```

### Command payload (backend → ESP32)
```json
{
  "schemaVersion": 1,
  "commandId": "uuid",
  "deviceId": "uuid",
  "action": "turn_on",
  "params": { "power": "on" },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

### ACK payload (ESP32 → backend)

**Thành công:**
```json
{
  "schemaVersion": 1,
  "messageId": "uuid",
  "commandId": "uuid",
  "deviceId": "uuid",
  "status": "success",
  "state": { "power": "on" },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

**Thất bại:**
```json
{
  "schemaVersion": 1,
  "messageId": "uuid",
  "commandId": "uuid",
  "deviceId": "uuid",
  "status": "failed",
  "error": "fan_wiring_not_verified",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

> **Lưu ý:** Backend validate nghiêm ngặt:
> - `schemaVersion` phải đúng bằng `1`
> - `deviceId` trong payload phải khớp với topic
> - Khi `status: "success"`, `state.power` bắt buộc là `"on"` hoặc `"off"`
> - Khi `status: "failed"`, `state` bị bỏ qua (backend không ghi DB)

### Telemetry payload (ESP32 → backend, mỗi 30s)
```json
{
  "schemaVersion": 1,
  "messageId": "uuid",
  "deviceId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "data": {
    "temperature": 28.5,
    "humidity": 65.0
  }
}
```

---

## Các tính năng firmware

| Tính năng | Chi tiết |
|-----------|---------|
| **QoS 1** | Tất cả command/ACK dùng QoS 1 (at-least-once) |
| **De-duplication** | Cache 16 ACK gần nhất; lệnh trùng commandId được replay ACK cũ thay vì thực thi lại |
| **Hàng đợi lệnh** | Command queue 8 slot; xử lý 1 lệnh/vòng loop để không block MQTT |
| **Reconnect tự động** | WiFi + MQTT reconnect mỗi 5s; flush queue khi mất kết nối |
| **NTP sync** | Không gửi telemetry/ACK cho đến khi có timestamp thực từ NTP |
| **Sensor validation** | Bỏ qua giá trị DHT11 ngoài range hợp lý (-40→80°C, 0→100% RH) |
| **GPIO safe init** | Output pin được set về "off" TRƯỚC khi enable OUTPUT mode |
| **Fan safety gate** | `FAN_DRIVER_VERIFIED false` → GPIO5 = INPUT; lệnh quạt trả failed |

---

## Log Serial (115200 baud)

```
[BOOT] Smart Home ESP32 firmware starting...
[BOOT] Fan GPIO held as INPUT (FAN_DRIVER_VERIFIED=false)
[BOOT] Config valid. Connecting to WiFi...
[BOOT] Setup done.
[WIFI] Connected: 192.168.1.42
[MQTT] Connected.
[MQTT] Subscribed to command topics.
[SENSOR] 28.5°C  65%RH
[CMD] 3f7a1b2c-... → <lightId> | status=success | published=ok
```
