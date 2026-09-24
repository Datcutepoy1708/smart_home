import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color } from "../../shared/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IoniconName, activeName: IoniconName) {
  const Icon = ({ color: c, focused }: { color: any; focused: boolean }) => (
    <Ionicons name={focused ? activeName : name} color={c} size={24} />
  );
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const height = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.tabActive,
        tabBarInactiveTintColor: color.tabInactive,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderTopWidth: 1,
          height,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: tabIcon("home-outline", "home"),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: "Thiết bị",
          tabBarIcon: tabIcon("options-outline", "options"),
        }}
      />
      <Tabs.Screen
        name="automation"
        options={{
          title: "Tự động",
          tabBarIcon: tabIcon("flash-outline", "flash"),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Hoạt động",
          tabBarIcon: tabIcon("time-outline", "time"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Cài đặt",
          tabBarIcon: tabIcon("settings-outline", "settings"),
        }}
      />
    </Tabs>
  );
}
