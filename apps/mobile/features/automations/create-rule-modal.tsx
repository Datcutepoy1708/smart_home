import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../../core/session-provider";
import { color, font, radius, spacing } from "../../shared/theme";
import { createRuleApi } from "./automations-data";
import type { Device } from "../devices/device-data";

interface CreateRuleModalProps {
  visible: boolean;
  householdId: string;
  devices: Device[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRuleModal({
  visible,
  householdId,
  devices,
  onClose,
  onCreated,
}: CreateRuleModalProps) {
  const { session } = useSession();

  const [name, setName] = useState("");
  const [metric, setMetric] = useState<"temperature" | "humidity">("temperature");
  const [operator, setOperator] = useState<">" | "<">(">");
  const [threshold, setThreshold] = useState("30");

  const controllableDevices = devices.filter(
    (d) => d.deviceType === "fan" || d.deviceType === "light" || d.deviceType === "door_servo"
  );
  const [targetDeviceId, setTargetDeviceId] = useState<string>(
    controllableDevices[0]?.id ?? ""
  );
  const [targetAction, setTargetAction] = useState<string>("turn_on");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedDevice = devices.find((d) => d.id === targetDeviceId);

  async function handleSubmit() {
    const numThreshold = parseFloat(threshold);
    if (!name.trim()) {
      setError("Vui lòng nhập tên kịch bản.");
      return;
    }
    if (isNaN(numThreshold)) {
      setError("Ngưỡng giá trị không hợp lệ.");
      return;
    }
    if (!targetDeviceId) {
      setError("Vui lòng chọn thiết bị thực thi.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      let actionParams: Record<string, unknown> = {};
      if (targetAction === "turn_on") actionParams = { power: "on" };
      else if (targetAction === "turn_off") actionParams = { power: "off" };
      else if (targetAction === "open") actionParams = { angle: 90, position: "open" };
      else if (targetAction === "close") actionParams = { angle: 0, position: "closed" };

      await createRuleApi(session, householdId, {
        name: name.trim(),
        condition: {
          metric,
          operator,
          value: numThreshold,
        },
        action: {
          targetDeviceId,
          action: targetAction,
          params: actionParams,
        },
        isActive: true,
      });

      setName("");
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tạo kịch bản.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={cm.overlay}>
        <View style={cm.container}>
          {/* Header */}
          <View style={cm.header}>
            <View style={cm.titleRow}>
              <Ionicons name="flash" size={20} color={color.primary} />
              <Text style={cm.title}>Tạo Kịch Bản Tự Động</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng modal"
              onPress={onClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={22} color={color.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={cm.body} contentContainerStyle={cm.bodyContent}>
            {error ? (
              <View style={cm.errorBox}>
                <Ionicons name="alert-circle" size={16} color={color.error} />
                <Text style={cm.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Rule Name */}
            <View style={cm.field}>
              <Text style={cm.label}>Tên kịch bản</Text>
              <TextInput
                style={cm.input}
                placeholder="VD: Bật quạt khi nhiệt độ phòng > 31°C"
                placeholderTextColor={color.textTertiary}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Condition Section */}
            <View style={cm.sectionBox}>
              <View style={cm.sectionTitleRow}>
                <Ionicons name="help-circle-outline" size={16} color={color.primary} />
                <Text style={cm.sectionTitle}>ĐIỀU KIỆN KÍCH HOẠT (NẾU)</Text>
              </View>

              {/* Metric Choice */}
              <View style={cm.pillRow}>
                <Pressable
                  style={[cm.pill, metric === "temperature" && cm.pillActive]}
                  onPress={() => setMetric("temperature")}
                >
                  <Text
                    style={[
                      cm.pillText,
                      metric === "temperature" && cm.pillTextActive,
                    ]}
                  >
                    🌡️ Nhiệt độ phòng
                  </Text>
                </Pressable>
                <Pressable
                  style={[cm.pill, metric === "humidity" && cm.pillActive]}
                  onPress={() => setMetric("humidity")}
                >
                  <Text
                    style={[
                      cm.pillText,
                      metric === "humidity" && cm.pillTextActive,
                    ]}
                  >
                    💧 Độ ẩm phòng
                  </Text>
                </Pressable>
              </View>

              {/* Operator & Threshold */}
              <View style={cm.conditionInputRow}>
                <View style={cm.operatorRow}>
                  <Pressable
                    style={[cm.opBtn, operator === ">" && cm.opBtnActive]}
                    onPress={() => setOperator(">")}
                  >
                    <Text
                      style={[
                        cm.opBtnText,
                        operator === ">" && cm.opBtnTextActive,
                      ]}
                    >
                      Lớn hơn (&gt;)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[cm.opBtn, operator === "<" && cm.opBtnActive]}
                    onPress={() => setOperator("<")}
                  >
                    <Text
                      style={[
                        cm.opBtnText,
                        operator === "<" && cm.opBtnTextActive,
                      ]}
                    >
                      Nhỏ hơn (&lt;)
                    </Text>
                  </Pressable>
                </View>

                <View style={cm.thresholdWrapper}>
                  <TextInput
                    style={cm.thresholdInput}
                    keyboardType="numeric"
                    value={threshold}
                    onChangeText={setThreshold}
                  />
                  <Text style={cm.thresholdUnit}>
                    {metric === "temperature" ? "°C" : "%"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Section */}
            <View style={cm.sectionBox}>
              <View style={cm.sectionTitleRow}>
                <Ionicons name="play-outline" size={16} color="#0D9488" />
                <Text style={[cm.sectionTitle, { color: "#0D9488" }]}>
                  HÀNH ĐỘNG THỰC THI (THÌ)
                </Text>
              </View>

              {/* Target Device Selector */}
              <Text style={cm.subLabel}>Chọn thiết bị:</Text>
              <View style={cm.deviceChipRow}>
                {controllableDevices.map((d) => {
                  const isChosen = d.id === targetDeviceId;
                  return (
                    <Pressable
                      key={d.id}
                      style={[cm.deviceChip, isChosen && cm.deviceChipActive]}
                      onPress={() => {
                        setTargetDeviceId(d.id);
                        if (d.deviceType === "door_servo") setTargetAction("open");
                        else setTargetAction("turn_on");
                      }}
                    >
                      <Ionicons
                        name={
                          d.deviceType === "fan"
                            ? "sync-outline"
                            : d.deviceType === "light"
                            ? "bulb-outline"
                            : "lock-open-outline"
                        }
                        size={14}
                        color={isChosen ? color.primary : color.textSecondary}
                      />
                      <Text
                        style={[
                          cm.deviceChipText,
                          isChosen && cm.deviceChipTextActive,
                        ]}
                      >
                        {d.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Action Selector */}
              <Text style={cm.subLabel}>Hành động:</Text>
              <View style={cm.actionRow}>
                {selectedDevice?.deviceType === "door_servo" ? (
                  <>
                    <Pressable
                      style={[
                        cm.actionBtn,
                        targetAction === "open" && cm.actionBtnActive,
                      ]}
                      onPress={() => setTargetAction("open")}
                    >
                      <Text
                        style={[
                          cm.actionBtnText,
                          targetAction === "open" && cm.actionBtnTextActive,
                        ]}
                      >
                        Mở cửa (90°)
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        cm.actionBtn,
                        targetAction === "close" && cm.actionBtnActive,
                      ]}
                      onPress={() => setTargetAction("close")}
                    >
                      <Text
                        style={[
                          cm.actionBtnText,
                          targetAction === "close" && cm.actionBtnTextActive,
                        ]}
                      >
                        Đóng cửa (0°)
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={[
                        cm.actionBtn,
                        targetAction === "turn_on" && cm.actionBtnActive,
                      ]}
                      onPress={() => setTargetAction("turn_on")}
                    >
                      <Text
                        style={[
                          cm.actionBtnText,
                          targetAction === "turn_on" && cm.actionBtnTextActive,
                        ]}
                      >
                        Bật thiết bị
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        cm.actionBtn,
                        targetAction === "turn_off" && cm.actionBtnActive,
                      ]}
                      onPress={() => setTargetAction("turn_off")}
                    >
                      <Text
                        style={[
                          cm.actionBtnText,
                          targetAction === "turn_off" && cm.actionBtnTextActive,
                        ]}
                      >
                        Tắt thiết bị
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Submit */}
          <View style={cm.footer}>
            <Pressable
              accessibilityRole="button"
              style={cm.cancelBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={cm.cancelBtnText}>Huỷ</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lưu kịch bản"
              style={[cm.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={cm.submitBtnText}>Tạo kịch bản</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "85%",
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...font.titleSmall,
    color: color.textPrimary,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  bodyContent: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.errorBackground,
    padding: spacing.sm,
    borderRadius: radius.md,
    gap: 6,
  },
  errorText: {
    ...font.caption,
    color: color.error,
    flex: 1,
  },
  field: {
    gap: 6,
  },
  label: {
    ...font.caption,
    fontWeight: "600",
    color: color.textSecondary,
    textTransform: "uppercase",
  },
  subLabel: {
    fontSize: 12,
    color: color.textSecondary,
    marginTop: 6,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: color.surfaceVariant,
    fontSize: 14,
    color: color.textPrimary,
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: color.surface,
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: color.primary,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: color.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: color.primary,
  },
  pillText: {
    fontSize: 12,
    color: color.textSecondary,
    fontWeight: "500",
  },
  pillTextActive: {
    color: color.primary,
    fontWeight: "700",
  },
  conditionInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 4,
  },
  operatorRow: {
    flex: 1.2,
    flexDirection: "row",
    gap: 4,
  },
  opBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: color.surfaceVariant,
  },
  opBtnActive: {
    backgroundColor: color.primary,
  },
  opBtnText: {
    fontSize: 11,
    color: color.textSecondary,
    fontWeight: "600",
  },
  opBtnTextActive: {
    color: "#fff",
  },
  thresholdWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surfaceVariant,
    paddingHorizontal: 8,
  },
  thresholdInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
    paddingVertical: 6,
    textAlign: "center",
  },
  thresholdUnit: {
    fontSize: 13,
    color: color.textSecondary,
    fontWeight: "600",
  },
  deviceChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  deviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: color.surfaceVariant,
    borderWidth: 1,
    borderColor: "transparent",
  },
  deviceChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: color.primary,
  },
  deviceChipText: {
    fontSize: 12,
    color: color.textSecondary,
  },
  deviceChipTextActive: {
    color: color.primary,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: color.surfaceVariant,
  },
  actionBtnActive: {
    backgroundColor: "#0D9488",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
  },
  actionBtnTextActive: {
    color: "#fff",
  },
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: color.surfaceVariant,
  },
  cancelBtnText: {
    ...font.button,
    color: color.textSecondary,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: color.primary,
  },
  submitBtnText: {
    ...font.button,
    color: "#fff",
  },
});
