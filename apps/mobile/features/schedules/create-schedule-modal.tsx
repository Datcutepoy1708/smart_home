import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, font, radius, spacing } from "../../shared/theme";
import type { Device } from "../devices/device-data";
import type { CreateScheduleInput, ScheduleItem } from "./schedules-data";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleInput, scheduleId?: string) => Promise<void>;
  devices: Device[];
  editingSchedule?: ScheduleItem | null;
}

const COMMON_TIMES = ["06:30", "07:00", "11:30", "18:00", "22:00", "23:00"];

const DURATION_PRESETS = [
  { label: "Không tự tắt", value: 0 },
  { label: "5 phút", value: 5 },
  { label: "15 phút", value: 15 },
  { label: "30 phút", value: 30 },
  { label: "1 giờ", value: 60 },
  { label: "2 giờ", value: 120 },
];

export function CreateScheduleModal({
  visible,
  onClose,
  onSubmit,
  devices,
  editingSchedule,
}: Props) {
  const insets = useSafeAreaInsets();
  const controllableDevices = devices.filter(
    (d) =>
      d.deviceType === "fan" ||
      d.deviceType === "light" ||
      d.deviceType === "door_servo" ||
      d.deviceType === "door" ||
      d.deviceType === "cover",
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    controllableDevices[0]?.id || "",
  );
  const [time, setTime] = useState("07:00");
  const [action, setAction] = useState<
    "turn_on" | "turn_off" | "open" | "close" | "set_angle" | "open_cover" | "close_cover"
  >("turn_on");
  const [angle, setAngle] = useState(90);
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [customName, setCustomName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (editingSchedule) {
      setSelectedDeviceId(editingSchedule.deviceId);
      setTime(editingSchedule.time);
      setAction(editingSchedule.action);
      setAngle((editingSchedule.params?.angle as number) || 90);
      setRepeatDays(editingSchedule.repeatDays || [1, 2, 3, 4, 5, 6, 7]);
      setCustomName(editingSchedule.name || "");
      setDurationMinutes(editingSchedule.durationMinutes || 0);
    } else {
      setSelectedDeviceId(controllableDevices[0]?.id || "");
      setTime("07:00");
      setAction("turn_on");
      setAngle(90);
      setRepeatDays([1, 2, 3, 4, 5, 6, 7]);
      setCustomName("");
      setDurationMinutes(0);
    }
    setError("");
  }, [visible, editingSchedule]);

  const selectedDevice = controllableDevices.find((d) => d.id === selectedDeviceId);

  function handleSelectDevice(dev: Device) {
    setSelectedDeviceId(dev.id);
    if (dev.deviceType === "door_servo" || dev.deviceType === "door") {
      setAction("open");
      setAngle(90);
    } else if (dev.deviceType === "cover") {
      setAction("open_cover");
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
        if (action === "open_cover") autoName = `Mở ${devName}`;
        else if (action === "close_cover") autoName = `Đóng ${devName}`;
        else if (action === "open") autoName = `Mở ${devName} (${angle}°)`;
        else if (action === "close") autoName = `Đóng ${devName}`;
        else if (action === "turn_on") autoName = `Bật ${devName}`;
        else autoName = `Tắt ${devName}`;

        if (durationMinutes > 0) {
          autoName += ` (tắt sau ${durationMinutes}p)`;
        }
      }

      const isCover = selectedDevice?.deviceType === "cover";
      const isDoor =
        selectedDevice?.deviceType === "door_servo" ||
        selectedDevice?.deviceType === "door";

      await onSubmit(
        {
          deviceId: selectedDeviceId,
          name: autoName,
          time,
          action,
          params: isCover
            ? action === "open_cover"
              ? { state: "open" }
              : { state: "closed" }
            : isDoor
            ? action === "open"
              ? { angle, position: "open" }
              : { angle: 0, position: "closed" }
            : action === "turn_on"
            ? { power: "on" }
            : { power: "off" },
          durationMinutes: durationMinutes > 0 ? durationMinutes : null,
          repeatDays,
          isActive: true,
        },
        editingSchedule?.id,
      );

      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lưu lịch hẹn thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoid}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="time" size={24} color={color.primary} />
                <Text style={styles.headerTitle}>
                  {editingSchedule ? "Chỉnh Sửa Hẹn Giờ" : "Hẹn Giờ Tự Động"}
                </Text>
              </View>
              <Pressable hitSlop={12} onPress={onClose}>
                <Ionicons name="close" size={24} color={color.textTertiary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
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
                    style={[
                      styles.quickTimePill,
                      time === t && styles.quickTimePillActive,
                    ]}
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
                {controllableDevices.length === 0 ? (
                  <Text style={{ color: color.textTertiary, fontSize: 13 }}>
                    Không có thiết bị điều khiển nào trong nhà.
                  </Text>
                ) : (
                  controllableDevices.map((dev) => {
                    const isSelected = dev.id === selectedDeviceId;
                    const iconName =
                      dev.deviceType === "door_servo" ||
                      dev.deviceType === "door"
                        ? ("key" as const)
                        : dev.deviceType === "light"
                        ? ("bulb" as const)
                        : dev.deviceType === "cover"
                        ? ("umbrella" as const)
                        : ("hardware-chip" as const);

                    return (
                      <Pressable
                        key={dev.id}
                        style={[
                          styles.deviceCard,
                          isSelected && styles.deviceCardActive,
                        ]}
                        onPress={() => handleSelectDevice(dev)}
                      >
                        <Ionicons
                          name={iconName}
                          size={18}
                          color={isSelected ? color.primary : color.textSecondary}
                        />
                        <Text
                          style={[
                            styles.deviceCardText,
                            isSelected && styles.deviceCardTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {dev.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>

              {/* 3. Hành động */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                3. Hành động thực hiện
              </Text>
              {selectedDevice?.deviceType === "cover" ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      action === "open_cover" && styles.actionBtnActive,
                    ]}
                    onPress={() => setAction("open_cover")}
                  >
                    <Ionicons
                      name="open-outline"
                      size={18}
                      color={action === "open_cover" ? "#fff" : color.textPrimary}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        action === "open_cover" && styles.actionBtnTextActive,
                      ]}
                    >
                      Mở mái che
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionBtn,
                      action === "close_cover" && styles.actionBtnActive,
                    ]}
                    onPress={() => setAction("close_cover")}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color={
                        action === "close_cover" ? "#fff" : color.textPrimary
                      }
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        action === "close_cover" && styles.actionBtnTextActive,
                      ]}
                    >
                      Đóng mái che
                    </Text>
                  </Pressable>
                </View>
              ) : selectedDevice?.deviceType === "door_servo" ||
                selectedDevice?.deviceType === "door" ? (
                <View>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[
                        styles.actionBtn,
                        action === "open" && styles.actionBtnActive,
                      ]}
                      onPress={() => setAction("open")}
                    >
                      <Ionicons
                        name="lock-open-outline"
                        size={18}
                        color={action === "open" ? "#fff" : color.textPrimary}
                      />
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
                      style={[
                        styles.actionBtn,
                        action === "close" && styles.actionBtnActive,
                      ]}
                      onPress={() => setAction("close")}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={action === "close" ? "#fff" : color.textPrimary}
                      />
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

                  {action === "open" ? (
                    <View style={styles.angleRow}>
                      <Text style={styles.angleLabel}>Góc mở cửa:</Text>
                      <View style={styles.anglePills}>
                        {[30, 45, 60, 90, 120, 180].map((a) => (
                          <Pressable
                            key={a}
                            style={[
                              styles.anglePill,
                              angle === a && styles.anglePillActive,
                            ]}
                            onPress={() => setAngle(a)}
                          >
                            <Text
                              style={[
                                styles.angleText,
                                angle === a && styles.angleTextActive,
                              ]}
                            >
                              {a}°
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      action === "turn_on" && styles.actionBtnActive,
                    ]}
                    onPress={() => setAction("turn_on")}
                  >
                    <Ionicons
                      name="power"
                      size={18}
                      color={action === "turn_on" ? "#fff" : color.textPrimary}
                    />
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
                    style={[
                      styles.actionBtn,
                      action === "turn_off" && styles.actionBtnActive,
                    ]}
                    onPress={() => setAction("turn_off")}
                  >
                    <Ionicons
                      name="power-outline"
                      size={18}
                      color={action === "turn_off" ? "#fff" : color.textPrimary}
                    />
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

              {/* 4. Thời gian chạy (Tự động tắt sau) */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                4. Thời gian chạy (Tự động tắt sau...)
              </Text>
              <Text style={styles.subLabel}>
                Thiết bị sẽ tự động tắt hoặc đóng lại sau khoảng thời gian này
              </Text>
              <View style={styles.quickTimesRow}>
                {DURATION_PRESETS.map((dur) => (
                  <Pressable
                    key={dur.value}
                    style={[
                      styles.quickTimePill,
                      durationMinutes === dur.value && styles.quickTimePillActive,
                    ]}
                    onPress={() => setDurationMinutes(dur.value)}
                  >
                    <Text
                      style={[
                        styles.quickTimeText,
                        durationMinutes === dur.value &&
                          styles.quickTimeTextActive,
                      ]}
                    >
                      {dur.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* 5. Lặp lại các ngày */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                5. Lặp lại các ngày
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

              {/* 6. Tên gợi nhớ */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                6. Tên lịch hẹn (Tùy chọn)
              </Text>
              <TextInput
                style={styles.nameInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder="VD: Mở cửa đón gió sáng sớm"
                placeholderTextColor={color.textTertiary}
              />

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Submit */}
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, spacing.md) },
              ]}
            >
              <Pressable
                style={[styles.submitButton, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>
                  {submitting
                    ? "Đang lưu..."
                    : editingSchedule
                    ? "Cập Nhật Hẹn Giờ"
                    : "Lưu Hẹn Giờ"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
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
    color: color.textPrimary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: 12,
    color: color.textTertiary,
    marginBottom: spacing.xs,
  },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timeInput: {
    backgroundColor: color.background,
    borderWidth: 2,
    borderColor: color.primary,
    borderRadius: radius.md,
    fontSize: 28,
    fontWeight: "800",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    width: 120,
    textAlign: "center",
    color: color.textPrimary,
  },
  timeHelpText: {
    fontSize: 12,
    color: color.textTertiary,
  },
  quickTimesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 4,
  },
  quickTimePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
  },
  quickTimePillActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  quickTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
  },
  quickTimeTextActive: {
    color: "#fff",
  },
  deviceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
  },
  deviceCardActive: {
    backgroundColor: color.primaryLight,
    borderColor: color.primary,
  },
  deviceCardText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.textSecondary,
  },
  deviceCardTextActive: {
    color: color.primary,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
  },
  actionBtnActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: color.textPrimary,
  },
  actionBtnTextActive: {
    color: "#fff",
  },
  angleRow: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: color.background,
    borderRadius: radius.md,
  },
  angleLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
    marginBottom: spacing.xs,
  },
  anglePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  anglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  anglePillActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  angleText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
  },
  quickRepeatText: {
    fontSize: 11,
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
