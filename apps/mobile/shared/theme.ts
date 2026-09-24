/**
 * Design tokens derived from reference images s1–s5.
 * All screens and components must reference these values — do not inline
 * one-off colours or font sizes in component StyleSheets.
 */

export const color = {
  // Backgrounds
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F5F9",

  // Brand / primary — blue (active tab, primary action buttons)
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  onPrimary: "#FFFFFF",

  // Status — online / success
  online: "#16A34A",
  onlineBackground: "#DCFCE7",

  // Status — error / alert
  error: "#DC2626",
  errorBackground: "#FEE2E2",
  errorMuted: "#FCA5A5",

  // Status — warning / amber
  warning: "#D97706",
  warningBackground: "#FEF3C7",

  // Status — offline / neutral
  offline: "#64748B",
  offlineBackground: "#F1F5F9",

  // Borders
  border: "#E5E9F0",
  borderStrong: "#CBD5E1",

  // Typography
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  textDisabled: "#CBD5E1",

  // Tab bar
  tabActive: "#2563EB",
  tabInactive: "#94A3B8",

  // Disabled surface
  disabledSurface: "#F8FAFC",
  disabledBorder: "#E2E8F0",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const font = {
  titleLarge: { fontSize: 26, fontWeight: "700" as const, color: color.textPrimary, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700" as const, color: color.textPrimary, letterSpacing: -0.3 },
  titleSmall: { fontSize: 18, fontWeight: "700" as const, color: color.textPrimary },

  sectionHeader: { fontSize: 13, fontWeight: "600" as const, color: color.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.8 },

  bodyLarge: { fontSize: 16, fontWeight: "400" as const, color: color.textPrimary, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: "400" as const, color: color.textSecondary, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: "400" as const, color: color.textTertiary, lineHeight: 16 },

  metricLarge: { fontSize: 36, fontWeight: "700" as const, color: color.textPrimary, letterSpacing: -1 },
  metricMedium: { fontSize: 24, fontWeight: "700" as const, color: color.textPrimary, letterSpacing: -0.5 },

  label: { fontSize: 13, fontWeight: "600" as const, color: color.textPrimary },
  labelSecondary: { fontSize: 13, fontWeight: "500" as const, color: color.textSecondary },
  caption: { fontSize: 11, fontWeight: "400" as const, color: color.textTertiary },

  button: { fontSize: 15, fontWeight: "600" as const, color: color.onPrimary },
  link: { fontSize: 14, fontWeight: "600" as const, color: color.primary },
} as const;
