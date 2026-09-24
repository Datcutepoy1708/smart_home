import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useSession } from "../../core/session-provider";
import { styles as s } from "../../shared/components/screen-styles";
import { color, font, radius, spacing } from "../../shared/theme";
import { parseDevices, type Device } from "./device-data";
import { ApiError } from "../../core/api-client";
import { isRecord } from "../../core/session";
import { SensorHistoryChart } from "./sensor-history-chart";
import { CountdownTimerCard } from "../timers/countdown-timer-card";


/**
 * Device Detail Screen — s4.png reference.
 *
 * Real data: device.name, device.room, device.isOnline, device.lastSeenAt,
 *            readings (temperature, humidity).
 *
 * Deferred / hidden (not in Sprint 1 API):
 *   - Battery percentage
 *   - Response time (8ms)
 *   - Historical chart
 *   - 24h statistics (min/max/avg)
 *   - Safety threshold toggles
 *   - CSV export
 *   - Signal check
 *   - Trend indicators (+0.5°C / 1h, "Dễ chịu")
 */

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Chưa có dữ liệu";
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

function parseDevice(value: unknown): Device | null {
  // Re-use the list parser on a single-item wrapper
  try {
    const result = parseDevices({ items: [value], nextCursor: null });
    return result.items[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchDevice(
  session: { get: (path: string) => Promise<unknown> },
  householdId: string,
  deviceId: string
): Promise<Device> {
  const raw = await session.get(
    `/households/${householdId}/devices/${deviceId}`
  );
  const device = parseDevice(raw);
  if (!device) throw new ApiError("Dữ liệu thiết bị không hợp lệ.");
  return device;
}

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const topPadding = Math.max(insets.top, statusBarHeight, spacing.md) + (Platform.OS === "android" ? 6 : 0);

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const householdId = session.identity?.households[0]?.id;

  const load = useCallback(async () => {
    if (!householdId || !id) {
      setError("Không tìm thấy thiết bị.");
      setLoading(false);
      return;
    }
    const req = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const d = await fetchDevice(session, householdId, id);
      if (req !== generation.current) return;
      setDevice(d);
    } catch (e: unknown) {
      if (req !== generation.current) return;
      const status = e instanceof ApiError ? e.status : undefined;
      // If access is lost (403) or device no longer exists (404), clear cached device data
      if (status === 403 || status === 404) {
        setDevice(null);
      }
      setError(
        e instanceof Error ? e.message : "Không thể tải thông tin thiết bị."
      );
    } finally {
      if (req !== generation.current) return;
      setLoading(false);
    }
  }, [session, householdId, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        ++generation.current;
      };
    }, [load])
  );

  const temp = device?.readings.find((r) => r.metric === "temperature");
  const humid = device?.readings.find((r) => r.metric === "humidity");

  return (
    <SafeAreaView style={s.screen}>
      {/* Top bar with back button */}
      <View
        style={[
          s.header,
          { paddingTop: topPadding },
        ]}
      >
        <View style={s.rowStart}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={color.textPrimary}
            />
          </Pressable>
          <Ionicons name="home-outline" size={18} color={color.primary} />
          <Text style={s.headerTitle} numberOfLines={1}>
            {device ? `Chi Tiết ${device.name}` : "Chi Tiết Thiết Bị"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { gap: spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={color.primary}
          />
        }
      >
        {/* Loading */}
        {loading && !device ? (
          <View style={s.emptyState}>
            <ActivityIndicator
              accessibilityLabel="Đang tải thiết bị"
              color={color.primary}
            />
          </View>
        ) : null}

        {/* Error when no device loaded */}
        {error && !device ? (
          <View style={s.cardAlert}>
            <Text accessibilityRole="alert" style={[font.body, { color: color.error }]}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" style={s.buttonOutline} onPress={load}>
              <Text style={s.buttonOutlineText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Error banner when refreshing failed with stale device data */}
        {error && device ? (
          <View style={[s.cardAlert, { borderColor: color.error, backgroundColor: color.errorBackground }]}>
            <View style={s.rowStart}>
              <Ionicons name="alert-circle-outline" size={18} color={color.error} />
              <Text accessibilityRole="alert" style={[font.caption, { color: color.error, flex: 1 }]}>
                Không thể làm mới: {error} (Dữ liệu hiển thị có thể đã cũ)
              </Text>
            </View>
            <Pressable accessibilityRole="button" style={[s.buttonOutline, { alignSelf: "flex-start", paddingVertical: 4 }]} onPress={load}>
              <Text style={[s.buttonOutlineText, { fontSize: 12 }]}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {device ? (
          <>
            {/* Device header info */}
            <View style={s.card}>
              <View style={s.rowStart}>
                <Ionicons
                  name="grid-outline"
                  size={18}
                  color={color.textSecondary}
                />
                <Text style={font.body} numberOfLines={1}>
                  {device.room
                    ? `${device.room} • ${device.name}`
                    : device.name}
                </Text>
              </View>

              {/* Online status — when refresh fails with stale data, display "Không rõ" status */}
              <View style={s.rowGap}>
                {error ? (
                  <View style={s.pillOffline}>
                    <Text style={s.pillOfflineText}>Không rõ (Lỗi kết nối)</Text>
                  </View>
                ) : device.isOnline ? (
                  <View style={s.pillOnline}>
                    <Text style={s.pillOnlineText}>Trực tuyến (Online)</Text>
                  </View>
                ) : (
                  <View style={s.pillOffline}>
                    <Text style={s.pillOfflineText}>Ngoại tuyến</Text>
                  </View>
                )}
                {device.lastSeenAt ? (
                  <Text style={font.caption}>
                    Cập nhật {formatLastSeen(device.lastSeenAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Power control card for controllable devices (LIGHT, FAN) */}
            {(device.deviceType === "light" || device.deviceType === "fan") && (
              <DevicePowerCard device={device} onRefresh={load} />
            )}

            {/* Door angle & position control card for DOOR_SERVO */}
            {(device.deviceType === "door" || device.deviceType === "door_servo") && (
              <DoorAngleControlCard device={device} onRefresh={load} />
            )}

            {/* Countdown auto-off / auto-close timer card */}
            {householdId &&
              (device.deviceType === "light" ||
                device.deviceType === "fan" ||
                device.deviceType === "door" ||
                device.deviceType === "door_servo") && (
                <CountdownTimerCard
                  session={session}
                  householdId={householdId}
                  device={device}
                />
              )}

            {/* Metric cards — temperature and humidity */}
            <View style={[s.rowGap, { gap: spacing.lg }]}>
              {/* Temperature */}
              <View
                style={[
                  s.card,
                  { flex: 1, alignItems: "flex-start" },
                ]}
              >
                <View style={s.rowStart}>
                  <Text style={font.body}>Nhiệt độ</Text>
                  <Ionicons
                    name="thermometer-outline"
                    size={16}
                    color={color.primary}
                  />
                </View>
                {temp ? (
                  <Text style={s.metricLarge}>
                    {temp.value}
                    <Text style={[font.bodyLarge, { color: color.textSecondary }]}>
                      {" "}{temp.unit}
                    </Text>
                  </Text>
                ) : (
                  <Text style={[font.metricMedium, { color: color.textTertiary }]}>
                    —
                  </Text>
                )}
              </View>

              {/* Humidity */}
              <View
                style={[
                  s.card,
                  { flex: 1, alignItems: "flex-start" },
                ]}
              >
                <View style={s.rowStart}>
                  <Text style={font.body}>Độ ẩm</Text>
                  <Ionicons
                    name="water-outline"
                    size={16}
                    color={color.primary}
                  />
                </View>
                {humid ? (
                  <Text style={s.metricLarge}>
                    {humid.value}
                    <Text style={[font.bodyLarge, { color: color.textSecondary }]}>
                      {" "}{humid.unit}
                    </Text>
                  </Text>
                ) : (
                  <Text style={[font.metricMedium, { color: color.textTertiary }]}>
                    —
                  </Text>
                )}
              </View>
            </View>

            {/* Real Historical Chart */}
            {householdId && (
              <SensorHistoryChart
                householdId={householdId}
                deviceId={device.id}
              />
            )}

            {/* Deferred: 24h stats, thresholds, CSV, signal — all hidden */}
            <View style={s.card}>
              <Text style={s.sectionHeader}>Thống kê & Cài đặt nâng cao</Text>
              <Text style={font.body}>
                Thống kê 24 giờ, ngưỡng cảnh báo, xuất CSV và kiểm tra tín hiệu sẽ được bổ sung sau khi backend hỗ trợ trong các Sprint tiếp theo.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DevicePowerCard({
  device,
  onRefresh,
}: {
  device: Device;
  /** Called after a successful command so the parent can re-fetch fresh state. */
  onRefresh: () => void;
}) {
  const { session } = useSession();
  const [power, setPower] = useState(device.state?.power === "on");
  const [toggling, setToggling] = useState(false);
  // Set to the server-confirmed power value right after a successful command.
  // Prevents the useEffect from reverting the switch before the parent refresh
  // propagates the new device.state back as a prop.
  const confirmedPower = useRef<boolean | null>(null);

  // Sync from server when the parent refreshes device data (pull-to-refresh).
  // If a confirmed value is pending, use it first — the parent prop hasn't
  // updated yet (same old value), so the effect would otherwise revert the switch.
  useEffect(() => {
    if (!toggling) {
      if (confirmedPower.current !== null) {
        setPower(confirmedPower.current);
        confirmedPower.current = null;
        return;
      }
      setPower(device.state?.power === "on");
    }
  }, [device.state?.power, toggling]);

  async function handleToggle(value: boolean) {
    if (!device.isOnline || toggling) return;
    const householdId = session.identity?.households[0]?.id;
    if (!householdId) return;

    setToggling(true);
    setPower(value); // optimistic
    try {
      const raw = await session.post(
        `/households/${householdId}/devices/${device.id}/commands`,
        { action: value ? "turn_on" : "turn_off" },
      );
      // Use the server-confirmed state from the response, not just the user value.
      // isRecord is imported from core/session.
      const serverPower =
        isRecord(raw) && isRecord(raw["state"]) && raw["state"]["power"] === "on"
          ? true
          : isRecord(raw) && isRecord(raw["state"]) && raw["state"]["power"] === "off"
          ? false
          : value; // fallback to optimistic if response shape is unexpected
      // Store before setToggling(false) so the effect sees it
      confirmedPower.current = serverPower;
      setPower(serverPower);
      // Refresh parent so device.state is up-to-date for subsequent re-renders
      onRefresh();
    } catch (e: unknown) {
      setPower(!value); // rollback
      confirmedPower.current = null;
      Alert.alert(
        "Lỗi điều khiển",
        e instanceof Error ? e.message : "Không thể gửi lệnh điều khiển tới thiết bị.",
      );
    } finally {
      setToggling(false);
    }
  }

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={s.rowStart}>
          <Ionicons
            name={power ? "power" : "power-outline"}
            size={22}
            color={power ? color.primary : color.textTertiary}
          />
          <View style={s.group}>
            <Text style={font.titleSmall}>
              {device.deviceType === "light" ? "Nguồn chiếu sáng" : "Nguồn quạt điện"}
            </Text>
            <Text style={font.caption}>
              {power ? "Đang bật" : "Đang tắt"}
            </Text>
          </View>
        </View>
        <View style={s.rowStart}>
          {toggling ? (
            <ActivityIndicator size="small" color={color.primary} style={{ marginRight: spacing.sm }} />
          ) : null}
          <Switch
            value={power}
            disabled={!device.isOnline || toggling}
            onValueChange={handleToggle}
            trackColor={{ false: color.border, true: color.primary }}
            thumbColor={color.surface}
            accessibilityLabel={
              !device.isOnline
                ? "Thiết bị ngoại tuyến, không thể điều khiển"
                : `Bật hoặc tắt ${device.name}`
            }
          />
        </View>
      </View>
    </View>
  );
}

function DoorAngleControlCard({
  device,
  onRefresh,
}: {
  device: Device;
  onRefresh: () => void;
}) {
  const { session } = useSession();
  const initialOpen = device.state?.position === "open";
  const initialAngle = typeof device.state?.angle === "number" ? device.state.angle : (initialOpen ? 90 : 0);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [angle, setAngle] = useState(initialAngle);
  const [targetAngle, setTargetAngle] = useState(initialAngle);
  const [toggling, setToggling] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(240);
  const confirmedState = useRef<{ isOpen: boolean; angle: number } | null>(null);

  useEffect(() => {
    if (!toggling) {
      if (confirmedState.current !== null) {
        setIsOpen(confirmedState.current.isOpen);
        setAngle(confirmedState.current.angle);
        setTargetAngle(confirmedState.current.angle);
        confirmedState.current = null;
        return;
      }
      const isDeviceOpen = device.state?.position === "open";
      const devAngle = typeof device.state?.angle === "number" ? device.state.angle : (isDeviceOpen ? 90 : 0);
      setIsOpen(isDeviceOpen);
      setAngle(devAngle);
      setTargetAngle(devAngle);
    }
  }, [device.state?.position, device.state?.angle, toggling]);

  async function executeDoorAngle(newAngle: number) {
    if (!device.isOnline || toggling) return;
    const householdId = session.identity?.households[0]?.id;
    if (!householdId) return;

    const clamped = Math.max(0, Math.min(180, Math.round(newAngle)));
    const willOpen = clamped > 0;
    setToggling(true);
    setTargetAngle(clamped);
    setAngle(clamped);
    setIsOpen(willOpen);

    try {
      const raw = await session.post(
        `/households/${householdId}/devices/${device.id}/commands`,
        { action: "set_angle", angle: clamped },
      );
      const serverPosition =
        isRecord(raw) && isRecord(raw["state"]) && typeof raw["state"]["position"] === "string"
          ? raw["state"]["position"]
          : (willOpen ? "open" : "closed");
      const serverAngle =
        isRecord(raw) && isRecord(raw["state"]) && typeof raw["state"]["angle"] === "number"
          ? raw["state"]["angle"]
          : clamped;
      const finalOpen = serverPosition === "open";
      confirmedState.current = { isOpen: finalOpen, angle: serverAngle };
      setIsOpen(finalOpen);
      setAngle(serverAngle);
      setTargetAngle(serverAngle);
      onRefresh();
    } catch (e: unknown) {
      setIsOpen(isOpen);
      setAngle(angle);
      setTargetAngle(angle);
      confirmedState.current = null;
      Alert.alert(
        "Lỗi điều khiển cửa",
        e instanceof Error ? e.message : "Không thể gửi lệnh điều khiển tới cửa.",
      );
    } finally {
      setToggling(false);
    }
  }

  function handleToggle(value: boolean) {
    void executeDoorAngle(value ? 90 : 0);
  }

  // Quick preset angles
  const presets = [
    { label: "Đóng (0°)", val: 0 },
    { label: "Hé (30°)", val: 30 },
    { label: "Mở 90°", val: 90 },
    { label: "180°", val: 180 },
  ];

  const thumbPosition = Math.max(0, Math.min(sliderWidth - 28, ((targetAngle / 180) * (sliderWidth - 28))));

  return (
    <View style={s.card}>
      {/* Header with status and quick switch */}
      <View style={s.row}>
        <View style={s.rowStart}>
          <Ionicons
            name={isOpen ? "lock-open" : "lock-closed"}
            size={24}
            color={isOpen ? color.primary : color.textTertiary}
          />
          <View style={s.group}>
            <Text style={font.titleSmall}>Cửa thông minh</Text>
            <Text style={font.caption}>
              {isOpen ? `Đang mở ${angle}°` : "Đang đóng (0°)"}
            </Text>
          </View>
        </View>
        <View style={s.rowStart}>
          {toggling ? (
            <ActivityIndicator size="small" color={color.primary} style={{ marginRight: spacing.sm }} />
          ) : null}
          <Switch
            value={isOpen}
            disabled={!device.isOnline || toggling}
            onValueChange={handleToggle}
            trackColor={{ false: color.border, true: color.primary }}
            thumbColor={color.surface}
            accessibilityLabel={`Mở hoặc đóng ${device.name}`}
          />
        </View>
      </View>

      {/* Slider / Thanh gạt góc mở */}
      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        <View style={s.row}>
          <Text style={[font.label, { color: color.textSecondary }]}>
            Thanh gạt góc mở:
          </Text>
          <View style={[s.pillOnline, { backgroundColor: isOpen ? color.primaryLight : color.surfaceVariant }]}>
            <Text style={[s.pillOnlineText, { color: isOpen ? color.primary : color.textSecondary }]}>
              {targetAngle}°
            </Text>
          </View>
        </View>

        {/* Custom interactive slider track */}
        <View
          style={{
            height: 40,
            justifyContent: "center",
          }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setSliderWidth(w);
          }}
        >
          {/* Background track */}
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Gạt góc mở cửa"
            accessibilityValue={{ min: 0, max: 180, now: targetAngle }}
            disabled={!device.isOnline || toggling}
            onPress={(e) => {
              if (!device.isOnline || toggling) return;
              const clickX = e.nativeEvent.locationX;
              const ratio = Math.max(0, Math.min(1, clickX / sliderWidth));
              const newA = Math.round(ratio * 180);
              void executeDoorAngle(newA);
            }}
            style={{
              height: 12,
              backgroundColor: color.surfaceVariant,
              borderRadius: 6,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            {/* Active fill */}
            <View
              style={{
                width: `${(targetAngle / 180) * 100}%`,
                height: "100%",
                backgroundColor: color.primary,
              }}
            />
          </Pressable>

          {/* Draggable/Tappable Thumb indicator */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: thumbPosition,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: color.surface,
              borderColor: color.primary,
              borderWidth: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 4,
            }}
          />
        </View>

        {/* Quick Angle Presets */}
        <View style={s.rowGap}>
          {presets.map((p) => {
            const isActive = targetAngle === p.val;
            return (
              <Pressable
                key={p.val}
                accessibilityRole="button"
                accessibilityLabel={`Đặt góc ${p.label}`}
                disabled={!device.isOnline || toggling}
                onPress={() => void executeDoorAngle(p.val)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  alignItems: "center",
                  borderRadius: radius.md,
                  backgroundColor: isActive ? color.primary : color.surfaceVariant,
                  borderWidth: 1,
                  borderColor: isActive ? color.primary : color.border,
                }}
              >
                <Text
                  style={[
                    font.caption,
                    {
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? color.onPrimary : color.textPrimary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
