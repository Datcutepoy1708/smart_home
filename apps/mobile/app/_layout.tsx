import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { requireOptionalNativeModule } from "expo";
import { SessionProvider, useSession } from "../core/session-provider";
import { styles as s } from "../shared/components/screen-styles";

function Routes() {
  // `identity` is a proper React state value exposed from context, not a
  // property read off a stable class instance. This ensures useEffect
  // re-runs whenever the user signs in or out.
  const { loading, error, retry, identity, resetSession } = useSession();
  const wasAuthenticated = useRef<boolean | null>(null);

  useEffect(() => {
    // Hide Expo Go floating developer menu button to prevent UI overlap
    try {
      const devMenu = requireOptionalNativeModule<{
        setPreferencesAsync?: (prefs: { showFloatingActionButton?: boolean }) => Promise<void>;
      }>("DevMenuPreferences");
      void devMenu?.setPreferencesAsync?.({ showFloatingActionButton: false });
    } catch {
      // Ignored if native module is not present
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const isAuthenticated = Boolean(identity);
    if (wasAuthenticated.current === isAuthenticated) return;

    wasAuthenticated.current = isAuthenticated;
    if (isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/sign-in");
    }
  }, [loading, identity]);

  if (loading)
    return (
      <View style={[s.screen, { justifyContent: "center" }]}>
        <ActivityIndicator accessibilityLabel="Restoring session" />
      </View>
    );
  if (error)
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.content}>
          <Text style={s.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={retry}
          >
            <Text style={s.buttonText}>Thử lại (Retry)</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.button, { marginTop: 12, backgroundColor: "#64748b" }]}
            onPress={resetSession}
          >
            <Text style={s.buttonText}>Đăng nhập lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <Stack>
      <Stack.Protected guard={!!identity}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="household-modal"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="device/[id]"
          options={{ headerShown: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!identity}>
        <Stack.Screen
          name="sign-in"
          options={{ title: "Welcome", headerBackVisible: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <Routes />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
