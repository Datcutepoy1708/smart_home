import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../../core/session-provider";
import { color, font, radius, spacing } from "../../shared/theme";
import { formatVnDateTime, formatVnTime } from "../../shared/date-utils";

export interface SensorReadingPoint {
  id: string;
  metric: string;
  value: number;
  unit: string;
  recordedAt: string;
}

interface SensorHistoryChartProps {
  householdId: string;
  deviceId: string;
}

export function SensorHistoryChart({
  householdId,
  deviceId,
}: SensorHistoryChartProps) {
  const { session } = useSession();
  const [metric, setMetric] = useState<"temperature" | "humidity">("temperature");
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const [readings, setReadings] = useState<SensorReadingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<SensorReadingPoint | null>(null);

  const loadData = useCallback(async () => {
    if (!householdId || !deviceId) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ metric, range, limit: "48" });
      const raw = (await session.get(
        `/households/${householdId}/devices/${deviceId}/readings?${query.toString()}`
      )) as { readings?: SensorReadingPoint[] };

      const items = Array.isArray(raw?.readings) ? raw.readings : [];
      setReadings(items);
      setSelectedPoint(items.length > 0 ? items[items.length - 1] : null);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Không thể tải dữ liệu lịch sử."
      );
    } finally {
      setLoading(false);
    }
  }, [session, householdId, deviceId, metric, range]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (readings.length === 0) {
      return { current: null, min: null, max: null, avg: null };
    }
    const values = readings.map((r) => r.value);
    const current = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Number((sum / values.length).toFixed(1));
    return { current, min, max, avg };
  }, [readings]);

  // Normalize points for bar/chart visualization
  const chartData = useMemo(() => {
    if (readings.length === 0) return [];
    const values = readings.map((r) => r.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const span = maxVal - minVal || 1;

    return readings.map((r) => {
      const heightPercent = Math.max(
        15,
        Math.min(100, Math.round(((r.value - minVal) / span) * 85 + 15))
      );
      const timeLabel = formatVnTime(r.recordedAt);
      return {
        ...r,
        heightPercent,
        timeLabel,
      };
    });
  }, [readings]);

  const unit = metric === "temperature" ? "°C" : "%";
  const themeColor = metric === "temperature" ? color.primary : "#0D9488";

  return (
    <View style={ch.card}>
      {/* Header with Title and Range Picker */}
      <View style={ch.headerRow}>
        <View style={ch.titleRow}>
          <Ionicons
            name="stats-chart"
            size={18}
            color={themeColor}
            style={{ marginRight: 6 }}
          />
          <Text style={ch.cardTitle}>Biểu Đồ Lịch Sử</Text>
        </View>

        {/* Range Buttons (24h / 7d) */}
        <View style={ch.rangePills}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem 24 giờ qua"
            style={[ch.rangeButton, range === "24h" && ch.rangeButtonActive]}
            onPress={() => setRange("24h")}
          >
            <Text
              style={[
                ch.rangeButtonText,
                range === "24h" && ch.rangeButtonTextActive,
              ]}
            >
              24 Giờ
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem 7 ngày qua"
            style={[ch.rangeButton, range === "7d" && ch.rangeButtonActive]}
            onPress={() => setRange("7d")}
          >
            <Text
              style={[
                ch.rangeButtonText,
                range === "7d" && ch.rangeButtonTextActive,
              ]}
            >
              7 Ngày
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Metric Selector Tabs */}
      <View style={ch.metricTabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Chuyển sang đo nhiệt độ"
          style={[
            ch.metricTab,
            metric === "temperature" && ch.metricTabActiveTemp,
          ]}
          onPress={() => setMetric("temperature")}
        >
          <Ionicons
            name="thermometer-outline"
            size={16}
            color={metric === "temperature" ? color.primary : color.textSecondary}
          />
          <Text
            style={[
              ch.metricTabText,
              metric === "temperature" && ch.metricTabTextActive,
            ]}
          >
            Nhiệt độ (°C)
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Chuyển sang đo độ ẩm"
          style={[
            ch.metricTab,
            metric === "humidity" && ch.metricTabActiveHumid,
          ]}
          onPress={() => setMetric("humidity")}
        >
          <Ionicons
            name="water-outline"
            size={16}
            color={metric === "humidity" ? "#0D9488" : color.textSecondary}
          />
          <Text
            style={[
              ch.metricTabText,
              metric === "humidity" && ch.metricTabTextActiveHumid,
            ]}
          >
            Độ ẩm (%)
          </Text>
        </Pressable>
      </View>

      {/* Stats Summary Grid */}
      <View style={ch.statsRow}>
        <View style={ch.statBox}>
          <Text style={ch.statLabel}>Hiện tại</Text>
          <Text style={[ch.statValue, { color: themeColor }]}>
            {stats.current !== null ? `${stats.current}${unit}` : "—"}
          </Text>
        </View>
        <View style={ch.statBox}>
          <Text style={ch.statLabel}>Trung bình</Text>
          <Text style={ch.statValue}>
            {stats.avg !== null ? `${stats.avg}${unit}` : "—"}
          </Text>
        </View>
        <View style={ch.statBox}>
          <Text style={ch.statLabel}>Cao nhất</Text>
          <Text style={[ch.statValue, { color: "#E11D48" }]}>
            {stats.max !== null ? `▲ ${stats.max}${unit}` : "—"}
          </Text>
        </View>
        <View style={ch.statBox}>
          <Text style={ch.statLabel}>Thấp nhất</Text>
          <Text style={[ch.statValue, { color: "#2563EB" }]}>
            {stats.min !== null ? `▼ ${stats.min}${unit}` : "—"}
          </Text>
        </View>
      </View>

      {/* Selected Point Banner */}
      {selectedPoint && (
        <View style={ch.tooltipBanner}>
          <Ionicons name="time-outline" size={14} color={color.textSecondary} />
          <Text style={ch.tooltipTime}>
            {formatVnDateTime(selectedPoint.recordedAt)}
          </Text>
          <Text style={ch.tooltipDivider}>•</Text>
          <Text style={[ch.tooltipValue, { color: themeColor }]}>
            {selectedPoint.value} {unit}
          </Text>
        </View>
      )}

      {/* Chart Visual Area */}
      {loading && readings.length === 0 ? (
        <View style={ch.loadingState}>
          <ActivityIndicator color={themeColor} />
          <Text style={ch.loadingText}>Đang tải lịch sử đo đạc...</Text>
        </View>
      ) : error ? (
        <View style={ch.emptyState}>
          <Ionicons name="alert-circle-outline" size={32} color={color.error} />
          <Text style={ch.emptyText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={ch.retryButton}
            onPress={loadData}
          >
            <Text style={ch.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : readings.length === 0 ? (
        <View style={ch.emptyState}>
          <Ionicons name="hourglass-outline" size={32} color={color.textTertiary} />
          <Text style={ch.emptyText}>Chưa có đủ dữ liệu lịch sử cho mốc này.</Text>
        </View>
      ) : (
        <View style={ch.chartContainer}>
          {/* Y-axis labels */}
          <View style={ch.yAxis}>
            <Text style={ch.yAxisLabel}>{stats.max} {unit}</Text>
            <Text style={ch.yAxisLabel}>{stats.avg} {unit}</Text>
            <Text style={ch.yAxisLabel}>{stats.min} {unit}</Text>
          </View>

          {/* Scrollable Bar/Timeline Chart */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ch.barsScrollContent}
          >
            {chartData.map((pt) => {
              const isSelected = selectedPoint?.id === pt.id;
              return (
                <Pressable
                  key={pt.id}
                  style={ch.barColumn}
                  onPress={() => setSelectedPoint(pt)}
                >
                  <View style={ch.barTrack}>
                    <View
                      style={[
                        ch.barFill,
                        {
                          height: `${pt.heightPercent}%`,
                          backgroundColor: isSelected
                            ? themeColor
                            : `${themeColor}99`,
                          borderTopWidth: isSelected ? 3 : 0,
                          borderColor: isSelected ? "#0F172A" : "transparent",
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      ch.barTimeLabel,
                      isSelected && { color: themeColor, fontWeight: "700" },
                    ]}
                  >
                    {pt.timeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const ch = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: color.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    ...font.titleSmall,
    color: color.textPrimary,
  },
  rangePills: {
    flexDirection: "row",
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    padding: 2,
  },
  rangeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  rangeButtonActive: {
    backgroundColor: color.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  rangeButtonText: {
    ...font.caption,
    color: color.textSecondary,
    fontSize: 11,
  },
  rangeButtonTextActive: {
    color: color.textPrimary,
    fontWeight: "600",
  },
  metricTabs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: color.surfaceVariant,
    gap: 6,
  },
  metricTabActiveTemp: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  metricTabActiveHumid: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#0D9488",
  },
  metricTabText: {
    ...font.caption,
    color: color.textSecondary,
    fontWeight: "500",
  },
  metricTabTextActive: {
    color: color.primary,
    fontWeight: "700",
  },
  metricTabTextActiveHumid: {
    color: "#0F766E",
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: color.textTertiary,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textPrimary,
  },
  tooltipBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceVariant,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  tooltipTime: {
    ...font.caption,
    color: color.textSecondary,
    marginLeft: 4,
  },
  tooltipDivider: {
    marginHorizontal: 6,
    color: color.textTertiary,
  },
  tooltipValue: {
    ...font.caption,
    fontWeight: "700",
  },
  chartContainer: {
    flexDirection: "row",
    height: 170,
    alignItems: "stretch",
    marginTop: spacing.xs,
  },
  yAxis: {
    justifyContent: "space-between",
    paddingRight: 8,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: color.border,
  },
  yAxisLabel: {
    fontSize: 10,
    color: color.textTertiary,
  },
  barsScrollContent: {
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    alignItems: "flex-end",
    gap: 10,
  },
  barColumn: {
    width: 24,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: 14,
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: radius.sm,
  },
  barTimeLabel: {
    fontSize: 9,
    color: color.textTertiary,
    marginTop: 6,
  },
  loadingState: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    ...font.caption,
    color: color.textSecondary,
  },
  emptyState: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  emptyText: {
    ...font.caption,
    color: color.textTertiary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceVariant,
  },
  retryText: {
    ...font.caption,
    color: color.primary,
    fontWeight: "600",
  },
});
