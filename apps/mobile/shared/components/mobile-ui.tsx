import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../core/session-provider";
import { color as c } from "../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
export function IconButton({ icon, label, onPress, disabled = false }: {
  icon: IconName; label: string; onPress?: () => void; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[ui.iconButton, disabled && { opacity: 0.45 }]}>
    <Ionicons name={icon} size={22} color={c.primary} />
  </Pressable>;
}
export function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <View style={ui.avatar}><Text style={ui.avatarText}>{initials || "?"}</Text></View>;
}
export function Header({ title, back = false }: { title: string; back?: boolean }) {
  const { session } = useSession();
  return <View style={ui.header}>
    {back ? <IconButton icon="arrow-back" label="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/devices")} /> : null}
    <Text style={[ui.heading, ui.flex]}>{title}</Text>
    <IconButton icon="notifications-outline" label="Hoạt động và cảnh báo" onPress={() => router.push("/(tabs)/activity" as never)} />
    <Pressable accessibilityRole="button" accessibilityLabel="Tài khoản" onPress={() => router.push("/(tabs)/settings")}>
      <Avatar name={session.identity?.user.name ?? ""} />
    </Pressable>
  </View>;
}
export function DeferredRow({ title, detail = "Chưa khả dụng", icon }: { title: string; detail?: string; icon?: IconName }) {
  return <Pressable disabled accessibilityRole="button" accessibilityState={{ disabled: true }} style={ui.settingRow}>
    {icon ? <Ionicons name={icon} size={21} color={c.textTertiary} /> : null}
    <View style={ui.flex}><Text style={ui.label}>{title}</Text><Text style={ui.caption}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
  </Pressable>;
}
export function Segments({ options, value, onChange, disabled = false }: {
  options: readonly string[]; value?: string; onChange?: (value: string) => void; disabled?: boolean;
}) {
  return <View style={ui.segments}>{options.map(option => <Pressable key={option}
    accessibilityRole="button" accessibilityState={{ selected: option === value, disabled }}
    disabled={disabled} onPress={() => onChange?.(option)}
    style={[ui.segment, option === value && ui.selected]}>
    <Text style={[ui.segmentText, option === value && { color: c.primary }, disabled && { color: c.textTertiary }]}>{option}</Text>
  </Pressable>)}</View>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, gap: 20, paddingBottom: 40, width: "100%", maxWidth: 680, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border },
  heading: { fontSize: 22, fontWeight: "700", color: c.textPrimary, letterSpacing: 0 },
  section: { fontSize: 18, fontWeight: "700", color: c.textPrimary },
  label: { fontSize: 15, fontWeight: "600", color: c.textPrimary, lineHeight: 22 },
  caption: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 18, gap: 14, borderWidth: 1, borderColor: c.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "700", color: c.primary },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 17, gap: 14, borderBottomWidth: 1, borderColor: c.border, minHeight: 64 },
  segments: { flexDirection: "row", backgroundColor: c.primaryLight, borderRadius: 10, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 5, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  selected: { backgroundColor: c.surface },
  segmentText: { color: c.textSecondary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  button: { minHeight: 48, padding: 14, borderRadius: 10, backgroundColor: c.primaryLight, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "600", color: c.primary, textAlign: "center" },
  empty: { paddingVertical: 44, gap: 8, alignItems: "center" },
  error: { color: c.error, fontSize: 14, lineHeight: 21 },
});
