import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../../core/session-provider";
import ScreenHeader from "../../shared/components/screen-header";
import { color, font, radius, spacing } from "../../shared/theme";
import { formatRelativeVnTime } from "../../shared/date-utils";

export interface ActivityItem {
  id: string;
  type: "COMMAND" | "AUTOMATION" | "ALERT";
  title: string;
  detail?: string;
  deviceId?: string;
  deviceName: string;
  deviceType: string;
  source: string;
  status: string;
  actor: string;
  timestamp: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatRelativeTime(isoString: string): string {
  return formatRelativeVnTime(isoString);
}

type FilterKey = "all" | "command" | "automation" | "alert";

export default function ActivityScreen() {
  const { session } = useSession();
  const userName = session.identity?.user.name ?? "";
  const userInitials = initials(userName);
  const householdId = session.identity?.households[0]?.id;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const loadData = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const raw = (await session.get(
        `/households/${householdId}/activity?limit=50`
      )) as { items?: ActivityItem[] };
      setActivities(Array.isArray(raw?.items) ? raw.items : []);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Không thể tải nhật ký hoạt động."
      );
    } finally {
      setLoading(false);
    }
  }, [session, householdId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const filtered = activities.filter((act) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "command") return act.type === "COMMAND";
    if (activeFilter === "automation") return act.type === "AUTOMATION";
    if (activeFilter === "alert") return act.type === "ALERT";
    return true;
  });

  const counts: Record<FilterKey, number> = {
    all: activities.length,
    command: activities.filter((a) => a.type === "COMMAND").length,
    automation: activities.filter((a) => a.type === "AUTOMATION").length,
    alert: activities.filter((a) => a.type === "ALERT").length,
  };

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: `Tất cả (${counts.all})` },
    { key: "command", label: `Điều khiển (${counts.command})` },
    { key: "automation", label: `Tự động (${counts.automation})` },
    { key: "alert", label: `Cảnh báo (${counts.alert})` },
  ];

  function getDeviceIcon(deviceType: string, type: string) {
    if (type === "ALERT") return "warning-outline";
    if (deviceType.includes("door")) return "lock-closed-outline";
    if (deviceType.includes("fan")) return "sync-outline";
    if (deviceType.includes("light")) return "bulb-outline";
    if (deviceType.includes("sensor") || deviceType.includes("dht"))
      return "thermometer-outline";
    return "hardware-chip-outline";
  }

  function getStatusBadge(status: string) {
    const s = status.toUpperCase();
    if (s === "ACKNOWLEDGED" || s === "SUCCESS" || s === "SUCCEEDED") {
      return {
        text: "Thành công",
        bg: "#F0FDF4",
        color: "#166534",
        border: "#BBF7D0",
      };
    }
    if (s === "TIMEOUT") {
      return {
        text: "Hết giờ (Timeout)",
        bg: "#FEF2F2",
        color: "#991B1B",
        border: "#FECACA",
      };
    }
    if (s === "FAILED") {
      return {
        text: "Thất bại",
        bg: "#FEF2F2",
        color: "#991B1B",
        border: "#FECACA",
      };
    }
    return {
      text: "Đang gửi",
      bg: "#FFFBEB",
      color: "#92400E",
      border: "#FDE68A",
    };
  }

  return (
    <View style={act.screen}>
      <ScreenHeader
        title="Hoạt động & Nhật ký"
        initials={userInitials}
        showBell={false}
      />

      <ScrollView
        style={act.screen}
        contentContainerStyle={act.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={color.primary}
          />
        }
      >
        {/* Subtitle */}
        <View style={act.headerSection}>
          <Text style={act.kicker}>NHẬT KÝ THỜI GIAN THỰC</Text>
          <Text style={act.titleLarge}>Dòng sự kiện ngôi nhà</Text>
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={act.filterScroll}
        >
          {filters.map(({ key, label }) => {
            const isActive = activeFilter === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                style={[act.chip, isActive ? act.chipActive : act.chipInactive]}
                onPress={() => setActiveFilter(key)}
              >
                <Text
                  style={[
                    act.chipText,
                    isActive ? act.chipActiveText : act.chipInactiveText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Error message */}
        {error ? (
          <View style={act.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={color.error} />
            <Text style={act.errorText}>{error}</Text>
            <Pressable style={act.retryBtn} onPress={loadData}>
              <Text style={act.retryBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Loading Spinner */}
        {loading && activities.length === 0 ? (
          <View style={act.loadingBox}>
            <ActivityIndicator color={color.primary} size="large" />
            <Text style={act.loadingText}>Đang tải dòng thời gian...</Text>
          </View>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <View style={act.emptyCard}>
            <Ionicons
              name="newspaper-outline"
              size={52}
              color={color.textTertiary}
            />
            <Text style={act.emptyTitle}>Chưa có hoạt động nào</Text>
            <Text style={act.emptySubtitle}>
              Các thao tác điều khiển thiết bị hoặc kích hoạt tự động sẽ xuất hiện tại đây theo thời gian thực.
            </Text>
          </View>
        ) : (
          /* Timeline Feed */
          <View style={act.timeline}>
            {filtered.map((item, index) => {
              const icon = getDeviceIcon(item.deviceType, item.type);
              const badge = getStatusBadge(item.status);
              const isLast = index === filtered.length - 1;

              return (
                <View key={item.id} style={act.timelineItem}>
                  {/* Left Column: Icon & Line */}
                  <View style={act.lineCol}>
                    <View
                      style={[
                        act.iconCircle,
                        item.type === "AUTOMATION"
                          ? { backgroundColor: "#F3E8FF" }
                          : item.type === "ALERT"
                          ? { backgroundColor: "#FFE4E6" }
                          : { backgroundColor: "#EFF6FF" },
                      ]}
                    >
                      <Ionicons
                        name={icon as any}
                        size={17}
                        color={
                          item.type === "AUTOMATION"
                            ? "#7E22CE"
                            : item.type === "ALERT"
                            ? "#BE123C"
                            : color.primary
                        }
                      />
                    </View>
                    {!isLast && <View style={act.verticalLine} />}
                  </View>

                  {/* Right Column: Card Content */}
                  <View style={act.cardContent}>
                    <View style={act.cardHeader}>
                      <Text style={act.itemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={act.itemTime}>
                        {formatRelativeTime(item.timestamp)}
                      </Text>
                    </View>

                    {item.detail ? (
                      <Text style={act.itemDetail}>{item.detail}</Text>
                    ) : null}

                    <View style={act.cardFooter}>
                      {/* Actor Badge */}
                      <View style={act.actorBadge}>
                        <Ionicons
                          name={
                            item.type === "AUTOMATION"
                              ? "flash"
                              : "person-outline"
                          }
                          size={12}
                          color={color.textSecondary}
                        />
                        <Text style={act.actorText}>{item.actor}</Text>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={[
                          act.statusBadge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Text
                          style={[act.statusText, { color: badge.color }]}
                        >
                          {badge.text}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const act = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  headerSection: {
    gap: 2,
  },
  kicker: {
    ...font.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: color.textSecondary,
  },
  titleLarge: {
    ...font.title,
    color: color.textPrimary,
  },
  filterScroll: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  chipInactive: {
    backgroundColor: color.surface,
    borderColor: color.border,
  },
  chipText: {
    ...font.caption,
    fontWeight: "600",
  },
  chipActiveText: {
    color: "#fff",
  },
  chipInactiveText: {
    color: color.textSecondary,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.errorBackground,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  errorText: {
    ...font.caption,
    color: color.error,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
  },
  retryBtnText: {
    fontSize: 12,
    color: color.error,
    fontWeight: "600",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  loadingText: {
    ...font.caption,
    color: color.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyTitle: {
    ...font.titleSmall,
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...font.caption,
    color: color.textSecondary,
    textAlign: "center",
    maxWidth: 270,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing.md,
  },
  lineCol: {
    alignItems: "center",
    width: 36,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.border,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: color.border,
    marginVertical: 4,
  },
  cardContent: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: spacing.md,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  itemTitle: {
    ...font.body,
    fontWeight: "700",
    color: color.textPrimary,
    flex: 1,
  },
  itemTime: {
    fontSize: 11,
    color: color.textTertiary,
  },
  itemDetail: {
    ...font.caption,
    color: color.error,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  actorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: color.surfaceVariant,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  actorText: {
    fontSize: 11,
    color: color.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
