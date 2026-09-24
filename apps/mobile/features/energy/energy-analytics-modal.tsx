import { useEffect, useState } from "react";
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
import { color, radius, spacing } from "../../shared/theme";
import type { Session } from "../../core/session";
import {
  type DeviceEnergyBreakdown,
  type DeviceEnergyItem,
  type EnergyChartData,
  type EnergySummary,
  fetchEnergyBreakdown,
  fetchEnergyChart,
  fetchEnergySummary,
  formatVnd,
  updateDeviceWattage,
} from "./energy-data";

interface Props {
  visible: boolean;
  onClose: () => void;
  session: Session;
  householdId: string;
}

export function EnergyAnalyticsModal({
  visible,
  onClose,
  session,
  householdId,
}: Props) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<EnergySummary | null>(null);
  const [chartData, setChartData] = useState<EnergyChartData | null>(null);
  const [breakdown, setBreakdown] = useState<DeviceEnergyBreakdown | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Edit wattage modal state
  const [editingDevice, setEditingDevice] = useState<DeviceEnergyItem | null>(null);
  const [inputWatt, setInputWatt] = useState("");
  const [savingWatt, setSavingWatt] = useState(false);

  useEffect(() => {
    if (!visible || !householdId) return;
    void loadAllData(period);
  }, [visible, householdId, period]);

  async function loadAllData(currentPeriod: "today" | "week" | "month") {
    setLoading(true);
    try {
      const [sum, ch, bd] = await Promise.all([
        fetchEnergySummary(session, householdId),
        fetchEnergyChart(session, householdId, currentPeriod),
        fetchEnergyBreakdown(session, householdId, currentPeriod),
      ]);
      setSummary(sum);
      setChartData(ch);
      setBreakdown(bd);
      setSelectedPointIndex(null);
    } catch {
      /* best-effort error handling */
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWattage() {
    if (!editingDevice) return;
    const num = parseInt(inputWatt, 10);
    if (isNaN(num) || num <= 0) return;

    setSavingWatt(true);
    try {
      await updateDeviceWattage(session, householdId, editingDevice.deviceId, num);
      setEditingDevice(null);
      await loadAllData(period);
    } catch {
      /* ignore */
    } finally {
      setSavingWatt(false);
    }
  }

  const points = chartData?.points ?? [];
  const maxKwh = Math.max(0.01, ...points.map((p) => p.kwh));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.energyBadge}>
                <Ionicons name="flash" size={16} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Thống Kê Điện & Tiền Điện</Text>
                <Text style={styles.headerSubtitle}>
                  Biểu giá điện 6 bậc EVN • Lũy kế thời gian thực
                </Text>
              </View>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={24} color={color.textTertiary} />
            </Pressable>
          </View>

          {/* Period Filter Tabs */}
          <View style={styles.tabBar}>
            {(
              [
                { key: "today", label: "Hôm nay (24h)" },
                { key: "week", label: "7 ngày qua" },
                { key: "month", label: "Tháng này" },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.key}
                style={[
                  styles.tabItem,
                  period === t.key && styles.tabItemActive,
                ]}
                onPress={() => setPeriod(t.key)}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    period === t.key && styles.tabItemTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {loading && !summary ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={color.primary} />
                <Text style={styles.loadingText}>Đang tổng hợp dữ liệu điện năng...</Text>
              </View>
            ) : null}

            {summary && (
              <>
                {/* KPI Overview Cards */}
                <View style={styles.kpiRow}>
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>
                      {period === "today"
                        ? "HÔM NAY"
                        : period === "week"
                        ? "7 NGÀY QUA"
                        : "THÁNG NÀY"}
                    </Text>
                    <Text style={styles.kpiValue}>
                      {period === "today"
                        ? `${summary.today.kwh} kWh`
                        : `${summary.thisMonth.kwh} kWh`}
                    </Text>
                    <Text style={styles.kpiSubValue}>
                      {period === "today"
                        ? formatVnd(summary.today.costVnd)
                        : formatVnd(summary.thisMonth.costVnd)}
                    </Text>
                  </View>

                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>ĐANG TẢI (TỨC THỜI)</Text>
                    <Text style={[styles.kpiValue, { color: "#ea580c" }]}>
                      {summary.activePowerWatts} W
                    </Text>
                    <Text style={styles.kpiSubValue}>
                      {summary.activeDeviceCount} thiết bị đang bật
                    </Text>
                  </View>
                </View>

                {/* EVN Tier Progress Gauge */}
                <View style={styles.tierCard}>
                  <View style={styles.tierHeader}>
                    <View style={styles.tierRow}>
                      <Ionicons name="speedometer-outline" size={18} color="#16a34a" />
                      <Text style={styles.tierTitle}>
                        Bậc EVN Hiện Tại: Bậc {summary.thisMonth.currentTier}
                      </Text>
                    </View>
                    <Text style={styles.tierPriceTag}>
                      {formatVnd(summary.thisMonth.tierPrice)}/kWh
                    </Text>
                  </View>

                  {/* Visual 6-tier stepped progress bar */}
                  <View style={styles.tierTrack}>
                    {[1, 2, 3, 4, 5, 6].map((t) => (
                      <View
                        key={t}
                        style={[
                          styles.tierStep,
                          t <= summary.thisMonth.currentTier
                            ? t <= 2
                              ? styles.tierStepGreen
                              : t <= 4
                              ? styles.tierStepYellow
                              : styles.tierStepRed
                            : styles.tierStepInactive,
                        ]}
                      />
                    ))}
                  </View>

                  <View style={styles.tierFooter}>
                    <Text style={styles.tierInfoText}>
                      Còn{" "}
                      <Text style={{ fontWeight: "700", color: color.textPrimary }}>
                        {summary.thisMonth.nextTierKwh} kWh
                      </Text>{" "}
                      nữa sẽ chuyển bậc giá kế tiếp.
                    </Text>
                    <Text style={styles.projectedText}>
                      Dự kiến cả tháng: {formatVnd(summary.thisMonth.projectedCostVnd)}
                    </Text>
                  </View>
                </View>

                {/* Energy Chart Section */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.sectionTitle}>
                      BIỂU ĐỒ TIÊU THỤ THEO {period === "today" ? "GIỜ (24H)" : period === "week" ? "NGÀY" : "THÁNG"}
                    </Text>
                    {chartData?.peakHour ? (
                      <View style={styles.peakPill}>
                        <Ionicons name="flame" size={12} color="#dc2626" />
                        <Text style={styles.peakPillText}>
                          Đỉnh: {chartData.peakHour}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Selected Bar Popover */}
                  {selectedPointIndex !== null && points[selectedPointIndex] ? (
                    <View style={styles.popover}>
                      <Text style={styles.popoverText}>
                        Thời điểm {points[selectedPointIndex].label}:{" "}
                        <Text style={{ fontWeight: "700" }}>
                          {points[selectedPointIndex].kwh} kWh
                        </Text>{" "}
                        (~{formatVnd(points[selectedPointIndex].costVnd)})
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.chartHint}>
                      Chạm vào cột để xem số kWh và tiền điện tại thời điểm đó
                    </Text>
                  )}

                  {/* Bar Chart Container */}
                  <View style={styles.barsContainer}>
                    {points.map((p, idx) => {
                      const heightPercent = Math.max(
                        4,
                        Math.min(100, Math.round((p.kwh / maxKwh) * 100)),
                      );
                      const isSelected = selectedPointIndex === idx;

                      return (
                        <Pressable
                          key={p.label + idx}
                          style={styles.barColumn}
                          onPress={() => setSelectedPointIndex(idx)}
                        >
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                { height: `${heightPercent}%` },
                                p.isPeak && styles.barFillPeak,
                                isSelected && styles.barFillSelected,
                              ]}
                            />
                          </View>
                          {/* Label every 4th bar in today or every bar in week */}
                          {(period === "week" || idx % 4 === 0) ? (
                            <Text style={styles.barLabel}>{p.label}</Text>
                          ) : (
                            <Text style={styles.barLabelPlaceholder}>•</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Device Breakdown List */}
                <View style={styles.breakdownCard}>
                  <Text style={styles.sectionTitle}>
                    XẾP HẠNG TIÊU THỤ THEO THIẾT BỊ
                  </Text>

                  {breakdown?.devices.map((dev) => (
                    <View key={dev.deviceId} style={styles.deviceRow}>
                      <View style={styles.deviceIconBox}>
                        <Ionicons
                          name={
                            dev.deviceType === "LIGHT"
                              ? "bulb"
                              : dev.deviceType === "FAN"
                              ? "aperture"
                              : "lock-closed"
                          }
                          size={18}
                          color={color.primary}
                        />
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={styles.deviceNameRow}>
                          <Text style={styles.deviceName} numberOfLines={1}>
                            {dev.deviceName}
                          </Text>
                          {dev.isCurrentlyOn ? (
                            <View style={styles.liveOnPill}>
                              <Text style={styles.liveOnText}>Đang bật</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.deviceSub}>
                          {dev.room ? `${dev.room} • ` : ""}
                          {dev.runningMinutes >= 60
                            ? `${Math.floor(dev.runningMinutes / 60)}h ${dev.runningMinutes % 60}m`
                            : `${dev.runningMinutes}m`}{" "}
                          hoạt động
                        </Text>

                        {/* Progress Bar of total power */}
                        <View style={styles.deviceProgressTrack}>
                          <View
                            style={[
                              styles.deviceProgressFill,
                              { width: `${Math.max(2, dev.percentage)}%` },
                            ]}
                          />
                        </View>
                      </View>

                      {/* Right: Wattage and edit button */}
                      <View style={styles.deviceRight}>
                        <Text style={styles.deviceCost}>
                          {formatVnd(dev.costVnd)}
                        </Text>
                        <Text style={styles.deviceKwh}>
                          {dev.kwh} kWh ({dev.percentage}%)
                        </Text>
                        <Pressable
                          style={styles.wattButton}
                          onPress={() => {
                            setEditingDevice(dev);
                            setInputWatt(String(dev.wattage));
                          }}
                        >
                          <Ionicons name="hardware-chip-outline" size={11} color={color.primary} />
                          <Text style={styles.wattButtonText}>{dev.wattage}W</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Eco Savings Tip Card */}
                <View style={styles.ecoTipCard}>
                  <View style={styles.ecoIconBox}>
                    <Ionicons name="leaf" size={18} color="#16a34a" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.ecoTitle}>Mẹo Tiết Kiệm Năng Lượng</Text>
                    <Text style={styles.ecoBody}>
                      Sử dụng chế độ **Hẹn Giờ Tự Tắt (Countdown)** khi đi ngủ để quạt
                      và đèn tự ngắt sau 1-2 tiếng, có thể giúp gia đình tiết kiệm tới
                      25% tiền điện hàng tháng!
                    </Text>
                  </View>
                </View>
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>

          {/* Inline Edit Wattage Modal */}
          {editingDevice && (
            <Modal visible transparent animationType="fade">
              <View style={styles.editBackdrop}>
                <View style={styles.editDialog}>
                  <Text style={styles.editTitle}>
                    Cài Đặt Công Suất ({editingDevice.deviceName})
                  </Text>
                  <Text style={styles.editSubtitle}>
                    Nhập công suất thực tế theo bóng đèn hoặc quạt của bạn:
                  </Text>

                  <View style={styles.presetRow}>
                    {[15, 20, 45, 55, 75, 100].map((w) => (
                      <Pressable
                        key={w}
                        style={[
                          styles.presetChip,
                          inputWatt === String(w) && styles.presetChipActive,
                        ]}
                        onPress={() => setInputWatt(String(w))}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            inputWatt === String(w) && styles.presetChipTextActive,
                          ]}
                        >
                          {w}W
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    style={styles.wattInput}
                    value={inputWatt}
                    onChangeText={setInputWatt}
                    keyboardType="numeric"
                    placeholder="Công suất (Watt)"
                  />

                  <View style={styles.dialogActions}>
                    <Pressable
                      style={styles.dialogCancel}
                      onPress={() => setEditingDevice(null)}
                    >
                      <Text style={styles.dialogCancelText}>Hủy</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dialogSave}
                      onPress={handleSaveWattage}
                      disabled={savingWatt}
                    >
                      {savingWatt ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.dialogSaveText}>Lưu Công Suất</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "92%",
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
    gap: spacing.sm,
  },
  energyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: color.textTertiary,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: color.surfaceVariant,
    gap: spacing.xs,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: "center",
  },
  tabItemActive: {
    backgroundColor: color.surface,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
  },
  tabItemTextActive: {
    color: color.primary,
    fontWeight: "700",
  },
  body: {
    padding: spacing.md,
  },
  centerLoading: {
    alignItems: "center",
    paddingVertical: 40,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    color: color.textSecondary,
  },
  kpiRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: color.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: color.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "800",
    color: color.textPrimary,
  },
  kpiSubValue: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
    marginTop: 2,
  },
  tierCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: spacing.md,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tierTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  tierPriceTag: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
  },
  tierTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#dcfce7",
    overflow: "hidden",
    gap: 3,
    marginBottom: 8,
  },
  tierStep: {
    flex: 1,
    borderRadius: 2,
  },
  tierStepGreen: {
    backgroundColor: "#16a34a",
  },
  tierStepYellow: {
    backgroundColor: "#eab308",
  },
  tierStepRed: {
    backgroundColor: "#dc2626",
  },
  tierStepInactive: {
    backgroundColor: "#cbd5e1",
  },
  tierFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  tierInfoText: {
    fontSize: 11,
    color: color.textSecondary,
  },
  projectedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803d",
  },
  chartCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: color.textTertiary,
    letterSpacing: 0.5,
  },
  peakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  peakPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b91c1c",
  },
  popover: {
    backgroundColor: color.primaryLight,
    padding: spacing.xs + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  popoverText: {
    fontSize: 11,
    color: color.primary,
  },
  chartHint: {
    fontSize: 10,
    color: color.textTertiary,
    marginBottom: spacing.xs,
    fontStyle: "italic",
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 10,
    gap: 2,
  },
  barColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: "70%",
    height: "82%",
    justifyContent: "flex-end",
    backgroundColor: color.surfaceVariant,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#38bdf8",
    borderRadius: 2,
  },
  barFillPeak: {
    backgroundColor: "#ef4444",
  },
  barFillSelected: {
    backgroundColor: color.primary,
    borderWidth: 1,
    borderColor: "#1e3a8a",
  },
  barLabel: {
    fontSize: 9,
    color: color.textSecondary,
    marginTop: 4,
  },
  barLabelPlaceholder: {
    fontSize: 8,
    color: color.border,
    marginTop: 4,
  },
  breakdownCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.surfaceVariant,
  },
  deviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textPrimary,
  },
  liveOnPill: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  liveOnText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803d",
  },
  deviceSub: {
    fontSize: 11,
    color: color.textSecondary,
  },
  deviceProgressTrack: {
    height: 4,
    backgroundColor: color.surfaceVariant,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 3,
  },
  deviceProgressFill: {
    height: "100%",
    backgroundColor: color.primary,
    borderRadius: 2,
  },
  deviceRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  deviceCost: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textPrimary,
  },
  deviceKwh: {
    fontSize: 10,
    color: color.textTertiary,
  },
  wattButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: color.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 2,
  },
  wattButtonText: {
    fontSize: 10,
    fontWeight: "700",
    color: color.primary,
  },
  ecoTipCard: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "#f0fdf4",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  ecoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  ecoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  ecoBody: {
    fontSize: 12,
    color: color.textSecondary,
    lineHeight: 18,
  },
  // Dialog
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  editDialog: {
    width: "100%",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  editTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: color.textPrimary,
    marginBottom: 4,
  },
  editSubtitle: {
    fontSize: 12,
    color: color.textSecondary,
    marginBottom: spacing.md,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
  },
  presetChipActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
  },
  presetChipTextActive: {
    color: "#fff",
  },
  wattInput: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: color.textPrimary,
    marginBottom: spacing.lg,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  dialogCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  dialogCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.textSecondary,
  },
  dialogSave: {
    backgroundColor: color.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  dialogSaveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
