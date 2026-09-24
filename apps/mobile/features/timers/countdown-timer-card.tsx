import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, font, radius, spacing } from "../../shared/theme";
import type { Device } from "../devices/device-data";
import {
  fetchDeviceTimer,
  setDeviceTimer,
  cancelDeviceTimer,
  type TimerStatus,
} from "./timer-data";
import type { Session } from "../../core/session";

interface Props {
  session: Session;
  householdId: string;
  device: Device;
}

const PRESET_MINUTES = [15, 30, 60, 120];

export function CountdownTimerCard({ session, householdId, device }: Props) {
  const [timer, setTimer] = useState<TimerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(30);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchDeviceTimer(session, householdId, device.id);
        if (active) setTimer(data);
      } catch {
        /* best effort */
      }
    }
    void load();

    // Ticking interval when timer is active
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (!prev || !prev.active || prev.remainingSeconds <= 0) return prev;
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session, householdId, device.id]);

  async function handleStart() {
    setLoading(true);
    try {
      const defaultAction =
        device.deviceType === "DOOR_SERVO"
          ? "close"
          : "turn_off";
      const res = await setDeviceTimer(
        session,
        householdId,
        device.id,
        selectedMinutes,
        defaultAction,
        0,
      );
      setTimer(res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await cancelDeviceTimer(session, householdId, device.id);
      setTimer(res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const defaultActionText =
    device.deviceType === "DOOR_SERVO" ? "Tự động đóng cửa" : "Tự động tắt";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="timer-outline" size={20} color={color.primary} />
          <Text style={styles.title}>Hẹn Giờ Tự Tắt (Đếm Ngược)</Text>
        </View>
        {timer?.active && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>ĐANG CHẠY</Text>
          </View>
        )}
      </View>

      {timer?.active && timer.remainingSeconds > 0 ? (
        <View style={styles.runningContainer}>
          <Text style={styles.remainingClock}>
            {formatTime(timer.remainingSeconds)}
          </Text>
          <Text style={styles.runningSubtext}>
            Sẽ {defaultActionText.toLowerCase()} khi hết thời gian
          </Text>
          <Pressable
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cancelBtnText}>Hủy Hẹn Giờ</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.desc}>
            Chọn khoảng thời gian để thiết bị tự động tắt/đóng:
          </Text>
          <View style={styles.presetsRow}>
            {PRESET_MINUTES.map((mins) => {
              const active = selectedMinutes === mins;
              return (
                <Pressable
                  key={mins}
                  style={[styles.presetPill, active && styles.presetPillActive]}
                  onPress={() => setSelectedMinutes(mins)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      active && styles.presetTextActive,
                    ]}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}p`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.startBtn, loading && { opacity: 0.7 }]}
            onPress={handleStart}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={styles.startBtnText}>
                  Bắt đầu đếm ngược ({selectedMinutes} phút)
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
  },
  activeBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803d",
  },
  desc: {
    fontSize: 12,
    color: color.textSecondary,
    marginBottom: spacing.sm,
  },
  presetsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  presetPill: {
    flex: 1,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  presetPillActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  presetText: {
    fontSize: 14,
    fontWeight: "700",
    color: color.textPrimary,
  },
  presetTextActive: {
    color: "#fff",
  },
  startBtn: {
    backgroundColor: color.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  runningContainer: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  remainingClock: {
    fontSize: 32,
    fontWeight: "800",
    color: color.primary,
    fontVariant: ["tabular-nums"],
  },
  runningSubtext: {
    fontSize: 12,
    color: color.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  cancelBtn: {
    backgroundColor: color.error,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cancelBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
