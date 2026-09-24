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
import { createHousehold } from "./household-data";

interface Props {
  visible: boolean;
  onClose: () => void;
  session: Session;
  onCreatedSuccess?: (name: string) => void;
}

export function CreateHouseholdModal({
  visible,
  onClose,
  session,
  onCreatedSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Lỗi", "Vui lòng nhập tên ngôi nhà.");
      return;
    }

    setLoading(true);
    try {
      const res = await createHousehold(session, trimmed);
      Alert.alert(
        "Thành công! 🏡",
        `Đã tạo ngôi nhà "${res.name}". Bạn là Chủ nhà (Owner).`,
      );
      setName("");
      onClose();
      onCreatedSuccess?.(res.name);
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể tạo ngôi nhà.");
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
              <Ionicons name="home-outline" size={20} color={color.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Tạo Ngôi Nhà Mới</Text>
              <Text style={styles.sub}>Thêm không gian thông minh của bạn</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={22} color={color.textTertiary} />
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Nhà riêng, Căn hộ 802..."
            placeholderTextColor={color.textTertiary}
            maxLength={50}
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.createBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createText}>Tạo Ngay</Text>
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
    paddingVertical: 10,
    fontSize: 14,
    color: color.textPrimary,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: color.textSecondary,
  },
  createBtn: {
    backgroundColor: color.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  createText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
