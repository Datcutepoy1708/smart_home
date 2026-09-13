import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { useSession } from "../../core/session-provider";
import { styles as s } from "../../shared/components/screen-styles";
export default function SettingsScreen() {
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await session.logout();
    } catch {
      setError(
        "Sign out could not be completed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.title}>Account</Text>
      <Text style={s.label}>{session.identity?.user.name}</Text>
      <Text style={s.subtitle}>{session.identity?.user.email}</Text>
      {error ? (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void logout()}
        style={s.button}
      >
        <Text style={s.buttonText}>{busy ? "Signing out..." : "Sign out"}</Text>
      </Pressable>
    </ScrollView>
  );
}
