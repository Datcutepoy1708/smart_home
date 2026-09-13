import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSession } from "../../core/session-provider";
import { styles as s } from "../../shared/components/screen-styles";

export default function AuthScreen() {
  const { session } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    if (
      !email.trim() ||
      !password ||
      (mode === "register" &&
        (name.trim().length < 2 ||
          householdName.trim().length < 2 ||
          password.length < 10))
    ) {
      setError(
        "Enter your email and password. Registration needs names of at least 2 characters and a password of at least 10 characters.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await session.signIn(mode, {
        email: email.trim(),
        password,
        ...(mode === "register"
          ? { name: name.trim(), householdName: householdName.trim() }
          : {}),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text style={s.title}>Smart Home</Text>
        <Text style={s.subtitle}>
          {mode === "login" ? "Sign in to your home" : "Create your home"}
        </Text>
        {mode === "register" && (
          <>
            <View style={s.group}>
              <Text style={s.label}>Your name</Text>
              <TextInput
                accessibilityLabel="Your name"
                style={s.field}
                value={name}
                onChangeText={setName}
                maxLength={100}
                editable={!busy}
                autoComplete="name"
              />
            </View>
            <View style={s.group}>
              <Text style={s.label}>Home name</Text>
              <TextInput
                accessibilityLabel="Home name"
                style={s.field}
                value={householdName}
                onChangeText={setHouseholdName}
                maxLength={100}
                editable={!busy}
              />
            </View>
          </>
        )}
        <View style={s.group}>
          <Text style={s.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            style={s.field}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            maxLength={150}
            editable={!busy}
          />
        </View>
        <View style={s.group}>
          <Text style={s.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            style={s.field}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            maxLength={72}
            editable={!busy}
            onSubmitEditing={() => void submit()}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={s.button}
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.buttonText}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={s.secondary}
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setPassword("");
          }}
        >
          <Text style={s.link}>
            {mode === "login" ? "Create an account" : "Back to sign in"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
