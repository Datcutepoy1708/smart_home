# Google Stitch Master Prompt — Smart Home Mobile App

> Future full-scope reference. Do not use this prompt for the current MVP.
> Use `docs/stitch-mvp-ui-prompt.md` until the MVP Definition of Done passes.

Copy the prompt below into Google Stitch. If Stitch cannot generate every screen
in one run, keep the **Global design system**, **Navigation**, and **Shared
components** sections unchanged, then generate the screen batches in order.

---

## Master prompt

Design a complete, production-ready mobile UI/UX for a Vietnamese Smart Home IoT
application. The application will be implemented with React Native, TypeScript,
Expo Router, NestJS, PostgreSQL, MQTT, WebSocket, and Firebase Cloud Messaging.

Generate a coherent multi-screen mobile product, not isolated concept screens.
All screens must share the same design tokens, components, navigation patterns,
spacing, typography, states, and interaction behavior.

### Product purpose

The app allows users to:

- Register, sign in, and manage their account.
- Create and switch between households.
- Add and provision IoT devices.
- View temperature, humidity, gas, fire, and device connectivity data.
- Control lights, fans, and door servos.
- Review alerts and push notifications.
- Create schedules, IF-THEN rules, and scenes.
- Review activity history and household statistics.
- Manage household members and permissions.
- Link Telegram or Zalo.
- Review suggested automations based on repeated habits.

### Target device and output

- Design primarily for a 390 × 844 px mobile viewport.
- Respect iOS and Android safe areas.
- Use an 8-point spacing system.
- Make layouts directly implementable with React Native and Expo Router.
- Do not use desktop sidebars, hover-only interactions, or web-style tables on
  primary mobile screens.
- Generate reusable components and consistent variants rather than redrawing
  components differently on every screen.
- UI language must be Vietnamese with natural, concise copy.
- Component, layer, and design-token names should be in English.

## Global design system

### Color tokens

Use these exact colors consistently:

```text
primary          #3B82F6
primaryDark      #2563EB
primaryLight     #DBEAFE
primaryLighter   #93C5FD

background       #F5F9FF
surface          #FFFFFF
border           #E2E8F0

textPrimary      #1E293B
textSecondary    #64748B
textMuted        #94A3B8

success          #22C55E
warning          #F59E0B
danger           #EF4444
dangerBg         #FEF2F2
dangerBorder     #FCA5A5
dangerTextDark   #7F1D1D
dangerTextMid    #B91C1C
offline          #94A3B8
offlineBg        #F1F5F9
```

Color rules:

- Blue `primary` is for normal daily actions, selected navigation, active
  controls, links, and primary buttons.
- Red `danger` is reserved for fire, gas leaks, destructive confirmations, and
  truly critical failures. Never use red for ordinary off states.
- Green `success` means online, successfully completed, safe, or active when
  that state is positive.
- Amber `warning` means an unusual measurement or a situation requiring
  attention but not immediate danger.
- Gray `offline` means disconnected, disabled, unavailable, or powered off.
- Cards use white `surface` on the soft blue `background`.
- Keep body text at accessible contrast. Never place muted gray text on a light
  blue background when contrast is insufficient.
- Do not introduce purple, neon, multicolor gradients, glassmorphism, or an
  unrelated secondary brand color.

### Typography

- Use Inter or a visually equivalent modern sans-serif.
- Display title: 28 px, 700 weight, 34 px line height.
- Screen title: 24 px, 700 weight, 30 px line height.
- Section title: 18 px, 700 weight, 24 px line height.
- Card title: 16 px, 600 weight, 22 px line height.
- Body: 15–16 px, 400 weight, 22–24 px line height.
- Label: 13–14 px, 500–600 weight.
- Caption: 12 px, 400–500 weight.
- Numeric sensor values may use 28–36 px, 700 weight with tabular numerals.
- Do not use all caps except very short technical labels.

### Shape, spacing, and elevation

- Page horizontal padding: 20 px.
- Vertical section spacing: 24 px.
- Card internal padding: 16 px.
- Small gap: 8 px; normal gap: 12 px; large gap: 16–24 px.
- Main card radius: 16 px.
- Input and button radius: 12 px.
- Bottom sheet top radius: 24 px.
- Use a subtle 1 px border with `border` for most cards.
- Use very soft shadows only for elevated modals, bottom sheets, floating action
  buttons, and the bottom navigation bar.
- Do not make every card float with a heavy shadow.

### Iconography

- Use minimal, monochrome, functional outline icons from one consistent family.
- Functional icons are allowed for navigation, search, notifications, password
  visibility, edit, filter, device type, back, close, add, and overflow actions.
- Do not use emoji, colorful illustration icons, decorative trust badges, or
  icon-plus-marketing chips.
- Do not communicate status by color alone; pair it with a short text label or
  accessible shape.

### Buttons and controls

- Primary button: solid `primary`, white label, height 50–52 px.
- Pressed primary: `primaryDark`.
- Secondary button: white surface, blue label, 1 px blue border.
- Tertiary action: text-only blue action.
- Destructive button: red only inside an explicit dangerous flow.
- Disabled button: `offlineBg` with `textMuted`.
- Toggles: blue when on, neutral gray when off. Do not use red for off.
- Minimum touch target: 44 × 44 px.
- Form inputs include visible labels above the input, not placeholder-only
  labels.
- Validation text appears beneath the field and should not shift unrelated
  content unexpectedly.

## Navigation model

Use Expo Router-compatible navigation.

Unauthenticated stack:

```text
Splash
Welcome
Login
Register
Forgot password
OTP verification
```

Authenticated bottom navigation with five destinations:

```text
Home
Devices
Automation
Activity
Settings
```

Use labels beneath icons. Active tab uses `primary`; inactive tabs use
`textMuted`. Alerts are opened from a functional notification bell in the Home
header. Secondary screens use a standard top app bar with a back button and
screen title.

The current household selector appears in the Home header and in relevant list
screens. Tapping it opens a bottom sheet for switching or adding a household.

## Shared components

Create reusable variants for:

1. Top app bar with back, title, and optional right action.
2. Household selector.
3. Bottom navigation bar.
4. Primary, secondary, tertiary, and destructive buttons.
5. Text input, password input, dropdown, numeric input, time picker, day picker,
   and search field.
6. Device card with type, room, state, online/offline label, and quick control.
7. Sensor metric card for temperature, humidity, gas, and connectivity.
8. Alert banner and alert list item with Info/Warning/Critical variants.
9. Schedule, rule, and scene list cards.
10. Member row with avatar initials and role.
11. Empty state, skeleton loading state, inline retry state, full-page error, and
    offline banner.
12. Confirmation dialog and bottom sheet.
13. Toast for successful non-critical actions.
14. Chart container with range selector.
15. Pending-command indicator that is visually different from success.

Avoid decorative badges. Small pills are allowed only when they communicate a
real status or filter value, such as “Đang hoạt động”, “Ngoại tuyến”, “Chủ nhà”,
or “Nghiêm trọng”.

## Screen specifications

### 1. Splash screen

- Center the product wordmark “Smart Home” using the brand blue.
- Add the short line “Ngôi nhà trong tầm tay”.
- Use a clean light background, no marketing badges and no complex illustration.
- Include a restrained loading indicator near the bottom.

### 2. Welcome screen

- Headline: “Quản lý ngôi nhà dễ dàng hơn”.
- Supporting copy: “Theo dõi, điều khiển và nhận cảnh báo từ mọi thiết bị trong
  nhà.”
- Show one simple line-art house/device illustration using blue and neutral
  colors only.
- Primary action: “Đăng nhập”.
- Secondary action: “Tạo tài khoản”.
- Footer links: “Điều khoản sử dụng” and “Chính sách bảo mật”.

### 3. Login screen

- Top back button and title “Đăng nhập”.
- Inputs: “Email”, “Mật khẩu” with show/hide action.
- Right-aligned link: “Quên mật khẩu?”.
- Primary button: “Đăng nhập”.
- Divider with “hoặc”.
- Secondary Google action: “Tiếp tục với Google”.
- Bottom prompt: “Chưa có tài khoản? Đăng ký”.
- Include variants for empty fields, invalid credentials, network error,
  loading button, and disabled submit.
- Generic invalid credential message: “Email hoặc mật khẩu không đúng.”

### 4. Registration screen

- Title “Tạo tài khoản”.
- Inputs: “Họ và tên”, “Email”, “Mật khẩu”, “Xác nhận mật khẩu”, and “Tên ngôi
  nhà”.
- Password requirements are concise and shown progressively.
- Checkbox text accepting terms and privacy policy.
- Primary action: “Tạo tài khoản”.
- Bottom link: “Đã có tài khoản? Đăng nhập”.
- Include duplicate-email and validation variants.

### 5. Forgot password and OTP verification

Forgot-password screen:

- Email input and action “Gửi mã xác nhận”.
- Explain that a time-limited code will be sent.

OTP screen:

- Title “Nhập mã xác nhận”.
- Six accessible code cells.
- Masked destination copy.
- Countdown and “Gửi lại mã”.
- Primary action “Xác nhận”.
- Include invalid, expired, loading, and resend-success states.

### 6. Home dashboard

- Header greets the user: “Chào buổi sáng, An”.
- Household selector directly below or within the header.
- Notification bell with unread count, using red only if unread items include a
  critical fire/gas alert; otherwise use blue.
- If a critical alert exists, place a prominent `dangerBg` banner first:
  “Cảnh báo rò rỉ khí gas” with room, time, and “Xem chi tiết”.
- Overview row: number of online devices, total devices, and active automations.
- Sensor overview cards for temperature and humidity with current values and
  subtle trend text.
- “Điều khiển nhanh” section with 2-column device cards for commonly used lights,
  fan, and door.
- “Kịch bản” horizontal row with plain scene cards such as “Đi ngủ”, “Ra khỏi
  nhà”, and “Buổi sáng”.
- “Hoạt động gần đây” list with three events and “Xem tất cả”.
- Include normal, critical-alert, empty-household, loading, and offline variants.

### 7. Household switcher bottom sheet

- Title “Chọn ngôi nhà”.
- List households with current selection checkmark and role text.
- Actions: “Thêm ngôi nhà” and “Quản lý ngôi nhà”.
- Show guest expiration when relevant.

### 8. Device list

- Title “Thiết bị”.
- Household selector, search input, room filter, type filter, and online-state
  filter.
- Optional segmented layout switch between “Theo phòng” and “Tất cả”.
- Device cards show device name, room, type, online/offline text, current state,
  and one safe quick action.
- Floating add button is visible only for Owner.
- Include empty state: “Chưa có thiết bị” with action “Thêm thiết bị đầu tiên”.
- Include filtered-empty, loading, offline, and permission variants.

### 9. Add/provision device flow

Use a clear 3-step flow with a textual step indicator, not decorative badges.

Step 1 — Device information:

- Inputs for hardware UID, device name, device type, and room.
- Device types: light, fan, door servo, temperature/humidity sensor, gas sensor,
  and fire sensor.
- Primary action “Tiếp tục”.

Step 2 — Review:

- Summary card with all entered values.
- Explain that an MQTT credential will be generated once.
- Primary action “Tạo thiết bị”.

Step 3 — One-time credential:

- Success heading “Thiết bị đã được tạo”.
- Show broker URL, username, password, and topic root in secure copy fields.
- Strong warning: “Mật khẩu chỉ hiển thị một lần. Hãy lưu vào thiết bị trước
  khi rời màn hình này.”
- Functional copy buttons per field.
- Confirmation checkbox “Tôi đã lưu thông tin”.
- Final action “Hoàn tất”.
- Do not persist the password visually after leaving this screen.

Include duplicate UID, API error, and unauthorized variants.

### 10. Device detail — common layout

- Top app bar with device name and overflow menu.
- Online/offline label with last-seen time.
- Room and device type below the title.
- Main control or primary metric based on device type.
- Sections: “Trạng thái hiện tại”, “Dữ liệu gần đây”, “Lịch và tự động hóa”, and
  “Thông tin thiết bị”.
- Actions in overflow: rename, change room, rotate credential, firmware info,
  and remove device.
- Removing a device requires a destructive confirmation dialog.

### 11. Light control screen

- Large power control with text “Đang bật” or “Đang tắt”.
- Brightness slider from 0–100% when supported.
- Optional color-temperature slider only if supported; mark unavailable controls
  clearly rather than hiding failures.
- Show command state “Đang gửi lệnh…” before confirmed success.
- Show timeout with retry action.
- Never use red for the normal off state.

### 12. Fan control screen

- Power control and confirmed state.
- Speed selector: “Thấp”, “Vừa”, “Cao”.
- Current room temperature beneath the main control.
- Pending, success, timeout, offline, and unsupported-speed variants.

### 13. Door control screen

- Large current-state text: “Đã đóng”, “Đang mở”, “Đang di chuyển”, or “Không
  xác định”.
- Main action changes contextually between “Mở cửa” and “Đóng cửa”.
- Require a confirmation bottom sheet before opening remotely.
- Show last action, actor, and time.
- Use warning for unknown state and danger only for a genuine security/critical
  event, not simply because the door is open.

### 14. Sensor detail and chart screen

- Device title, room, and online state.
- Large current temperature and humidity values.
- Range selector: “1 giờ”, “24 giờ”, “7 ngày”, “30 ngày”.
- Accessible line chart with blue temperature line and a distinct non-danger
  neutral/green humidity line.
- Tooltip shows timestamp, value, and unit.
- Summary cards: minimum, maximum, average, and latest reading.
- Threshold section with warning limits.
- Gas/fire sensors use red only after crossing a critical threshold.
- Include no-data, partial-data, loading, stale-data, and offline states.

### 15. Alerts and notifications list

- Title “Cảnh báo”.
- Filter tabs: “Tất cả”, “Chưa đọc”, “Nghiêm trọng”.
- Items include severity, title, room/device, timestamp, read state, and a short
  description.
- Critical fire/gas items use `dangerBg`, `dangerBorder`, and dark red text.
- Warning items use restrained amber accents.
- Info and normal offline notices use blue/neutral colors.
- Swipe actions may mark read; do not use swipe-to-delete for critical alerts.
- Include “Đánh dấu tất cả đã đọc”.
- Empty state: “Không có cảnh báo mới”.

### 16. Alert detail

- Severity header with title, device, room, occurrence time, and status.
- Show current measurement and configured threshold.
- Timeline: detected, notification sent, acknowledged.
- Primary action for critical alerts: “Tôi đã kiểm tra”.
- Secondary actions: “Xem thiết bị” and “Gọi người thân” if configured.
- Acknowledgement is not the same as resolving the physical problem; explain
  this clearly.
- Use red prominently only on this critical flow.

### 17. Automation hub

- Title “Tự động hóa”.
- Three clear sections or top tabs: “Lịch”, “Quy tắc”, “Kịch bản”.
- Summary text for active items.
- Primary add action opens a bottom sheet: “Tạo lịch”, “Tạo quy tắc”, or “Tạo
  kịch bản”.
- Include disabled items, empty states, and conflicting-automation warning.

### 18. Schedule list and editor

Schedule list card:

- Time as the visual anchor.
- Device, action, repeat days, timezone, and active toggle.
- Example: “18:00 — Bật đèn phòng khách — T2–CN”.

Schedule editor:

- Fields: name, device, action, time, repeat days, timezone, and active state.
- Use a seven-day selector with Vietnamese abbreviations.
- Show a human-readable next-run preview.
- Primary action “Lưu lịch”.
- Include invalid selection and duplicate/conflict warning states.

### 19. Rule list and IF-THEN editor

Rule list card:

- Name, concise IF/THEN sentence, priority, last triggered time, and active
  toggle.
- Example: “Nếu nhiệt độ lớn hơn 30°C, bật quạt phòng khách”.

Rule editor:

- Section “Nếu” with sensor/device, metric, operator, threshold, and optional
  duration.
- Section “Thì” with target device and action.
- Advanced collapsed section for priority and cooldown.
- Show a natural-language preview before saving.
- Warn about possible loops or conflicts without using red unless saving would
  be unsafe.
- Primary action “Lưu quy tắc”.

### 20. Scene list, editor, and run result

Scene list:

- Simple cards with name, number of actions, last run, and “Chạy” button.
- Examples: “Đi ngủ”, “Ra khỏi nhà”, “Buổi sáng”.

Scene editor:

- Scene name and optional functional monochrome icon.
- Ordered action list with drag handles.
- Add-action button selects device and action.
- Primary action “Lưu kịch bản”.

Run result bottom sheet:

- Show pending and final result for every device action.
- Clearly represent complete success, partial failure, and timeout.
- Do not report overall success when one action failed.

### 21. Activity history

- Title “Lịch sử hoạt động”.
- Filters for date range, device, action, and source.
- Timeline list grouped by date.
- Each row shows action, device, actor or automation source, exact time, and
  result.
- Sources include app, schedule, rule, scene, chatbot, and voice.
- Include pagination/loading-more and empty filter state.

### 22. Statistics dashboard

- Title “Thống kê”.
- Period selector: week/month/custom.
- Summary cards for device actions, active time, alerts, and online reliability.
- Bar chart comparing this week with last week.
- Device usage ranking list.
- Sensor trend section.
- If energy sensors are unavailable, show a clear unavailable state rather than
  fabricated energy data.
- Charts must include labels and values, not depend on color alone.

### 23. Household members

- Title “Thành viên”.
- Owner section and other members list.
- Each row shows initials/avatar, name, email, role, and guest expiration.
- Owner-only “Mời thành viên” action.
- Member overflow actions: change role, update guest expiration, remove.
- The final Owner cannot leave or downgrade; show an explanatory disabled state.

Invite member screen:

- Email input, role selector, and optional guest expiration date.
- Plain-language permission summary that updates with selected role.
- Primary action “Gửi lời mời”.

### 24. Automation suggestions

- Title “Gợi ý tự động hóa”.
- Suggestion card explains the detected pattern in plain language:
  “Bạn thường bật đèn phòng khách lúc 18:05.”
- Show confidence as text and a restrained progress bar, not a decorative score
  badge.
- Actions: “Tạo lịch”, “Bỏ qua”, and “Xem dữ liệu”.
- Confirmation screen lets the user edit the proposed time/action before saving.
- Never activate an automation without explicit user confirmation.

### 25. Chatbot connections

- Title “Kết nối chatbot”.
- Telegram and Zalo connection rows with connection status and description.
- Primary action per provider: “Kết nối”.
- Explain supported commands such as `/nhietdo` and `/trangthai` in plain text.
- Connected state shows account identifier, last activity, and “Ngắt kết nối”.
- Disconnect requires confirmation.

### 26. Settings and profile

- Header with user initials/avatar, name, and email.
- Sections:
  - “Tài khoản”: personal information, change password, linked login methods.
  - “Ngôi nhà”: household settings and members.
  - “Thông báo”: alert severity preferences and system permission status.
  - “Tích hợp”: chatbot connections.
  - “Ứng dụng”: language, theme placeholder, privacy, app version.
- Logout is a neutral outlined action near the bottom, not red.
- Delete account is inside a separate destructive confirmation flow.

### 27. Notification preferences

- Master push-notification switch.
- Separate switches for fire, gas, device offline, unusual temperature/humidity,
  automation results, and suggestions.
- Fire and gas critical notifications cannot be visually confused with optional
  marketing/preferences.
- Show OS permission state and action “Mở cài đặt” when permission is denied.

### 28. Device credential rotation

- Explain why credential rotation disconnects the device.
- Require Owner confirmation.
- After rotation, show the new password once using the same secure-copy pattern
  as provisioning.
- Clearly state that the previous credential is immediately invalid.
- Use red only for the warning that the old device connection will stop, not for
  ordinary labels.

### 29. Global state screens

Generate reusable full-screen and embedded states:

- Skeleton loading for Home, Devices, Alerts, and Activity.
- Empty household with action to create/add the first device.
- No search results.
- No telemetry for selected period.
- API unavailable with “Thử lại”.
- Device offline with last-seen time.
- Internet offline banner that does not obscure navigation.
- Session expired screen returning to login.
- Permission denied screen for notification permission.
- Forbidden screen for insufficient household role.
- Generic 404/not-found screen.

## Interaction and behavior requirements

- Every command sent to a physical device visibly transitions through pending,
  confirmed, failed, or timed-out states.
- Never show success immediately after tapping a control unless device
  acknowledgement has arrived.
- Use pull-to-refresh on Home, Devices, Alerts, and Activity.
- Use bottom sheets for filters, household selection, and short confirmations.
- Use full screens for complex forms.
- Preserve entered form values after recoverable network failures.
- Confirm destructive actions and describe their consequences.
- Do not show internal IDs except hardware UID and one-time provisioning values
  where technically necessary.
- Dates and times use Vietnamese formatting and the household timezone.
- Use clear accessibility labels, sufficient contrast, scalable text, and touch
  targets of at least 44 px.

## Content examples

Use realistic Vietnamese data:

```text
User: Nguyễn Minh An
Household: Nhà của An
Rooms: Phòng khách, Phòng ngủ, Nhà bếp, Ban công
Devices: Đèn phòng khách, Quạt phòng ngủ, Cảm biến bếp, Cửa chính
Temperature: 28,4°C
Humidity: 67%
Gas: 120 ppm
Recent event: Nguyễn Minh An đã bật đèn phòng khách lúc 18:42
Rule: Nếu nhiệt độ lớn hơn 30°C, bật quạt phòng khách
Schedule: Bật đèn phòng khách lúc 18:00, từ Thứ Hai đến Chủ Nhật
Critical alert: Phát hiện nồng độ khí gas cao tại Nhà bếp
```

Do not use lorem ipsum or unrealistic perfect metrics.

## Final output requirements

- Produce all screens as one consistent mobile design system.
- Show the most important normal and edge-state variants.
- Include a component sheet with tokens and reusable components.
- Include a navigation-flow overview connecting authentication, main tabs,
  device flows, alerts, automation, household management, and settings.
- Keep the visual language calm, trustworthy, practical, and suitable for daily
  home control.
- Avoid excessive gradients, oversized empty whitespace, glassmorphism, floating
  decorative shapes, emoji, promotional trust badges, and colorful status chips.
- Preserve the rule: blue for normal actions; red exclusively for fire, gas,
  destructive confirmations, and genuine critical failures.

---

## Recommended Stitch generation batches

If Stitch limits the number of screens per generation, reuse the entire global
design-system section and generate these batches:

1. Authentication: screens 1–5.
2. Home and devices: screens 6–14.
3. Alerts and automation: screens 15–20.
4. History, statistics, and household: screens 21–24.
5. Integrations, settings, and system states: screens 25–29.

At the beginning of every follow-up prompt, add:

```text
Continue the same Smart Home project. Reuse the exact color tokens, typography,
spacing, components, bottom navigation, and Vietnamese content style from the
previous generation. Do not redesign the visual system.
```
