import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, font, radius, spacing } from "../../shared/theme";
import type { Session } from "../../core/session";
import { fetchScenes, triggerSceneApi, type SceneItem } from "./scenes-data";

interface Props {
  session: Session;
  householdId?: string;
  onTriggered?: () => void;
}

function getSceneIcon(name: string, iconFromData?: string): any {
  const lower = name.toLowerCase();
  if (lower.includes("về nhà") || lower.includes("home")) return "home";
  if (lower.includes("rời nhà") || lower.includes("ra ngoài") || lower.includes("away"))
    return "exit-outline";
  if (lower.includes("ngủ") || lower.includes("đêm") || lower.includes("night"))
    return "moon";
  if (lower.includes("sáng") || lower.includes("dậy") || lower.includes("morning"))
    return "sunny";
  if (lower.includes("khách") || lower.includes("party")) return "people";
  if (lower.includes("xem phim") || lower.includes("movie")) return "film-outline";
  return (iconFromData as any) || "sparkles";
}

export function QuickScenesWidget({ session, householdId, onTriggered }: Props) {
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchScenes(session, householdId!);
        if (active) setScenes(data);
      } catch {
        /* best effort */
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [session, householdId]);

  if (!householdId || (scenes.length === 0 && !loading)) {
    return null;
  }

  async function handleTrigger(scene: SceneItem) {
    if (!householdId || triggeringId) return;
    setTriggeringId(scene.id);
    try {
      await triggerSceneApi(session, householdId, scene.id);
      Alert.alert("Thành công", `Đã kích hoạt ngữ cảnh "${scene.name}".`);
      onTriggered?.();
    } catch (e: unknown) {
      Alert.alert(
        "Lỗi",
        e instanceof Error ? e.message : "Không thể kích hoạt ngữ cảnh.",
      );
    } finally {
      setTriggeringId(null);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="sparkles" size={16} color={color.primary} />
          <Text style={styles.kicker}>NGỮ CẢNH NHANH</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => router.push("/(tabs)/automation" as any)}
        >
          <Text style={styles.viewAllText}>Xem tất cả</Text>
        </Pressable>
      </View>

      {/* Content */}
      {loading && scenes.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={color.primary} />
          <Text style={styles.loadingText}>Đang tải ngữ cảnh...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        >
          {scenes.map((scene) => {
            const isRunning = triggeringId === scene.id;
            const iconName = getSceneIcon(scene.name, scene.icon);
            return (
              <Pressable
                key={scene.id}
                style={[
                  styles.sceneCard,
                  isRunning && styles.sceneCardRunning,
                ]}
                onPress={() => handleTrigger(scene)}
                disabled={isRunning}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={iconName} size={20} color={color.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.sceneName} numberOfLines={1}>
                    {scene.name}
                  </Text>
                  <Text style={styles.actionCount}>
                    {scene.actions?.length
                      ? `${scene.actions.length} thiết bị`
                      : "Ngữ cảnh"}
                  </Text>
                </View>
                <View style={[styles.triggerBtn, isRunning && { opacity: 0.6 }]}>
                  {isRunning ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="play" size={12} color="#fff" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs + 2,
    marginVertical: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: color.textSecondary,
    letterSpacing: 0.8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.primary,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontSize: 12,
    color: color.textTertiary,
  },
  scrollList: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sceneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    minWidth: 160,
    maxWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sceneCardRunning: {
    borderColor: color.primary,
    backgroundColor: color.primaryLight,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  sceneName: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textPrimary,
  },
  actionCount: {
    fontSize: 11,
    color: color.textTertiary,
    marginTop: 2,
  },
  triggerBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
