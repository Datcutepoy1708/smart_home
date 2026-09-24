import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../core/session-provider";
import { styles as s } from "../shared/components/screen-styles";
import { color, font, radius, spacing } from "../shared/theme";

/**
 * Household selector modal — s3.png reference.
 *
 * Displays the real households[] from session.identity.
 * No thumbnail images (not in Sprint 1 API), no addresses (not in API),
 * no device counts (not available in /me endpoint), no expiry badges.
 * "Add new household" and "Manage household setup" are disabled (deferred).
 *
 * In Sprint 1, switching household is UI-only: selecting a different
 * household updates local state only and is not persisted to the backend.
 * The active household used for device fetching is always households[0].
 */



export default function HouseholdModal() {
  const { session } = useSession();
  const households = session.identity?.households ?? [];
  // Active household is always [0] in Sprint 1
  const activeId = households[0]?.id ?? null;

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: "rgba(0,0,0,0.01)" }]}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: color.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderWidth: 1,
            borderColor: color.border,
            paddingBottom: 32,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", paddingTop: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: color.borderStrong,
              }}
            />
          </View>

          {/* Header */}
          <View
            style={[
              s.row,
              {
                paddingHorizontal: spacing.xxl,
                paddingVertical: spacing.lg,
              },
            ]}
          >
            <View style={s.group}>
              <Text style={s.titleSmall}>Chọn ngôi nhà</Text>
              <Text style={font.body}>Không gian kết nối thông minh</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={24} color={color.textSecondary} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          <ScrollView
            contentContainerStyle={{
              padding: spacing.xxl,
              gap: spacing.md,
            }}
            style={{ maxHeight: 400 }}
          >
            {households.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyStateText}>
                  Bạn chưa thuộc ngôi nhà nào.
                </Text>
              </View>
            ) : null}

            {households.map((h) => {
              const isActive = h.id === activeId;
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${h.name}${isActive ? " — đang chọn" : ""}`}
                  // Sprint 1: household switching is UI-only, not backed by API
                  onPress={() => router.back()}
                  style={[
                    s.card,
                    isActive && {
                      borderColor: color.primary,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <View style={s.row}>
                    <View style={s.rowStart}>
                      {/* Avatar substitutes missing thumbnail */}
                      <View
                        style={[
                          s.avatarLarge,
                          {
                            borderRadius: radius.md,
                            backgroundColor: color.primaryLight,
                          },
                        ]}
                      >
                        <Ionicons
                          name="home"
                          size={28}
                          color={color.primary}
                        />
                      </View>

                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text style={font.label} numberOfLines={1}>
                          {h.name}
                        </Text>
                        <View style={s.roleBadge}>
                          <Text style={s.roleBadgeText}>
                            {h.role === "owner"
                              ? "Chủ nhà"
                              : h.role === "admin"
                              ? "Quản trị viên"
                              : "Khách"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Selection indicator */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.full,
                        borderWidth: 2,
                        borderColor: isActive ? color.primary : color.borderStrong,
                        backgroundColor: isActive ? color.primary : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isActive && (
                        <Ionicons name="checkmark" size={14} color={color.onPrimary} />
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Action buttons — deferred */}
          <View
            style={{
              paddingHorizontal: spacing.xxl,
              gap: spacing.md,
              paddingTop: spacing.md,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm ngôi nhà mới — chưa khả dụng"
              disabled
              style={[s.buttonOutline, { opacity: 0.4 }]}
            >
              <View style={s.rowStart}>
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={color.textTertiary}
                />
                <Text style={[s.buttonOutlineText, { color: color.textTertiary }]}>
                  Thêm ngôi nhà mới
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quản lý thiết lập ngôi nhà — chưa khả dụng"
              disabled
              style={[s.listItem, { opacity: 0.4 }]}
            >
              <View style={s.rowStart}>
                <Ionicons
                  name="settings-outline"
                  size={16}
                  color={color.textTertiary}
                />
                <Text style={[font.link, { color: color.textTertiary }]}>
                  Quản lý thiết lập ngôi nhà
                </Text>
              </View>
              <Ionicons
                name="chevron-forward-outline"
                size={16}
                color={color.textTertiary}
              />
            </Pressable>
          </View>

          {/* Cloud sync note */}
          <View
            style={[
              s.rowStart,
              {
                paddingHorizontal: spacing.xxl,
                paddingTop: spacing.sm,
                justifyContent: "center",
              },
            ]}
          >
            <Ionicons
              name="shield-outline"
              size={12}
              color={color.textTertiary}
            />
            <Text style={[font.caption, { marginLeft: spacing.xs }]}>
              Đồng bộ tự động theo thời gian thực với Cloud Bảo Mật
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
