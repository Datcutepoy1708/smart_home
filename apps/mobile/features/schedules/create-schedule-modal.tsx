import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, font, radius, spacing } from "../../shared/theme";
import type { Device } from "../devices/device-data";
import type { CreateScheduleInput } from "./schedules-data";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleInput) => Promise<void>;
  devices: Device[];
}

const COMMON_TIMES = ["06:30", "07:00", "11:30", "18:00", "22:00", "23:00"];

export function CreateScheduleModal({
  visible,
  onClose,
  onSubmit,
  devices,
}: Props) {
  const controllableDevices = devices.filter(
    (d) => d.deviceType === "FAN" || d.deviceType === "LIGHT" || d.deviceType === "DOOR_SERVO",
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    controllableDevices[0]?.id || "",
  );
  const [time, setTime] = useState("07:00");
  const [action, setAction] = useState<"turn_on" | "turn_off" | "open" | "close" | "set_angle">(
    "open",
  );
  const [angle, setAngle] = useState(90);
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [customName, setCustomName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedDevice = controllableDevices.find((d) => d.id === selectedDeviceId);

  function handleSelectDevice(dev: Device) {
    setSelectedDeviceId(dev.id);
    if (dev.deviceType === "DOOR_SERVO") {
      setAction("open");
      setAngle(90);
    } else {
      setAction("turn_on");
    }
  }

  function toggleDay(day: number) {
    if (repeatDays.includes(day)) {
      setRepeatDays(repeatDays.filter((d) => d !== day));
    } else {
      setRepeatDays([...repeatDays, day].sort());
    }
  }

  async function handleSubmit() {
    if (!selectedDeviceId) {
      setError("Vui lòng chọn thiết bị");
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      setError("Thời gian phải đúng định dạng HH:mm (VD: 07:30)");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const devName = selectedDevice?.name || "thiết bị";
      let autoName = customName.trim();
      if (!autoName) {
        if (action === "open") autoName = `Mở ${devName} (${angle}°)`;
        else if (action === "close") autoName = `Đóng ${devName}`;
        else if (action === "turn_on") autoName = `Bật ${devName}`;
        else autoName = `Tắt ${devName}`;
      }

      await onSubmit({
        deviceId: selectedDeviceId,
        name: autoName,
        time,
        action,
        params:
          selectedDevice?.deviceType === "DOOR_SERVO"
            ? action === "open"
              ? { angle, position: "open" }
              : { angle: 0, position: "closed" }
            : action === "turn_on"
              ? { power: "on" }
              : { power: "off" },
        repeatDays,
        isActive: true,
      });

      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tạo lịch hẹn thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="time" size={24} color={color.primary} />
              <Text style={styles.headerTitle}>Hẹn Giờ Tự Động</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={24} color={color.textTertiary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* 1. Chọn thời gian */}
            <Text style={styles.sectionLabel}>1. Thời gian kích hoạt (24h)</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.timeInput}
                value={time}
                onChangeText={setTime}
                placeholder="HH:mm"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.timeHelpText}>Ví dụ: 07:00, 22:30</Text>
            </View>
            <View style={styles.quickTimesRow}>
              {COMMON_TIMES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.quickTimePill, time === t && styles.quickTimePillActive]}
                  onPress={() => setTime(t)}
                >
                  <Text
                    style={[
                      styles.quickTimeText,
                      time === t && styles.quickTimeTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 2. Chọn thiết bị */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
              2. Chọn thiết bị
            </Text>
            <View style={styles.deviceRow}>
              {controllableDevices.map((dev) => {
                const isSelected = dev.id === selectedDeviceId;
                let iconName: "key" | "hardware-chip" | "bulb" = "hardware-chip";
                if (dev.deviceType === "DOOR_SERVO") iconName = "key";
                if (dev.deviceType === "LIGHT") iconName = "bulb";

                return (
                  <Pressable
                    key={dev.id}
                    style={[styles.devicePill, isSelected && styles.devicePillActive]}
                    onPress={() => handleSelectDevice(dev)}
                  >
                    <Ionicons
                      name={iconName}
                      size={18}
                      color={isSelected ? color.primary : color.textTertiary}
                    />
                    <Text
                      style={[
                        styles.devicePillText,
                        isSelected && styles.devicePillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {dev.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3. Chọn hành động */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
              3. Hành động thực hiện
            </Text>
            {selectedDevice?.deviceType === "DOOR_SERVO" ? (
              <View>
                <View style={styles.actionButtonsRow}>
                  <Pressable
                    style={[styles.actionBtn, action === "open" && styles.actionBtnActive]}
                    onPress={() => setAction("open")}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        action === "open" && styles.actionBtnTextActive,
                      ]}
                    >
                      Mở cửa
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, action === "close" && styles.actionBtnActive]}
                    onPress={() => setAction("close")}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        action === "close" && styles.actionBtnTextActive,
                      ]}
                    >
                      Đóng cửa
                    </Text>
                  </Pressable>
                </View>

                {action === "open" && (
                  <View style={styles.angleRow}>
                    <Text style={styles.subLabel}>Góc mở:</Text>
                    {[45, 90, 135, 180].map((deg) => (
                      <Pressable
                        key={deg}
                        style={[styles.anglePill, angle === deg && styles.anglePillActive]}
                        onPress={() => setAngle(deg)}
                      >
                        <Text
                          style={[
                            styles.angleText,
                            angle === deg && styles.angleTextActive,
                          ]}
                        >
                          {deg}°
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.actionButtonsRow}>
                <Pressable
                  style={[styles.actionBtn, action === "turn_on" && styles.actionBtnActive]}
                  onPress={() => setAction("turn_on")}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      action === "turn_on" && styles.actionBtnTextActive,
                    ]}
                  >
                    Bật
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, action === "turn_off" && styles.actionBtnActive]}
                  onPress={() => setAction("turn_off")}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      action === "turn_off" && styles.actionBtnTextActive,
                    ]}
                  >
                    Tắt
                  </Text>
                </Pressable>
              </View>
            )}

            {/* 4. Lặp lại ngày */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
              4. Lặp lại các ngày
            </Text>
            <View style={styles.quickRepeatRow}>
              <Pressable
                style={styles.quickRepeatBtn}
                onPress={() => setRepeatDays([1, 2, 3, 4, 5, 6, 7])}
              >
                <Text style={styles.quickRepeatText}>Hàng ngày</Text>
              </Pressable>
              <Pressable
                style={styles.quickRepeatBtn}
                onPress={() => setRepeatDays([1, 2, 3, 4, 5])}
              >
                <Text style={styles.quickRepeatText}>T2 - T6</Text>
              </Pressable>
              <Pressable
                style={styles.quickRepeatBtn}
                onPress={() => setRepeatDays([6, 7])}
              >
                <Text style={styles.quickRepeatText}>Cuối tuần</Text>
              </Pressable>
              <Pressable
                style={styles.quickRepeatBtn}
                onPress={() => setRepeatDays([])}
              >
                <Text style={styles.quickRepeatText}>Một lần</Text>
              </Pressable>
            </View>
            <View style={styles.daysRow}>
              {[
                { day: 1, label: "T2" },
                { day: 2, label: "T3" },
                { day: 3, label: "T4" },
                { day: 4, label: "T5" },
                { day: 5, label: "T6" },
                { day: 6, label: "T7" },
                { day: 7, label: "CN" },
              ].map(({ day, label }) => {
                const active = repeatDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    style={[styles.dayCircle, active && styles.dayCircleActive]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[styles.dayText, active && styles.dayTextActive]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 5. Tên gợi nhớ */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
              5. Tên lịch hẹn (Tùy chọn)
            </Text>
            <TextInput
              style={styles.nameInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="VD: Mở cửa đón gió sáng sớm"
              placeholderTextColor={color.textTertiary}
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Submit */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.submitButton, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitText}>
                {submitting ? "Đang lưu..." : "Lưu Hẹn Giờ"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
  },
  body: {
    padding: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: color.textSecondary,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  subLabel: {
    fontSize: 14,
    color: color.textSecondary,
    marginRight: spacing.sm,
  },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timeInput: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 24,
    fontWeight: "800",
    color: color.textPrimary,
    width: 120,
    textAlign: "center",
  },
  timeHelpText: {
    fontSize: 12,
    color: color.textTertiary,
  },
  quickTimesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  quickTimePill: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  quickTimePillActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  quickTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textPrimary,
  },
  quickTimeTextActive: {
    color: "#fff",
  },
  deviceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  devicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  devicePillActive: {
    backgroundColor: "#eff6ff",
    borderColor: color.primary,
  },
  devicePillText: {
    fontSize: 14,
    fontWeight: "600",
    color: color.textPrimary,
  },
  devicePillTextActive: {
    color: color.primary,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  actionBtnActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: color.textPrimary,
  },
  actionBtnTextActive: {
    color: "#fff",
  },
  angleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  anglePill: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  anglePillActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  angleText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textPrimary,
  },
  angleTextActive: {
    color: "#fff",
  },
  quickRepeatRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickRepeatBtn: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  quickRepeatText: {
    fontSize: 12,
    color: color.textSecondary,
    fontWeight: "600",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  dayText: {
    fontSize: 12,
    fontWeight: "700",
    color: color.textPrimary,
  },
  dayTextActive: {
    color: "#fff",
  },
  nameInput: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: color.textPrimary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  submitButton: {
    backgroundColor: color.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: color.error,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
});
