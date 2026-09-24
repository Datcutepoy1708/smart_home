import React from "react";
import { Platform, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, spacing } from "../theme";
import { styles as s } from "./screen-styles";

interface ScreenHeaderProps {
  title: string;
  /** User initials rendered as avatar — omit to hide avatar */
  initials?: string;
  /** Whether to render a notification bell icon */
  showBell?: boolean;
  /** Additional element on the right (e.g. filter/grid icons) */
  right?: React.ReactNode;
}

/**
 * Shared app header used by all main tab screens.
 * Matches the top-bar layout visible in s1.png and s5.png:
 *   [home icon]  [title]          [bell?]  [avatar?]
 */
export default function ScreenHeader({
  title,
  initials,
  showBell = false,
  right,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const topPadding = Math.max(insets.top, statusBarHeight, spacing.md) + (Platform.OS === "android" ? 6 : 0);

  return (
    <View
      style={[
        s.header,
        { paddingTop: topPadding },
      ]}
    >
      <View style={s.rowStart}>
        <Ionicons name="home-outline" size={20} color={color.primary} />
        <Text style={s.headerTitle}>{title}</Text>
      </View>
      <View style={s.headerActions}>
        {right}
        {showBell && (
          <Ionicons name="notifications-outline" size={22} color={color.textSecondary} />
        )}
        {initials ? (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
