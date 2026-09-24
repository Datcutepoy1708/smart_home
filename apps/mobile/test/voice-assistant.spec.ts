import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const sessionState = vi.hoisted(() => ({
  session: {
    identity: {
      user: { name: "Test User", email: "t@t.com" },
      households: [{ id: "h1", name: "Test Home", role: "owner" }],
    },
    post: vi.fn(),
  },
}));

vi.mock("../core/session-provider", () => ({ useSession: () => sessionState }));
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: () => null,
}));
vi.mock("react-native", () => ({
  View: "section",
  Text: "span",
  Pressable: "button",
  SafeAreaView: "main",
  ScrollView: "div",
  ActivityIndicator: "progress",
  TextInput: "input",
  Modal: "div",
  Platform: { OS: "ios" },
  StyleSheet: { create: (value: unknown) => value },
}));

import { VoiceAssistantModal } from "../features/voice/voice-assistant-modal";
import { FloatingVoiceButton } from "../features/voice/floating-voice-button";
import { executeVoiceCommand } from "../features/voice/voice-data";

describe("Voice Assistant Mobile Feature", () => {
  it("renders FloatingVoiceButton with accessibility label", () => {
    const html = renderToStaticMarkup(createElement(FloatingVoiceButton));
    expect(html).toContain("Mở trợ lý giọng nói");
  });

  it("renders VoiceAssistantModal with quick commands and header", () => {
    const html = renderToStaticMarkup(
      createElement(VoiceAssistantModal, {
        visible: true,
        onClose: () => {},
        session: sessionState.session as any,
        householdId: "h1",
      })
    );
    expect(html).toContain("Trợ Lý Giọng Nói AI");
    expect(html).toContain("Mở cửa 90 độ");
    expect(html).toContain("Bật quạt phòng khách");
    expect(html).toContain("Bật đèn");
    expect(html).toContain("Chạm vào Micro để nói");
  });

  it("executeVoiceCommand calls household voice endpoint via session", async () => {
    const mockPost = vi.fn().mockResolvedValue({
      success: true,
      transcript: "mở cửa 90 độ",
      action: "SET_DOOR_ANGLE",
      message: "Đã mở cửa đến góc 90°.",
    });
    const fakeSession = { post: mockPost } as any;

    const result = await executeVoiceCommand(fakeSession, "house-123", "mở cửa 90 độ");

    expect(mockPost).toHaveBeenCalledWith(
      "/households/house-123/voice/command",
      { text: "mở cửa 90 độ" }
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Đã mở cửa đến góc 90°.");
  });
});
