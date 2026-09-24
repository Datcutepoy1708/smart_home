import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, radius, spacing } from "../../shared/theme";
import type { Session } from "../../core/session";
import { joinHouseholdByCode } from "./household-data";

interface Props {
  visible: boolean;
  onClose: () => void;
  session: Session;
  onJoinedSuccess?: (householdName: string) => void;
}

export function JoinHouseholdModal({
  visible,
  onClose,
  session,
  onJoinedSuccess,
}: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert("Lỗi", "Vui lòng nhập mã mời (ví dụ: HM-4X2B).");
      return;
    }

    setLoading(true);
    try {
      const res = await joinHouseholdByCode(session, trimmed);
      Alert.alert(
        "Thành công! 🎉",
        `Bạn đã gia nhập thành công vào ngôi nhà "${res.householdName}".`,
      );
      setCode("");
      onClose();
      onJoinedSuccess?.(res.householdName);
    } catch (e: unknown) {
      Alert.alert(
        "Không thể gia nhập",
        e instanceof Error ? e.message : "Mã mời không đúng hoặc đã hết hạn.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="enter-outline" size={20} color={color.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Gia Nhập Ngôi Nhà</Text>
              <Text style={styles.sub}>Nhập mã mời được chia sẻ từ Chủ nhà</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color={color.textTertiary} />
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Ví dụ: HM-8A2K"
            placeholderTextColor={color.textTertiary}
            autoCapitalize="characters"
            maxLength={10}
          />

          <Text style={styles.hint}>
            Mã mời gồm 6 ký tự bắt đầu bằng HM- do Chủ nhà tạo ra.
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.joinBtn, (!code.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleJoin}
              disabled={!code.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinText}>Tham Gia Ngay</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialog: {
    width: "100%",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
  },
  sub: {
    fontSize: 11,
    color: color.textTertiary,
  },
  input: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "700",
    color: color.primary,
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 6,
  },
  hint: {
    fontSize: 11,
    color: color.textTertiary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.textSecondary,
  },
  joinBtn: {
    backgroundColor: color.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  joinText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
