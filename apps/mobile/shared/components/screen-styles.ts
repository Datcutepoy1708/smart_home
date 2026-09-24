import { StyleSheet } from "react-native";
import { color, radius, spacing, font } from "../theme";

export const styles = StyleSheet.create({
  // ── Containers ──────────────────────────────────────────────────────────────
  screen: { flex: 1, backgroundColor: color.background },
  content: {
    padding: spacing.xxl,
    gap: spacing.xl,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 48,
  },
  contentNoPadding: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  scrollContent: { flexGrow: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerTitle: { ...font.title },
  headerActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },

  // ── Avatar ──────────────────────────────────────────────────────────────────
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: color.onPrimary, fontWeight: "700", fontSize: 14 },
  avatarTextLarge: { color: color.onPrimary, fontWeight: "700", fontSize: 26 },

  // ── Typography ───────────────────────────────────────────────────────────────
  title: { ...font.title },
  titleLarge: { ...font.titleLarge },
  titleSmall: { ...font.titleSmall },
  subtitle: { ...font.body },
  label: { ...font.label },
  caption: { ...font.caption },
  sectionHeader: {
    ...font.sectionHeader,
    marginTop: spacing.sm,
  },
  metricLarge: { ...font.metricLarge },
  metricMedium: { ...font.metricMedium },

  // ── Cards ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardAlert: {
    backgroundColor: color.errorBackground,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.error,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardWarning: {
    backgroundColor: color.warningBackground,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.warning,
    padding: spacing.xl,
    gap: spacing.md,
  },

  // ── Row / layout helpers ─────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  group: { gap: spacing.sm },
  spacer: { flex: 1 },

  // ── Badges / Pills ───────────────────────────────────────────────────────────
  pillOnline: {
    backgroundColor: color.onlineBackground,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillOnlineText: { ...font.caption, color: color.online, fontWeight: "600" },

  pillOffline: {
    backgroundColor: color.offlineBackground,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillOfflineText: { ...font.caption, color: color.offline, fontWeight: "600" },

  pillError: {
    backgroundColor: color.errorBackground,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillErrorText: { ...font.caption, color: color.error, fontWeight: "600" },

  pillPrimary: {
    backgroundColor: color.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillPrimaryText: { ...font.caption, color: color.onPrimary, fontWeight: "600" },

  pillNeutral: {
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: color.border,
  },
  pillNeutralText: { ...font.caption, color: color.textSecondary, fontWeight: "600" },

  roleBadge: {
    backgroundColor: color.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  roleBadgeText: { ...font.caption, color: color.primary, fontWeight: "700" },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chipActive: {
    backgroundColor: color.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActiveText: { fontSize: 13, fontWeight: "700", color: color.onPrimary },
  chipInactive: {
    backgroundColor: color.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  chipInactiveText: { fontSize: 13, fontWeight: "500", color: color.textSecondary },

  // ── Search bar ───────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: color.textPrimary,
    paddingVertical: spacing.sm,
  },

  // ── Form fields ──────────────────────────────────────────────────────────────
  field: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.sm,
    padding: 14,
    minHeight: 48,
    color: color.textPrimary,
    fontSize: 16,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  button: {
    backgroundColor: color.primary,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...font.button },
  buttonDisabled: {
    backgroundColor: color.disabledSurface,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.disabledBorder,
  },
  buttonDisabledText: { fontSize: 15, fontWeight: "600", color: color.textDisabled },
  buttonDanger: {
    backgroundColor: color.error,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDangerText: { ...font.button },
  buttonOutline: {
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  buttonOutlineText: { fontSize: 15, fontWeight: "600", color: color.textPrimary },

  secondary: {
    minHeight: 48,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { ...font.link },
  error: { color: color.error, fontSize: 14, lineHeight: 20 },

  // ── Device card (legacy compat) ────────────────────────────────────────────
  device: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  reading: { ...font.metricMedium },

  // ── Divider ──────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: color.border,
  },

  // ── List item row ────────────────────────────────────────────────────────────
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 56,
    gap: spacing.md,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Empty / placeholder ───────────────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl * 2,
    gap: spacing.md,
  },
  emptyStateText: { ...font.body, textAlign: "center" },
});
