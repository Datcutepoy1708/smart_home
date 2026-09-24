import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, radius } from "../../shared/theme";
import { VoiceAssistantModal } from "./voice-assistant-modal";
import { useSession } from "../../core/session-provider";

interface FloatingVoiceButtonProps {
  householdId?: string;
  onCommandExecuted?: () => void;
}

export function FloatingVoiceButton({
  householdId: propHouseholdId,
  onCommandExecuted,
}: FloatingVoiceButtonProps = {}) {
  const { session } = useSession();
  const householdId = propHouseholdId ?? session.identity?.households[0]?.id;
  const [modalVisible, setModalVisible] = useState(false);

  if (!householdId) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở trợ lý giọng nói"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.fabInner}>
          <Ionicons name="mic" size={24} color="#fff" />
        </View>
      </Pressable>

      <VoiceAssistantModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        session={session}
        householdId={householdId}
        onCommandExecuted={onCommandExecuted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
