import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenHeader from "../../shared/components/screen-header";
import { useSession } from "../../core/session-provider";
import { color, font, radius, spacing } from "../../shared/theme";
import {
  fetchRules,
  toggleRule,
  deleteRuleApi,
  type AutomationRule,
} from "../../features/automations/automations-data";
import { CreateRuleModal } from "../../features/automations/create-rule-modal";
import {
  fetchSchedules,
  toggleSchedule,
  deleteScheduleApi,
  triggerScheduleApi,
  formatRepeatDays,
  createScheduleApi,
  type ScheduleItem,
  type CreateScheduleInput,
} from "../../features/schedules/schedules-data";
import { CreateScheduleModal } from "../../features/schedules/create-schedule-modal";
import {
  fetchScenes,
  triggerSceneApi,
  type SceneItem,
} from "../../features/scenes/scenes-data";
import { parseDevices, type Device } from "../../features/devices/device-data";

type TabMode = "schedules" | "rules" | "scenes";

export default function AutomationScreen() {
  const { session } = useSession();
  const householdId = session.identity?.households[0]?.id;

  const [activeTab, setActiveTab] = useState<TabMode>("schedules");

  // State for Schedules
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState<string | null>(null);

  // State for Rules
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);

  // State for Scenes
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [triggeringSceneId, setTriggeringSceneId] = useState<string | null>(null);

  // Shared
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [fetchedRules, fetchedSchedules, fetchedScenes, devicesRes] =
        await Promise.all([
          fetchRules(session, householdId).catch(() => []),
          fetchSchedules(session, householdId).catch(() => []),
          fetchScenes(session, householdId).catch(() => []),
          session.get(`/households/${householdId}/devices`),
        ]);
      setRules(fetchedRules);
      setSchedules(fetchedSchedules);
      setScenes(fetchedScenes);
      const parsedDevs = parseDevices(devicesRes);
      setDevices(parsedDevs.items);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Không thể tải dữ liệu tự động hoá.",
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

  // ---------------- SCHEDULES HANDLERS ----------------
  async function handleToggleSchedule(schedule: ScheduleItem) {
    if (!householdId || togglingScheduleId) return;
    const targetState = !schedule.isActive;
    setTogglingScheduleId(schedule.id);

    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, isActive: targetState } : s))
    );

    try {
      await toggleSchedule(session, householdId, schedule.id, targetState);
    } catch (e: unknown) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, isActive: !targetState } : s))
      );
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Cập nhật hẹn giờ thất bại.");
    } finally {
      setTogglingScheduleId(null);
    }
  }

  function handleDeleteSchedule(schedule: ScheduleItem) {
    Alert.alert(
      "Xác nhận xoá hẹn giờ",
      `Bạn có chắc chắn muốn xoá hẹn giờ "${schedule.name}"?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            if (!householdId) return;
            try {
              await deleteScheduleApi(session, householdId, schedule.id);
              setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
            } catch (e: unknown) {
              Alert.alert("Lỗi", e instanceof Error ? e.message : "Xoá thất bại.");
            }
          },
        },
      ]
    );
  }

  async function handleTriggerSchedule(schedule: ScheduleItem) {
    if (!householdId || triggeringScheduleId) return;
    setTriggeringScheduleId(schedule.id);
    try {
      await triggerScheduleApi(session, householdId, schedule.id);
      Alert.alert("Thành công", `Đã gửi lệnh chạy thử hẹn giờ: "${schedule.name}".`);
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể chạy thử lệnh.");
    } finally {
      setTriggeringScheduleId(null);
    }
  }

  async function handleCreateScheduleSubmit(input: CreateScheduleInput) {
    if (!householdId) return;
    const created = await createScheduleApi(session, householdId, input);
    setSchedules((prev) => [created, ...prev]);
  }

  // ---------------- SENSOR RULES HANDLERS ----------------
  async function handleToggleRule(rule: AutomationRule) {
    if (!householdId || togglingRuleId) return;
    const targetState = !rule.isActive;
    setTogglingRuleId(rule.id);

    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, isActive: targetState } : r))
    );

    try {
      await toggleRule(session, householdId, rule.id, targetState);
    } catch (e: unknown) {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !targetState } : r))
      );
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể cập nhật kịch bản.");
    } finally {
      setTogglingRuleId(null);
    }
  }

  function handleDeleteRule(rule: AutomationRule) {
    Alert.alert(
      "Xác nhận xoá",
      `Bạn có chắc chắn muốn xoá kịch bản "${rule.name}"?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            if (!householdId) return;
            try {
              await deleteRuleApi(session, householdId, rule.id);
              setRules((prev) => prev.filter((r) => r.id !== rule.id));
            } catch (e: unknown) {
              Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể xoá kịch bản.");
            }
          },
        },
      ]
    );
  }

  // ---------------- SCENES HANDLERS ----------------
  async function handleTriggerScene(scene: SceneItem) {
    if (!householdId || triggeringSceneId) return;
    setTriggeringSceneId(scene.id);
    try {
      await triggerSceneApi(session, householdId, scene.id);
      Alert.alert("Thành công", `Đã kích hoạt ngữ cảnh "${scene.name}".`);
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể kích hoạt ngữ cảnh.");
    } finally {
      setTriggeringSceneId(null);
    }
  }

  const activeSchedulesCount = schedules.filter((s) => s.isActive).length;
  const activeRulesCount = rules.filter((r) => r.isActive).length;

  return (
    <View style={st.screen}>
      <ScreenHeader title="Tự động hoá" />

      {/* Segmented Tab Bar */}
      <View style={st.tabsContainer}>
        <Pressable
          style={[st.tabItem, activeTab === "schedules" && st.tabItemActive]}
          onPress={() => setActiveTab("schedules")}
        >
          <Ionicons
            name="time"
            size={16}
            color={activeTab === "schedules" ? color.primary : color.textTertiary}
          />
          <Text
            style={[st.tabLabel, activeTab === "schedules" && st.tabLabelActive]}
          >
            Hẹn Giờ ({activeSchedulesCount})
          </Text>
        </Pressable>

        <Pressable
          style={[st.tabItem, activeTab === "rules" && st.tabItemActive]}
          onPress={() => setActiveTab("rules")}
        >
          <Ionicons
            name="flash"
            size={16}
            color={activeTab === "rules" ? color.primary : color.textTertiary}
          />
          <Text
            style={[st.tabLabel, activeTab === "rules" && st.tabLabelActive]}
          >
            Cảm Biến ({activeRulesCount})
          </Text>
        </Pressable>

        <Pressable
          style={[st.tabItem, activeTab === "scenes" && st.tabItemActive]}
          onPress={() => setActiveTab("scenes")}
        >
          <Ionicons
            name="sparkles"
            size={16}
            color={activeTab === "scenes" ? color.primary : color.textTertiary}
          />
          <Text
            style={[st.tabLabel, activeTab === "scenes" && st.tabLabelActive]}
          >
            Ngữ Cảnh ({scenes.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={st.screen}
        contentContainerStyle={st.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={color.primary}
          />
        }
      >
        {/* Error Card */}
        {error ? (
          <View style={st.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={color.error} />
            <Text style={st.errorText}>{error}</Text>
            <Pressable style={st.retryBtn} onPress={loadData}>
              <Text style={st.retryBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ---------------- 1. TAB HẸN GIỜ (SCHEDULES) ---------------- */}
        {activeTab === "schedules" && (
          <View>
            <View style={st.headerRow}>
              <View>
                <Text style={st.kicker}>LỊCH TRÌNH THỜI GIAN</Text>
                <Text style={st.titleLarge}>Hẹn Giờ Tự Động</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={st.addButton}
                onPress={() => setScheduleModalVisible(true)}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={st.addButtonText}>Thêm hẹn giờ</Text>
              </Pressable>
            </View>

            <View style={st.banner}>
              <View style={st.bannerIconWrapper}>
                <Ionicons name="alarm-outline" size={20} color={color.primary} />
              </View>
              <View style={st.bannerContent}>
                <Text style={st.bannerTitle}>
                  {activeSchedulesCount} lịch hẹn đang hoạt động
                </Text>
                <Text style={st.bannerSubtitle}>
                  Đến đúng giờ hẹn, hệ thống sẽ tự động mở/đóng cửa, bật/tắt quạt hoặc đèn.
                </Text>
              </View>
            </View>

            {loading && schedules.length === 0 ? (
              <View style={st.loadingBox}>
                <ActivityIndicator color={color.primary} size="large" />
                <Text style={st.loadingText}>Đang tải lịch hẹn giờ...</Text>
              </View>
            ) : schedules.length === 0 ? (
              <View style={st.emptyState}>
                <Ionicons name="time-outline" size={54} color={color.textTertiary} />
                <Text style={st.emptyTitle}>Chưa có lịch hẹn giờ nào</Text>
                <Text style={st.emptySubtitle}>
                  Đặt giờ để tự động mở cửa buổi sáng (7:00), đóng cửa ban đêm (22:00) hoặc tắt đèn.
                </Text>
                <Pressable
                  style={st.emptyCreateBtn}
                  onPress={() => setScheduleModalVisible(true)}
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={st.emptyCreateBtnText}>Thêm lịch hẹn giờ đầu tiên</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.list}>
                {schedules.map((schedule) => {
                  const isDoor =
                    schedule.deviceType === "door" ||
                    schedule.deviceType === "door_servo" ||
                    schedule.deviceType === "DOOR_SERVO";
                  let actionBadge = "Bật";
                  if (schedule.action === "open") {
                    const ang = schedule.params?.angle ?? 90;
                    actionBadge = `Mở cửa (${ang}°)`;
                  } else if (schedule.action === "close") {
                    actionBadge = "Đóng cửa (0°)";
                  } else if (schedule.action === "turn_off") {
                    actionBadge = "Tắt";
                  }

                  return (
                    <View
                      key={schedule.id}
                      style={[
                        st.ruleCard,
                        !schedule.isActive && st.ruleCardInactive,
                      ]}
                    >
                      <View style={st.scheduleCardTop}>
                        {/* Big Time Display */}
                        <View style={st.scheduleTimeBox}>
                          <Text
                            style={[
                              st.scheduleTimeText,
                              !schedule.isActive && { color: color.textTertiary },
                            ]}
                          >
                            {schedule.time}
                          </Text>
                          <Text style={st.scheduleRepeatText}>
                            {formatRepeatDays(schedule.repeatDays)}
                          </Text>
                        </View>

                        {/* Switch */}
                        <Switch
                          value={schedule.isActive}
                          onValueChange={() => handleToggleSchedule(schedule)}
                          disabled={togglingScheduleId === schedule.id}
                          trackColor={{ false: color.border, true: color.primary }}
                          thumbColor="#fff"
                        />
                      </View>

                      {/* Info & Device badge */}
                      <View style={st.scheduleBody}>
                        <Text style={st.ruleName}>{schedule.name}</Text>
                        <View style={st.scheduleTagsRow}>
                          <View style={st.scheduleTag}>
                            <Ionicons
                              name={isDoor ? "key" : "hardware-chip"}
                              size={12}
                              color={color.primary}
                            />
                            <Text style={st.scheduleTagText}>
                              {schedule.deviceName || "Thiết bị"}
                            </Text>
                          </View>

                          <View
                            style={[
                              st.scheduleTag,
                              { backgroundColor: "#fef3c7" },
                            ]}
                          >
                            <Text
                              style={[
                                st.scheduleTagText,
                                { color: "#b45309" },
                              ]}
                            >
                              {actionBadge}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Footer Actions: Test Trigger & Delete */}
                      <View style={st.scheduleCardFooter}>
                        <Pressable
                          style={[
                            st.testBtn,
                            triggeringScheduleId === schedule.id && { opacity: 0.5 },
                          ]}
                          onPress={() => handleTriggerSchedule(schedule)}
                          disabled={triggeringScheduleId === schedule.id}
                        >
                          <Ionicons name="play" size={14} color={color.primary} />
                          <Text style={st.testBtnText}>
                            {triggeringScheduleId === schedule.id
                              ? "Đang chạy..."
                              : "Chạy thử"}
                          </Text>
                        </Pressable>

                        <Pressable
                          hitSlop={8}
                          style={st.deleteButton}
                          onPress={() => handleDeleteSchedule(schedule)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={color.error}
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ---------------- 2. TAB CẢM BIẾN (RULES) ---------------- */}
        {activeTab === "rules" && (
          <View>
            <View style={st.headerRow}>
              <View>
                <Text style={st.kicker}>THEO NHIỆT ĐỘ & ĐỘ ẨM</Text>
                <Text style={st.titleLarge}>Kịch Bản Cảm Biến</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={st.addButton}
                onPress={() => setRuleModalVisible(true)}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={st.addButtonText}>Tạo mới</Text>
              </Pressable>
            </View>

            <View style={st.banner}>
              <View style={st.bannerIconWrapper}>
                <Ionicons name="flash-outline" size={20} color={color.primary} />
              </View>
              <View style={st.bannerContent}>
                <Text style={st.bannerTitle}>
                  {activeRulesCount} kịch bản đang hoạt động
                </Text>
                <Text style={st.bannerSubtitle}>
                  Tự động bật quạt hoặc đóng/mở khi nhiệt độ môi trường vượt ngưỡng.
                </Text>
              </View>
            </View>

            {loading && rules.length === 0 ? (
              <View style={st.loadingBox}>
                <ActivityIndicator color={color.primary} size="large" />
                <Text style={st.loadingText}>Đang tải kịch bản cảm biến...</Text>
              </View>
            ) : rules.length === 0 ? (
              <View style={st.emptyState}>
                <Ionicons name="sparkles-outline" size={54} color={color.textTertiary} />
                <Text style={st.emptyTitle}>Chưa có kịch bản cảm biến nào</Text>
                <Text style={st.emptySubtitle}>
                  Tạo kịch bản để quạt tự bật khi phòng nóng ({">"} 30°C) hoặc tự tắt khi mát.
                </Text>
                <Pressable
                  style={st.emptyCreateBtn}
                  onPress={() => setRuleModalVisible(true)}
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={st.emptyCreateBtnText}>Tạo kịch bản cảm biến</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.list}>
                {rules.map((rule) => {
                  const cond = rule.condition as any;
                  const act = rule.action as any;
                  const targetDev = devices.find((d) => d.id === act?.targetDeviceId);
                  const isDoor =
                    targetDev?.deviceType === "door" ||
                    targetDev?.deviceType === "door_servo";

                  let actionText = act?.action === "turn_on" ? "Bật" : "Tắt";
                  if (act?.action === "open") {
                    const ang = act?.params?.angle ?? 90;
                    actionText = `Mở (${ang}°)`;
                  } else if (act?.action === "close") {
                    actionText = "Đóng";
                  }

                  return (
                    <View
                      key={rule.id}
                      style={[
                        st.ruleCard,
                        !rule.isActive && st.ruleCardInactive,
                      ]}
                    >
                      <View style={st.ruleHeader}>
                        <View style={st.ruleTitleBox}>
                          <Text style={st.ruleName}>{rule.name}</Text>
                        </View>
                        <Switch
                          value={rule.isActive}
                          onValueChange={() => handleToggleRule(rule)}
                          disabled={togglingRuleId === rule.id}
                          trackColor={{ false: color.border, true: color.primary }}
                          thumbColor="#fff"
                        />
                      </View>

                      <View style={st.flowContainer}>
                        <View style={st.flowNode}>
                          <View style={st.flowIconCircle}>
                            <Ionicons
                              name={
                                cond?.metric === "humidity"
                                  ? "water-outline"
                                  : "thermometer-outline"
                              }
                              size={16}
                              color={color.primary}
                            />
                          </View>
                          <View>
                            <Text style={st.flowNodeLabel}>KHI CẢM BIẾN</Text>
                            <Text style={st.flowNodeValue}>
                              {cond?.metric === "humidity" ? "Độ ẩm" : "Nhiệt độ"}{" "}
                              {cond?.operator} {cond?.value}
                              {cond?.metric === "humidity" ? "%" : "°C"}
                            </Text>
                          </View>
                        </View>

                        <Ionicons
                          name="arrow-down"
                          size={16}
                          color={color.textTertiary}
                          style={{ marginVertical: 2, alignSelf: "center" }}
                        />

                        <View style={st.flowNode}>
                          <View
                            style={[
                              st.flowIconCircle,
                              { backgroundColor: "#fef3c7" },
                            ]}
                          >
                            <Ionicons
                              name={isDoor ? "key" : "hardware-chip-outline"}
                              size={16}
                              color="#d97706"
                            />
                          </View>
                          <View>
                            <Text style={st.flowNodeLabel}>THÌ THỰC HIỆN</Text>
                            <Text style={st.flowNodeValue}>
                              {actionText} {targetDev?.name || "thiết bị"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={st.ruleFooter}>
                        <Text style={st.ruleDate}>
                          Tạo ngày {new Date(rule.createdAt).toLocaleDateString("vi-VN")}
                        </Text>
                        <Pressable
                          hitSlop={8}
                          style={st.deleteButton}
                          onPress={() => handleDeleteRule(rule)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={color.error}
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ---------------- 3. TAB NGỮ CẢNH (SCENES) ---------------- */}
        {activeTab === "scenes" && (
          <View>
            <View style={st.headerRow}>
              <View>
                <Text style={st.kicker}>MỘT CHẠM ĐIỀU KHIỂN</Text>
                <Text style={st.titleLarge}>Ngữ Cảnh Thông Minh</Text>
              </View>
            </View>

            <View style={st.banner}>
              <View style={st.bannerIconWrapper}>
                <Ionicons name="sparkles-outline" size={20} color={color.primary} />
              </View>
              <View style={st.bannerContent}>
                <Text style={st.bannerTitle}>Kích hoạt đồng loạt thiết bị</Text>
                <Text style={st.bannerSubtitle}>
                  Chỉ cần 1 chạm để thiết lập toàn bộ ngôi nhà (Về nhà, Rời nhà, Đi ngủ...).
                </Text>
              </View>
            </View>

            {loading && scenes.length === 0 ? (
              <View style={st.loadingBox}>
                <ActivityIndicator color={color.primary} size="large" />
                <Text style={st.loadingText}>Đang tải ngữ cảnh...</Text>
              </View>
            ) : scenes.length === 0 ? (
              <View style={st.emptyState}>
                <Ionicons name="sparkles-outline" size={54} color={color.textTertiary} />
                <Text style={st.emptyTitle}>Chưa có ngữ cảnh nào</Text>
                <Text style={st.emptySubtitle}>
                  Hệ thống đang chuẩn bị các kịch bản mẫu một chạm cho bạn.
                </Text>
              </View>
            ) : (
              <View style={st.scenesGrid}>
                {scenes.map((scene) => {
                  const isRunning = triggeringSceneId === scene.id;
                  let iconName: any = "home";
                  if (scene.icon === "exit-outline") iconName = "exit";
                  if (scene.icon === "moon") iconName = "moon";
                  if (scene.icon === "people") iconName = "people";

                  return (
                    <View key={scene.id} style={st.sceneCard}>
                      <View style={st.sceneCardHeader}>
                        <View style={st.sceneIconWrapper}>
                          <Ionicons name={iconName} size={24} color={color.primary} />
                        </View>
                        <Text style={st.sceneTitle}>{scene.name}</Text>
                      </View>

                      {/* Action items list */}
                      <View style={st.sceneActionsBox}>
                        {scene.actions.map((act, i) => (
                          <Text key={i} style={st.sceneActionText} numberOfLines={1}>
                            • {act.action === "open"
                              ? `Mở ${act.deviceName || "cửa"}`
                              : act.action === "close"
                              ? `Đóng ${act.deviceName || "cửa"}`
                              : act.action === "turn_on"
                              ? `Bật ${act.deviceName || "thiết bị"}`
                              : `Tắt ${act.deviceName || "thiết bị"}`}
                          </Text>
                        ))}
                      </View>

                      <Pressable
                        style={[st.sceneTriggerBtn, isRunning && { opacity: 0.6 }]}
                        onPress={() => handleTriggerScene(scene)}
                        disabled={isRunning}
                      >
                        {isRunning ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="play" size={16} color="#fff" />
                            <Text style={st.sceneTriggerText}>Kích hoạt</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal tạo lịch hẹn giờ */}
      <CreateScheduleModal
        visible={scheduleModalVisible}
        onClose={() => setScheduleModalVisible(false)}
        onSubmit={handleCreateScheduleSubmit}
        devices={devices}
      />

      {/* Modal tạo kịch bản cảm biến */}
      <CreateRuleModal
        visible={ruleModalVisible}
        householdId={householdId || ""}
        devices={devices}
        onClose={() => setRuleModalVisible(false)}
        onCreated={() => {
          setRuleModalVisible(false);
          void loadData();
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: spacing.md,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: color.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    gap: spacing.xs,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabItemActive: {
    backgroundColor: "#eff6ff",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: color.textTertiary,
  },
  tabLabelActive: {
    color: color.primary,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    color: color.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: "800",
    color: color.textPrimary,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: color.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#eff6ff",
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  bannerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e40af",
  },
  bannerSubtitle: {
    fontSize: 11,
    color: "#3b82f6",
    marginTop: 1,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: spacing.xs,
  },
  errorText: {
    flex: 1,
    color: color.error,
    fontSize: 12,
  },
  retryBtn: {
    backgroundColor: color.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  loadingText: {
    color: color.textTertiary,
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: color.border,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 12,
    color: color.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: color.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  emptyCreateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    gap: spacing.sm + 2,
  },
  ruleCard: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  ruleCardInactive: {
    opacity: 0.65,
    backgroundColor: "#f8fafc",
  },
  scheduleCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scheduleTimeBox: {
    marginBottom: 4,
  },
  scheduleTimeText: {
    fontSize: 32,
    fontWeight: "800",
    color: color.primary,
    fontVariant: ["tabular-nums"],
  },
  scheduleRepeatText: {
    fontSize: 11,
    fontWeight: "600",
    color: color.textSecondary,
    marginTop: -2,
  },
  scheduleBody: {
    marginTop: spacing.xs,
  },
  scheduleTagsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 6,
  },
  scheduleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  scheduleTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: color.primary,
  },
  scheduleCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: color.primary,
  },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  ruleTitleBox: {
    flex: 1,
    marginRight: spacing.sm,
  },
  ruleName: {
    fontSize: 15,
    fontWeight: "700",
    color: color.textPrimary,
  },
  flowContainer: {
    backgroundColor: color.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  flowNode: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  flowIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  flowNodeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: color.textTertiary,
    letterSpacing: 0.5,
  },
  flowNodeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: color.textPrimary,
  },
  ruleFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  ruleDate: {
    fontSize: 10,
    color: color.textTertiary,
  },
  deleteButton: {
    padding: 6,
  },
  scenesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sceneCard: {
    width: "48%",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    justifyContent: "space-between",
  },
  sceneCardHeader: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  sceneIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  sceneTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
    textAlign: "center",
  },
  sceneActionsBox: {
    marginVertical: spacing.xs,
  },
  sceneActionText: {
    fontSize: 11,
    color: color.textSecondary,
    lineHeight: 16,
  },
  sceneTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: color.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  sceneTriggerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
