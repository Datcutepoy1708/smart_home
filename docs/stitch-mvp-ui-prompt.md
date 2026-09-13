# Google Stitch Prompt — Smart Home MVP

Copy the prompt below into Google Stitch for the current MVP only.

---

Design a coherent Vietnamese mobile UI for a small Smart Home IoT MVP built
with React Native and Expo. Keep the interface calm, practical, accessible, and
easy to implement. Do not add social features, automation builders, advanced
analytics, household invitations, chatbot, or device provisioning flows.

## Design tokens

- Primary: #3B82F6
- Primary pressed: #2563EB
- Primary light: #DBEAFE
- Background: #F5F9FF
- Surface: #FFFFFF
- Border: #E2E8F0
- Text primary: #1E293B
- Text secondary: #64748B
- Text muted: #94A3B8
- Success: #22C55E
- Warning: #F59E0B
- Danger: #EF4444
- Danger background: #FEF2F2
- Danger border: #FCA5A5
- Danger title: #7F1D1D
- Danger secondary text: #B91C1C
- Offline background: #F1F5F9

Use blue for normal actions. Reserve red only for fire, gas, destructive
confirmation, and truly critical errors. Use a clean sans-serif typeface,
8-point spacing, 12–16 px card radius, clear focus states, and touch targets of
at least 44 x 44 px. Do not rely on color alone to communicate status. Avoid
decorative badges and unnecessary icons.

## Navigation

Use an authenticated bottom tab bar with three destinations:

1. Trang chủ
2. Thiết bị
3. Cảnh báo

Put Cài đặt behind the profile button in the top-right corner. Authentication
screens are outside the tab navigator.

## Generate these screens

### 1. Welcome

- App name and a simple smart-home illustration.
- Primary button: Đăng nhập.
- Secondary text button: Tạo tài khoản.

### 2. Login

- Email and password fields with visible labels.
- Primary button: Đăng nhập.
- Link to registration.
- Designs for validation, wrong credentials, offline, loading, and keyboard
  states.

### 3. Registration

- Full name, email, password, confirm password, and home name.
- Password guidance and inline validation.
- Primary button: Tạo tài khoản.

### 4. Home dashboard

- Greeting and home name.
- One prominent latest-environment card with temperature, humidity, update
  time, and data freshness.
- Compact online-device summary.
- Two quick-control cards for light and fan with clear on/off text and switches.
- Critical alert banner only when an active fire or gas alert exists.
- Loading, no-device, stale-data, offline, and API-error variants.

### 5. Devices

- Simple list grouped by room.
- Each row shows device name, type, explicit Online/Offline text, last seen, and
  current value or on/off state.
- Filters are limited to Tất cả, Đang online, and Offline.

### 6. Sensor details

- Device name and room.
- Current temperature and humidity.
- Online/offline and last seen.
- A compact recent-readings list; do not create advanced charts in the MVP.

### 7. Light/fan control

- Device name, room, connectivity, and confirmed current state.
- Large on/off control.
- Visible sending, confirmed, failed, timeout, and offline states.
- Disable control while offline and explain why in text.

### 8. Alert list

- Fire and gas alerts ordered newest first.
- Show severity in words, source device, room, time, and read status.
- Empty and offline states.

### 9. Alert details

- High-contrast critical header using the danger palette.
- Alert type, room, device, detected time, and measured value when available.
- Primary safe action: Đã xem.
- Never use red for unrelated actions on this screen.

### 10. Settings

- User name and email.
- Notification permission status with an action to open system settings.
- API/app version information.
- Logout action with confirmation.

## Shared components and behavior

Create reusable visual patterns for text fields, buttons, device rows,
telemetry cards, alert banners, retry panels, loading skeletons, and
confirmation dialogs. Include light-theme designs only. Use realistic
Vietnamese labels and values. Keep layouts feasible for a typical Android
phone and responsive to small screens.

For every network-backed screen, generate loading, empty, success, offline, and
error states. FCM notification tapping should navigate directly to Alert
details. Live telemetry should update in place without using push
notifications; FCM is reserved for critical fire/gas alerts.

Output a connected screen flow and a small component/token reference suitable
for direct React Native implementation.
