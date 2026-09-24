import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, radius, spacing } from "../../shared/theme";
import { useSession } from "../../core/session-provider";
import {
  type EnergySummary,
  fetchEnergySummary,
  formatVnd,
} from "./energy-data";
import { EnergyAnalyticsModal } from "./energy-analytics-modal";

interface Props {
  householdId: string;
}

export function EnergyWidget({ householdId }: Props) {
  const { session } = useSession();
  const [summary, setSummary] = useState<EnergySummary | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    void loadSummary();
  }, [householdId]);

  async function loadSummary() {
    try {
      const data = await fetchEnergySummary(session, householdId);
      setSummary(data);
    } catch {
      /* ignore */
    }
  }

  if (!summary) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở bảng thống kê tiêu thụ điện năng và tiền điện"
        style={styles.card}
        onPress={() => setModalVisible(true)}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="flash" size={14} color="#fff" />
            </View>
            <Text style={styles.title}>Năng Lượng & Tiền Điện</Text>
          </View>

          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{summary.activePowerWatts} W đang tải</Text>
          </View>
        </View>

        {/* Content row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Hôm nay</Text>
            <Text style={styles.metricValue}>{summary.today.kwh} kWh</Text>
            <Text style={styles.metricSub}>{formatVnd(summary.today.costVnd)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Lũy kế tháng này</Text>
            <Text style={styles.metricValue}>{summary.thisMonth.kwh} kWh</Text>
            <Text style={styles.metricSub}>
              Bậc {summary.thisMonth.currentTier} • {formatVnd(summary.thisMonth.costVnd)}
            </Text>
          </View>
        </View>

        {/* Footer link */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            Dự kiến cả tháng: {formatVnd(summary.thisMonth.projectedCostVnd)}
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Chi tiết & Biểu đồ</Text>
            <Ionicons name="chevron-forward" size={14} color={color.primary} />
          </View>
        </View>
      </Pressable>

      <EnergyAnalyticsModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          void loadSummary();
        }}
        session={session}
        householdId={householdId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f0fdf4",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: "#dcfce7",
    alignItems: "center",
    marginBottom: spacing.xs + 2,
  },
  metricItem: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: "#e2e8f0",
    marginHorizontal: spacing.sm,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: color.textTertiary,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: color.textPrimary,
    marginTop: 1,
  },
  metricSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16a34a",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  footerText: {
    fontSize: 11,
    color: color.textSecondary,
    fontWeight: "500",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailText: {
    fontSize: 11,
    fontWeight: "700",
    color: color.primary,
  },
});
