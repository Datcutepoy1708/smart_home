import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../core/session-provider";
import { styles as s } from "../shared/components/screen-styles";
function Routes() {
  const { session, loading, error, retry } = useSession();
  useEffect(() => {
    if (loading) return;
    if (session.identity) {
      router.replace("/(tabs)");
    } else {
      router.replace("/sign-in");
    }
  }, [loading, session.identity]);
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
            <Text style={s.buttonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <Stack>
      <Stack.Protected guard={!!session.identity}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!session.identity}>
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
      <SessionProvider>
        <Routes />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
