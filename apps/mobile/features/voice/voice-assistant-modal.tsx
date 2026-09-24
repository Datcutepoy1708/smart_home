import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, radius, spacing } from "../../shared/theme";
import {
  executeVoiceCommand,
  type VoiceCommandResponse,
} from "./voice-data";
import type { Session } from "../../core/session";

interface Props {
  visible: boolean;
  onClose: () => void;
  session: Session;
  householdId: string;
  onCommandExecuted?: () => void;
}

const QUICK_COMMANDS = [
  { icon: "key", text: "Mở cửa 90 độ" },
  { icon: "lock-closed", text: "Đóng cửa lại" },
  { icon: "snow", text: "Bật quạt phòng khách" },
  { icon: "power", text: "Tắt quạt" },
  { icon: "bulb", text: "Bật đèn" },
  { icon: "bulb-outline", text: "Tắt đèn" },
  { icon: "home", text: "Về nhà" },
  { icon: "moon", text: "Đi ngủ" },
  { icon: "thermometer", text: "Nhiệt độ phòng bao nhiêu" },
];

export function VoiceAssistantModal({
  visible,
  onClose,
  session,
  householdId,
  onCommandExecuted,
}: Props) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<VoiceCommandResponse | null>(null);

  // Web Speech Recognition support if running in Web browser
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "vi-VN";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          setInputText(transcript);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  function handleStartListening() {
    setLastResponse(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch {
        /* ignore */
      }
    }

    // Toggle simulation state for non-web / keyboard input
    setIsListening(true);
  }

  function handleStopListening() {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }

  async function handleSendCommand(textToSend?: string) {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    handleStopListening();
    setLoading(true);
    setLastResponse(null);

    try {
      const res = await executeVoiceCommand(session, householdId, query);
      setLastResponse(res);
      setInputText("");
      if (res.success) {
        onCommandExecuted?.();
      }
    } catch (e: unknown) {
      setLastResponse({
        success: false,
        transcript: query,
        message: e instanceof Error ? e.message : "Không thể gửi câu lệnh.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.assistantIcon}>
                <Ionicons name="sparkles" size={16} color="#fff" />
              </View>
              <Text style={styles.headerTitle}>Trợ Lý Giọng Nói AI</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={24} color={color.textTertiary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Visual Listening / Response Area */}
            <View style={styles.centerArea}>
              {/* Animated Glowing Mic Circle */}
              <Pressable
                style={[
                  styles.micCircleOuter,
                  isListening && styles.micCircleOuterActive,
                ]}
                onPress={isListening ? handleStopListening : handleStartListening}
              >
                <View
                  style={[
                    styles.micCircleInner,
                    isListening && styles.micCircleInnerActive,
                  ]}
                >
                  <Ionicons
                    name={isListening ? "mic" : "mic-outline"}
                    size={36}
                    color="#fff"
                  />
                </View>
              </Pressable>

              <Text style={styles.statusText}>
                {isListening
                  ? "Đang lắng nghe bạn nói..."
                  : loading
                  ? "Đang xử lý câu lệnh..."
                  : "Chạm vào Micro để nói"}
              </Text>

              <Text style={styles.subStatusText}>
                Hỗ trợ tiếng Việt tự nhiên (mở cửa, quạt, đèn, ngữ cảnh, hỏi nhiệt độ)
              </Text>
            </View>

            {/* Response Card */}
            {lastResponse && (
              <View
                style={[
                  styles.responseCard,
                  lastResponse.success
                    ? styles.responseSuccess
                    : styles.responseFail,
                ]}
              >
                <View style={styles.responseHeader}>
                  <Ionicons
                    name={
                      lastResponse.success
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={20}
                    color={lastResponse.success ? "#16a34a" : color.error}
                  />
                  <Text style={styles.transcriptQuote}>
                    "{lastResponse.transcript}"
                  </Text>
                </View>
                <Text style={styles.responseMessage}>
                  {lastResponse.message}
                </Text>
              </View>
            )}

            {/* Text Input Row */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Nói hoặc nhập lệnh: Mở cửa 90 độ..."
                placeholderTextColor={color.textTertiary}
                onSubmitEditing={() => handleSendCommand()}
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  (!inputText.trim() || loading) && { opacity: 0.5 },
                ]}
                onPress={() => handleSendCommand()}
                disabled={!inputText.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                )}
              </Pressable>
            </View>

            {/* Quick Command Suggestions */}
            <Text style={styles.suggestionsTitle}>
              GỢI Ý CÂU LỆNH NHANH (BẤM ĐỂ CHẠY NGAY):
            </Text>
            <View style={styles.chipsWrap}>
              {QUICK_COMMANDS.map((cmd) => (
                <Pressable
                  key={cmd.text}
                  style={styles.chip}
                  onPress={() => {
                    setInputText(cmd.text);
                    void handleSendCommand(cmd.text);
                  }}
                  disabled={loading}
                >
                  <Ionicons
                    name={cmd.icon as any}
                    size={14}
                    color={color.primary}
                  />
                  <Text style={styles.chipText}>{cmd.text}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  assistantIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
  },
  body: {
    padding: spacing.md,
  },
  centerArea: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  micCircleOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  micCircleOuterActive: {
    backgroundColor: "#fed7aa",
  },
  micCircleInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  micCircleInnerActive: {
    backgroundColor: "#ea580c",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
    marginBottom: 4,
  },
  subStatusText: {
    fontSize: 12,
    color: color.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  responseCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  responseSuccess: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  responseFail: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  responseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  transcriptQuote: {
    fontSize: 12,
    fontStyle: "italic",
    color: color.textSecondary,
  },
  responseMessage: {
    fontSize: 14,
    fontWeight: "700",
    color: color.textPrimary,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  textInput: {
    flex: 1,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: color.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: color.textTertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs + 2,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textPrimary,
  },
});
