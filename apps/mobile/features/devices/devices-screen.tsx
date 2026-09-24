import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useDevices } from "./use-devices";
import { useSession } from "../../core/session-provider";
import { isRecord } from "../../core/session";
import { styles as s } from "../../shared/components/screen-styles";
import ScreenHeader from "../../shared/components/screen-header";
import { color, font, radius, spacing } from "../../shared/theme";
import type { Device } from "./device-data";
import { FloatingVoiceButton } from "../voice/floating-voice-button";

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

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

function getReading(device: Device, metric: "temperature" | "humidity") {
  return device.readings.find((r) => r.metric === metric);
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusPill({ online, error }: { online: boolean; error: boolean }) {
  if (error)
    return (
      <View style={s.pillOffline}>
        <Text style={s.pillOfflineText}>Không rõ</Text>
      </View>
    );
  if (online)
    return (
      <View style={s.pillOnline}>
        <Text style={s.pillOnlineText}>Trực tuyến</Text>
      </View>
    );
  return (
    <View style={s.pillOffline}>
      <Text style={s.pillOfflineText}>Ngoại tuyến</Text>
    </View>
  );
}

function DeviceCard({
  device,
  hasError,
  onRefresh,
}: {
  device: Device;
  hasError: boolean;
  onRefresh: () => void;
}) {
  const temp = getReading(device, "temperature");
  const humid = getReading(device, "humidity");
  const isGas = device.deviceType === "gas";
  const isOffline = !device.isOnline;

  const cardStyle = isGas && device.isOnline
    ? s.cardWarning
    : isOffline
    ? [s.card, { opacity: 0.6 }]
    : s.card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết thiết bị ${device.name}`}
      onPress={() => router.push(`/device/${device.id}` as never)}
    >
      <View style={cardStyle}>
        {/* Card header */}
        <View style={s.row}>
          <View style={[s.rowStart, { flex: 1 }]}>
            <View
              style={[
                s.listItemIcon,
                isGas && device.isOnline
                  ? { backgroundColor: color.errorBackground }
                  : {},
              ]}
            >
              <Ionicons
                name={
                  device.deviceType === "light"
                    ? "bulb-outline"
                    : device.deviceType === "fan"
                    ? "aperture-outline"
                    : device.deviceType === "door"
                    ? "lock-closed-outline"
                    : device.deviceType === "gas"
                    ? "flame-outline"
                    : "thermometer-outline"
                }
                size={20}
                color={
                  isGas && device.isOnline ? color.error : color.textSecondary
                }
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[font.label, { flexShrink: 1 }]}
                numberOfLines={1}
              >
                {device.name}
              </Text>
              {device.room ? (
                <Text style={font.caption}>{device.room}</Text>
              ) : null}
            </View>
          </View>
          <StatusPill online={device.isOnline} error={hasError} />
        </View>

        {/* Sensor readings — temperature & humidity */}
        {(temp ?? humid) ? (
          <View style={[s.rowGap, { gap: spacing.xl }]}>
            {temp ? (
              <View style={s.group}>
                <Text style={font.caption}>Nhiệt độ</Text>
                <Text style={font.metricMedium}>
                  {temp.value} {temp.unit}
                </Text>
              </View>
            ) : null}
            {humid ? (
              <View style={s.group}>
                <Text style={font.caption}>Độ ẩm</Text>
                <Text style={font.metricMedium}>
                  {humid.value} {humid.unit}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Controls: light, fan — interactive switch in Sprint 2 */}
        {(device.deviceType === "light" || device.deviceType === "fan") && (
          <DeviceControlRow device={device} onRefresh={onRefresh} />
        )}
        {(device.deviceType === "door" || device.deviceType === "door_servo") && (
          <DoorControlRow device={device} onRefresh={onRefresh} />
        )}

        {/* Last seen */}
        <Text style={font.caption}>{formatLastSeen(device.lastSeenAt)}</Text>
      </View>
    </Pressable>
  );
}

function DeviceControlRow({
  device,
  onRefresh,
}: {
  device: Device;
  /** Called after a successful command so the parent list re-fetches. */
  onRefresh: () => void;
}) {
  const { session } = useSession();
  const [power, setPower] = useState(device.state?.power === "on");
  const [toggling, setToggling] = useState(false);
  // Holds the server-confirmed power value until the parent prop updates.
  // Prevents the useEffect from reverting the switch on toggling→false
  // when device.state hasn't changed in the prop yet.
  const confirmedPower = useRef<boolean | null>(null);

  // Sync from server state on genuine refreshes.
  // If a confirmed value is pending, apply it first.
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
      // Extract server-confirmed state from the response.
      const serverPower =
        isRecord(raw) && isRecord(raw["state"]) && raw["state"]["power"] === "on"
          ? true
          : isRecord(raw) && isRecord(raw["state"]) && raw["state"]["power"] === "off"
          ? false
          : value; // fallback: keep optimistic if shape unexpected
      confirmedPower.current = serverPower;
      setPower(serverPower);
      // Refresh the parent list so device.state is current for future renders
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
    <View style={[s.row, { paddingVertical: spacing.xs }]}>
      <View style={s.rowStart}>
        <Ionicons
          name={power ? "power" : "power-outline"}
          size={18}
          color={power ? color.primary : color.textTertiary}
        />
        <Text style={[font.body, { fontWeight: "500" }]}>
          {device.deviceType === "light" ? "Công tắc đèn" : "Công tắc quạt"}
        </Text>
      </View>
      <View style={s.rowStart}>
        {toggling ? (
          <ActivityIndicator size="small" color={color.primary} style={{ marginRight: spacing.xs }} />
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
  );
}

function DoorControlRow({
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
  const [toggling, setToggling] = useState(false);
  const confirmedState = useRef<{ isOpen: boolean; angle: number } | null>(null);

  useEffect(() => {
    if (!toggling) {
      if (confirmedState.current !== null) {
        setIsOpen(confirmedState.current.isOpen);
        setAngle(confirmedState.current.angle);
        confirmedState.current = null;
        return;
      }
      const isDeviceOpen = device.state?.position === "open";
      const devAngle = typeof device.state?.angle === "number" ? device.state.angle : (isDeviceOpen ? 90 : 0);
      setIsOpen(isDeviceOpen);
      setAngle(devAngle);
    }
  }, [device.state?.position, device.state?.angle, toggling]);

  async function handleToggle(value: boolean) {
    if (!device.isOnline || toggling) return;
    const householdId = session.identity?.households[0]?.id;
    if (!householdId) return;

    const targetAngle = value ? 90 : 0;
    setToggling(true);
    setIsOpen(value);
    setAngle(targetAngle);
    try {
      const raw = await session.post(
        `/households/${householdId}/devices/${device.id}/commands`,
        { action: value ? "open" : "close", angle: targetAngle },
      );
      const serverPosition =
        isRecord(raw) && isRecord(raw["state"]) && typeof raw["state"]["position"] === "string"
          ? raw["state"]["position"]
          : (value ? "open" : "closed");
      const serverAngle =
        isRecord(raw) && isRecord(raw["state"]) && typeof raw["state"]["angle"] === "number"
          ? raw["state"]["angle"]
          : targetAngle;
      const finalOpen = serverPosition === "open";
      confirmedState.current = { isOpen: finalOpen, angle: serverAngle };
      setIsOpen(finalOpen);
      setAngle(serverAngle);
      onRefresh();
    } catch (e: unknown) {
      setIsOpen(!value);
      setAngle(!value ? 90 : 0);
      confirmedState.current = null;
      Alert.alert(
        "Lỗi điều khiển cửa",
        e instanceof Error ? e.message : "Không thể gửi lệnh điều khiển tới cửa.",
      );
    } finally {
      setToggling(false);
    }
  }

  return (
    <View style={[s.row, { paddingVertical: spacing.xs }]}>
      <View style={s.rowStart}>
        <Ionicons
          name={isOpen ? "lock-open" : "lock-closed"}
          size={18}
          color={isOpen ? color.primary : color.textTertiary}
        />
        <Text style={[font.body, { fontWeight: "500" }]}>
          {isOpen ? `Cửa mở (${angle}°)` : "Cửa đóng (0°)"}
        </Text>
      </View>
      <View style={s.rowStart}>
        {toggling ? (
          <ActivityIndicator size="small" color={color.primary} style={{ marginRight: spacing.xs }} />
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
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function DevicesScreen() {
  const { session } = useSession();
  const { home, items, loading, error, refresh, more } = useDevices();
  const [search, setSearch] = useState("");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [onlineFilter, setOnlineFilter] = useState<
    "all" | "online" | "offline"
  >("all");

  const userName = session.identity?.user.name ?? "";
  const userInitials = initials(userName);

  // Derive unique rooms from real device list
  const rooms = Array.from(
    new Set(items.map((d) => d.room).filter(Boolean) as string[])
  );

  // Client-side filtering
  const filtered = items.filter((d) => {
    const matchSearch =
      !search.trim() ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.room ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRoom = !activeRoom || d.room === activeRoom;
    const matchOnline =
      onlineFilter === "all" ||
      (onlineFilter === "online" && d.isOnline) ||
      (onlineFilter === "offline" && !d.isOnline);
    return matchSearch && matchRoom && matchOnline;
  });

  const onlineCount = items.filter((d) => d.isOnline).length;
  const offlineCount = items.filter((d) => !d.isOnline).length;

  return (
    <SafeAreaView style={s.screen}>
      <ScreenHeader
        title="Thiết bị"
        initials={userInitials}
        showBell
        right={
          <Ionicons
            name="options-outline"
            size={20}
            color={color.textSecondary}
          />
        }
      />

      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { gap: spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={color.primary}
          />
        }
      >
        {/* Household selector pill */}
        {home ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn ngôi nhà"
            onPress={() => router.push("/household-modal" as never)}
            style={[
              s.rowStart,
              {
                backgroundColor: color.primaryLight,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                alignSelf: "flex-start",
                gap: spacing.xs,
              },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={14}
              color={color.primary}
            />
            <Text style={[font.label, { color: color.primary }]}>
              {home.name}
            </Text>
            <Ionicons
              name="chevron-down-outline"
              size={14}
              color={color.primary}
            />
          </Pressable>
        ) : null}

        {/* Search bar */}
        <View style={s.searchBar}>
          <Ionicons
            name="search-outline"
            size={16}
            color={color.textTertiary}
          />
          <TextInput
            accessibilityLabel="Tìm kiếm thiết bị hoặc phòng"
            placeholder="Tìm kiếm thiết bị, phòng..."
            placeholderTextColor={color.textTertiary}
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Room filter chips */}
        {rooms.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[s.chipRow, { paddingHorizontal: 0 }]}
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: activeRoom === null }}
              onPress={() => setActiveRoom(null)}
              style={activeRoom === null ? s.chipActive : s.chipInactive}
            >
              <Text
                style={
                  activeRoom === null ? s.chipActiveText : s.chipInactiveText
                }
              >
                Tất cả ({items.length})
              </Text>
            </Pressable>
            {rooms.map((room) => (
              <Pressable
                key={room}
                accessibilityRole="radio"
                accessibilityState={{ checked: activeRoom === room }}
                onPress={() =>
                  setActiveRoom(activeRoom === room ? null : room)
                }
                style={activeRoom === room ? s.chipActive : s.chipInactive}
              >
                <Text
                  style={
                    activeRoom === room
                      ? s.chipActiveText
                      : s.chipInactiveText
                  }
                >
                  {room} ({items.filter((d) => d.room === room).length})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* Online / Offline filter */}
        <View style={s.rowGap}>
          {(
            [
              { key: "all", label: `Tất cả (${items.length})` },
              { key: "online", label: `Trực tuyến (${onlineCount})` },
              { key: "offline", label: `Ngoại tuyến (${offlineCount})` },
            ] as const
          ).map(({ key, label }) => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: onlineFilter === key }}
              onPress={() => setOnlineFilter(key)}
              style={onlineFilter === key ? s.pillPrimary : s.pillNeutral}
            >
              <Text
                style={
                  onlineFilter === key ? s.pillPrimaryText : s.pillNeutralText
                }
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Error banner */}
        {error ? (
          <View style={s.cardAlert}>
            <Text
              accessibilityRole="alert"
              style={[font.body, { color: color.error }]}
            >
              {error}
            </Text>
            {items.length > 0 && (
              <Text style={font.bodySmall}>Đang hiển thị dữ liệu cũ.</Text>
            )}
            <Pressable
              accessibilityRole="button"
              style={s.buttonOutline}
              onPress={refresh}
            >
              <Text style={s.buttonOutlineText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Loading */}
        {loading && !items.length ? (
          <View style={s.emptyState}>
            <ActivityIndicator
              accessibilityLabel="Đang tải thiết bị"
              color={color.primary}
            />
          </View>
        ) : null}

        {/* Empty */}
        {!loading && !error && !items.length ? (
          <View style={s.emptyState}>
            <Ionicons
              name="hardware-chip-outline"
              size={48}
              color={color.textTertiary}
            />
            <Text style={s.emptyStateText}>
              {home
                ? "Chưa có thiết bị nào trong nhà này."
                : "Không tìm thấy ngôi nhà của bạn."}
            </Text>
          </View>
        ) : null}

        {/* Filtered empty */}
        {!loading && items.length > 0 && filtered.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyStateText}>
              Không có thiết bị khớp với bộ lọc.
            </Text>
          </View>
        ) : null}

        {/* Device cards */}
        {filtered.map((device) => (
          <DeviceCard key={device.id} device={device} hasError={!!error} onRefresh={refresh} />
        ))}

        {/* Load more */}
        {more ? (
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={more}
            style={s.secondary}
          >
            <Text style={s.link}>Tải thêm</Text>
          </Pressable>
        ) : null}

        {/* FAB: add device — deferred Sprint 2+ */}
        <View style={s.emptyState}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm thiết bị — chưa khả dụng"
            disabled
            style={[s.fab, { position: "relative", bottom: 0, right: 0 }]}
          >
            <Ionicons name="add" size={28} color={color.onPrimary} />
          </Pressable>
          <Text style={font.caption}>Thêm thiết bị (Sprint 2)</Text>
        </View>
      </ScrollView>

      {/* Floating Voice Assistant */}
      {home ? (
        <FloatingVoiceButton
          householdId={home.id}
          onCommandExecuted={refresh}
        />
      ) : null}
    </SafeAreaView>
  );
}
