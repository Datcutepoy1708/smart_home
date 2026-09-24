import { useState } from "react";
import { router } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../../core/session-provider";
import { styles as s } from "../../shared/components/screen-styles";
import ScreenHeader from "../../shared/components/screen-header";
import { color, font, radius, spacing } from "../../shared/theme";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ── Reusable list item ────────────────────────────────────────────────────────

function SettingsItem({
  icon,
  label,
  subtitle,
  trailing,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "none"}
      accessibilityLabel={
        disabled ? `${label} — chưa khả dụng` : label
      }
      disabled={!onPress || disabled}
      onPress={onPress}
      style={[
        s.listItem,
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={s.listItemLeft}>
        <View style={s.listItemIcon}>
          <Ionicons
            name={icon}
            size={18}
            color={disabled ? color.textDisabled : color.textSecondary}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[
              font.label,
              disabled ? { color: color.textDisabled } : {},
            ]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text style={font.caption}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {trailing ?? (
        onPress && !disabled ? (
          <Ionicons
            name="chevron-forward-outline"
            size={16}
            color={color.textTertiary}
          />
        ) : null
      )}
    </Pressable>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 0 }}>
      <Text style={[s.sectionHeader, { paddingHorizontal: spacing.xxl }]}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.border,
          overflow: "hidden",
          marginTop: spacing.sm,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View
      style={[s.divider, { marginLeft: spacing.xxl + 40 + spacing.md }]}
    />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const user = session.identity?.user;
  const households = session.identity?.households ?? [];
  // Use first household as primary (Sprint 1 model)
  const primaryHousehold = households[0];
  const appVersion = Constants.expoConfig?.version ?? "—";

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await session.logout();
    } catch {
      setError("Không thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const userInitials = user ? initials(user.name) : "?";

  return (
    <SafeAreaView style={s.screen}>
      <ScreenHeader title="Cài đặt" initials={userInitials} showBell />

      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { gap: spacing.xl }]}
      >
        {/* ── Profile card ── */}
        <View style={s.card}>
          <View style={s.rowStart}>
            <View style={s.avatarLarge}>
              <Text style={s.avatarTextLarge}>{userInitials}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={font.titleSmall}>{user?.name ?? "—"}</Text>
              {primaryHousehold ? (
                <View style={s.roleBadge}>
                  <Text style={s.roleBadgeText}>
                    {primaryHousehold.role === "owner"
                      ? "Chủ nhà (Owner)"
                      : primaryHousehold.role === "admin"
                      ? "Quản trị viên"
                      : "Khách"}
                  </Text>
                </View>
              ) : null}
              <Text style={font.body}>{user?.email ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* ── Household card ── */}
        {primaryHousehold ? (
          <Section title="Ngôi nhà của bạn">
            <View style={s.listItem}>
              <View style={s.listItemLeft}>
                <View style={s.listItemIcon}>
                  <Ionicons
                    name="home-outline"
                    size={18}
                    color={color.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={font.label}>{primaryHousehold.name}</Text>
                  <View style={s.rowGap}>
                    <View style={s.pillOnline}>
                      <Text style={s.pillOnlineText}>Đang hoạt động</Text>
                    </View>
                    <Text style={font.caption}>
                      {households.length > 1
                        ? `${households.length} ngôi nhà`
                        : "1 Ngôi nhà"}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chuyển ngôi nhà"
                onPress={() => router.push("/household-modal" as never)}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={20}
                  color={color.primary}
                />
              </Pressable>
            </View>

            <Divider />

            {/* Only current user shown — full member list is Sprint 2+ */}
            <View style={s.listItem}>
              <View style={s.listItemLeft}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{userInitials}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={font.label}>{user?.name ?? "—"} (Bạn)</Text>
                  <Text style={font.caption}>{user?.email ?? "—"}</Text>
                </View>
              </View>
              {primaryHousehold ? (
                <View style={s.roleBadge}>
                  <Text style={s.roleBadgeText}>
                    {primaryHousehold.role === "owner" ? "Chủ nhà" : primaryHousehold.role}
                  </Text>
                </View>
              ) : null}
            </View>

            <Divider />

            {/* Invite member — deferred */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mời thành viên mới — chưa khả dụng"
              disabled
              style={[s.listItem, { opacity: 0.4, justifyContent: "center" }]}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={color.textTertiary}
              />
              <Text style={[font.link, { marginLeft: spacing.sm, color: color.textTertiary }]}>
                Mời thành viên mới
              </Text>
            </Pressable>
          </Section>
        ) : null}

        {/* ── Account & Security ── */}
        <Section title="Tài khoản & Bảo mật">
          <SettingsItem
            icon="person-circle-outline"
            label="Thông tin cá nhân & Đổi mật khẩu"
            subtitle="Cập nhật mật khẩu bảo vệ tài khoản"
            disabled
          />
          <Divider />
          <SettingsItem
            icon="shield-checkmark-outline"
            label="Xác thực 2 bước (2FA)"
            subtitle="Chưa khả dụng trong phiên bản này"
            disabled
          />
        </Section>

        {/* ── Smart integrations ── deferred, no status displayed ── */}
        <Section title="Tích hợp thông minh">
          <SettingsItem
            icon="paper-plane-outline"
            label="Kết nối Bot Telegram"
            subtitle="Sắp ra mắt"
            disabled
          />
          <Divider />
          <SettingsItem
            icon="chatbubble-ellipses-outline"
            label="Kết nối Zalo OA"
            subtitle="Sắp ra mắt"
            disabled
          />
        </Section>

        {/* ── Notification options ── deferred (FCM Sprint 3) ── */}
        <Section title="Tuỳ chọn thông báo">
          <SettingsItem
            icon="notifications-outline"
            label="Thông báo đẩy & Cảnh báo âm thanh khẩn cấp"
            subtitle="Khả dụng sau khi tích hợp FCM (Sprint 3)"
            disabled
            trailing={
              <Switch
                value={false}
                disabled
                trackColor={{ false: color.borderStrong, true: color.primary }}
              />
            }
          />
        </Section>

        {/* ── App settings ── */}
        <Section title="Cài đặt ứng dụng">
          <SettingsItem
            icon="language-outline"
            label="Ngôn ngữ"
            subtitle="Tiếng Việt (Việt Nam)"
            disabled
          />
          <Divider />
          <SettingsItem
            icon="sunny-outline"
            label="Giao diện"
            subtitle="Sáng (Mặc định)"
            disabled
          />
          <Divider />
          <SettingsItem
            icon="information-circle-outline"
            label="Phiên bản ứng dụng"
            trailing={
              <Text style={font.caption}>v{appVersion}</Text>
            }
          />
        </Section>

        {/* ── Error ── */}
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}

        {/* ── Logout ── */}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void logout()}
          style={[s.buttonDanger, busy && { opacity: 0.6 }]}
        >
          <View style={s.rowStart}>
            <Ionicons name="log-out-outline" size={18} color={color.onPrimary} />
            <Text style={s.buttonDangerText}>
              {busy ? "Đang đăng xuất..." : "Đăng xuất tài khoản"}
            </Text>
          </View>
        </Pressable>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
